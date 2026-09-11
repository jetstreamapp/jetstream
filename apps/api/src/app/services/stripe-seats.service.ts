import { logger } from '@jetstream/api-config';
import {
  centsToDollars,
  convertStripePriceTiers,
  getErrorMessage,
  getErrorMessageAndStackObj,
  getIncludedSeatsFromPriceTiers,
} from '@jetstream/shared/utils';
import { JetstreamPriceTier, TeamSeatChangeResult } from '@jetstream/types';
import { fromUnixTime, getUnixTime } from 'date-fns';
import { isObject, isString } from 'lodash';
import type Stripe from 'stripe';
import type { TeamSeatState } from '../db/subscription.db';
import { stripe } from './stripe.client';

/**
 * Purchased-seat operations against Stripe: resolving the seat state a team's subscription implies,
 * previewing and committing seat changes, and the end-of-period decrease schedules. Kept apart from
 * the general customer/subscription synchronization in stripe.service.ts, which only reads back
 * `resolveTeamSeatState` and `fetchPriceTiers` from here.
 */

/** Marks the subscription schedules Jetstream creates for end-of-period seat decreases. */
export const SEAT_DECREASE_SCHEDULE_TYPE = 'SEAT_DECREASE';

const priceTiersCache = new Map<string, { tiers: JetstreamPriceTier[]; expiresAt: number }>();
const PRICE_TIERS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

/**
 * Stripe omits `tiers` from the price embedded in a subscription item, and the expansion path through
 * the customer is deeper than Stripe allows, so tiered prices are fetched individually. A price's tier
 * table cannot change after creation, so a long cache is safe.
 */
export async function fetchPriceTiers(priceId: string): Promise<JetstreamPriceTier[] | null> {
  const cached = priceTiersCache.get(priceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tiers;
  }
  const price = await stripe.prices.retrieve(priceId, { expand: ['tiers'] });
  const tiers = convertStripePriceTiers(price.tiers);
  // Only tiered prices are looked up, so a missing table is an anomaly worth retrying on the next call
  // rather than remembering for the cache lifetime
  if (tiers) {
    priceTiersCache.set(priceId, { tiers, expiresAt: Date.now() + PRICE_TIERS_CACHE_TTL_MS });
  }
  return tiers;
}

/**
 * ************************************
 * Team seats
 * ************************************
 */

interface SeatItemMatch {
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
}

/**
 * The subscription item that carries the team's purchased seats. A customer is expected to have exactly
 * one TEAM_ item; more than one means the account was edited by hand and the seat state is ambiguous,
 * so nothing is derived from it until it is cleaned up.
 */
export function findTeamSeatItem(subscriptions: Stripe.Subscription[]): SeatItemMatch | null {
  const matches = subscriptions.flatMap((subscription) =>
    subscription.items.data.filter((item) => item.price.lookup_key?.startsWith('TEAM_')).map((item) => ({ subscription, item })),
  );
  if (matches.length > 1) {
    logger.warn(
      { subscriptionItemIds: matches.map(({ item }) => item.id) },
      'Customer has more than one TEAM subscription item, seat state cannot be resolved',
    );
    return null;
  }
  return matches[0] ?? null;
}

function getPriceId(price: string | Stripe.Price | Stripe.DeletedPrice): string {
  return isString(price) ? price : price.id;
}

function getStripeObjectId(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return isString(value) ? value : value.id;
}

/**
 * Resolve the purchased-seat state Jetstream mirrors from Stripe: the TEAM_ item, the seats its price
 * includes for free (legacy flat-tier plans), and any schedule attached to the subscription.
 *
 * A schedule Jetstream created for a decrease whose second phase has already started has done its job
 * (Stripe lowered the quantity when the phase began) and is released so the subscription is free for
 * the next change. A schedule created elsewhere is reported as foreign so seat changes are blocked
 * rather than silently clobbering it.
 */
export async function resolveTeamSeatState(subscriptions: Stripe.Subscription[]): Promise<TeamSeatState | null> {
  const seatItem = findTeamSeatItem(subscriptions);
  if (!seatItem) {
    return null;
  }
  const { subscription, item } = seatItem;
  // A failed or empty tier lookup must fail the sync: writing includedSeats=0 for a legacy plan would
  // shrink the cap under the team
  const tiers = item.price.billing_scheme === 'tiered' ? await fetchPriceTiers(item.price.id) : null;
  if (item.price.billing_scheme === 'tiered' && !tiers?.length) {
    throw new Error(`Tiered price ${item.price.id} returned no tier table, seat state cannot be resolved`);
  }
  const scheduleState = await resolveSeatScheduleState(subscription, item);
  return {
    subscriptionItemId: item.id,
    quantity: item.quantity ?? 1,
    includedSeats: getIncludedSeatsFromPriceTiers(tiers),
    periodEnd: fromUnixTime(item.current_period_end),
    ...scheduleState,
  };
}

async function resolveSeatScheduleState(
  subscription: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
): Promise<Pick<TeamSeatState, 'pending' | 'foreignScheduleId'>> {
  if (!subscription.schedule) {
    return { pending: null, foreignScheduleId: null };
  }
  const schedule = isString(subscription.schedule)
    ? await stripe.subscriptionSchedules.retrieve(subscription.schedule)
    : subscription.schedule;

  if (schedule.metadata?.type !== SEAT_DECREASE_SCHEDULE_TYPE) {
    return { pending: null, foreignScheduleId: schedule.id };
  }
  if (schedule.status !== 'active') {
    return { pending: null, foreignScheduleId: null };
  }

  const nowSeconds = getUnixTime(new Date());
  const pendingPhase = schedule.phases.find((phase) => phase.start_date > nowSeconds);
  if (!pendingPhase) {
    // The decrease landed when phase two started; release so the subscription is no longer schedule-managed.
    // A failed release leaves Stripe managing the subscription and rejecting direct quantity updates, so
    // keep reporting it as foreign — seat changes stay blocked with an explanation until a later sync
    // manages to release it, rather than failing inside Stripe.
    const released = await releaseTeamSeatSchedule(schedule.id)
      .then(() => true)
      .catch((ex) => {
        logger.warn({ scheduleId: schedule.id, ...getErrorMessageAndStackObj(ex) }, 'Unable to release applied seat decrease schedule');
        return false;
      });
    return { pending: null, foreignScheduleId: released ? null : schedule.id };
  }

  const pendingQuantity =
    pendingPhase.items.find((phaseItem) => getPriceId(phaseItem.price) === item.price.id)?.quantity ?? Number(schedule.metadata?.seats);
  if (!Number.isInteger(pendingQuantity)) {
    logger.warn({ scheduleId: schedule.id }, 'Seat decrease schedule has no resolvable quantity, ignoring pending decrease');
    return { pending: null, foreignScheduleId: null };
  }
  return {
    pending: { quantity: pendingQuantity, effectiveAt: fromUnixTime(pendingPhase.start_date), scheduleId: schedule.id },
    foreignScheduleId: null,
  };
}

/**
 * Amount the customer pays right now for an increase: the proration lines of the invoice Stripe would
 * create. Falls back to the invoice total when Stripe does not flag any line as a proration.
 */
export function sumProrationAmount(invoice: Pick<Stripe.Invoice, 'amount_due' | 'lines'>): number {
  const prorationLines = invoice.lines.data.filter((line) => line.parent?.subscription_item_details?.proration === true);
  if (prorationLines.length === 0) {
    return centsToDollars(invoice.amount_due) ?? 0;
  }
  return centsToDollars(prorationLines.reduce((total, line) => total + line.amount, 0)) ?? 0;
}

/**
 * Preview a seat change. The recurring total uses `proration_behavior: 'none'` (Stripe forbids a
 * proration_date with it); the amount due now for an increase comes from a second, prorated preview
 * anchored at `prorationDate` so the charge on commit matches what the admin saw.
 */
export async function previewTeamSeatChange({
  customerId,
  subscriptionId,
  subscriptionItemId,
  quantity,
  prorationDate,
}: {
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  quantity: number;
  prorationDate?: number | null;
}): Promise<{ nextInvoiceAmount: number; amountDueNow: number }> {
  const recurringInvoice = await stripe.invoices.createPreview({
    customer: customerId,
    subscription: subscriptionId,
    subscription_details: { items: [{ id: subscriptionItemId, quantity }], proration_behavior: 'none' },
  });

  let amountDueNow = 0;
  if (prorationDate) {
    const prorationInvoice = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscriptionId,
      subscription_details: {
        items: [{ id: subscriptionItemId, quantity }],
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
      },
    });
    amountDueNow = sumProrationAmount(prorationInvoice);
  }

  return { nextInvoiceAmount: centsToDollars(recurringInvoice.amount_due) ?? 0, amountDueNow };
}

/**
 * Apply an increase immediately and invoice the proration. `error_if_incomplete` makes a declined
 * payment reject the whole update, so the quantity never moves without the money.
 */
export async function commitTeamSeatIncrease({
  subscriptionItemId,
  quantity,
  prorationDate,
}: {
  subscriptionItemId: string;
  quantity: number;
  prorationDate: number;
}): Promise<Stripe.SubscriptionItem> {
  return await stripe.subscriptionItems.update(subscriptionItemId, {
    quantity,
    proration_behavior: 'always_invoice',
    proration_date: prorationDate,
    payment_behavior: 'error_if_incomplete',
  });
}

function toPhaseDiscountParam(
  discount: Stripe.SubscriptionSchedule.Phase.Discount,
): Stripe.SubscriptionScheduleUpdateParams.Phase.Discount | null {
  // Reusing the existing discount keeps its redemption state; otherwise re-apply the source it came from
  const existingDiscountId = getStripeObjectId(discount.discount);
  if (existingDiscountId) {
    return { discount: existingDiscountId };
  }
  const promotionCodeId = getStripeObjectId(discount.promotion_code);
  if (promotionCodeId) {
    return { promotion_code: promotionCodeId };
  }
  const couponId = getStripeObjectId(discount.coupon);
  if (couponId) {
    return { coupon: couponId };
  }
  return null;
}

/**
 * Build the two-phase schedule for an end-of-period decrease: the current phase copied so nothing
 * changes before renewal, then one interval at the lower quantity, after which the schedule releases
 * the subscription. Discounts are re-sent because an unspecified phase inherits from the customer only.
 */
export function buildSeatDecreaseScheduleParams({
  teamId,
  schedule,
  item,
  quantity,
}: {
  teamId: string;
  schedule: Stripe.SubscriptionSchedule;
  item: Stripe.SubscriptionItem;
  quantity: number;
}): Stripe.SubscriptionScheduleUpdateParams {
  const [currentPhase] = schedule.phases;
  if (!currentPhase) {
    throw new Error(`Subscription schedule ${schedule.id} has no phases`);
  }
  const { recurring } = item.price;
  if (!recurring) {
    throw new Error(`Subscription item ${item.id} has no recurring interval`);
  }
  const discounts = currentPhase.discounts
    .map(toPhaseDiscountParam)
    .filter((discount): discount is Stripe.SubscriptionScheduleUpdateParams.Phase.Discount => discount !== null);
  const discountParams = discounts.length > 0 ? { discounts } : {};
  return {
    end_behavior: 'release',
    metadata: { type: SEAT_DECREASE_SCHEDULE_TYPE, teamId, seats: String(quantity) },
    phases: [
      {
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
        items: currentPhase.items.map((phaseItem) => ({ price: getPriceId(phaseItem.price), quantity: phaseItem.quantity })),
        ...discountParams,
      },
      {
        // Every item carries forward; only the seat item's quantity drops, so a non-seat item on the
        // subscription is not silently removed when the phase begins
        items: currentPhase.items.map((phaseItem) => {
          const priceId = getPriceId(phaseItem.price);
          return { price: priceId, quantity: priceId === item.price.id ? quantity : phaseItem.quantity };
        }),
        // Exactly one billing interval at the lower quantity, then `end_behavior` hands the subscription back
        duration: { interval: recurring.interval, interval_count: recurring.interval_count },
        proration_behavior: 'none',
        ...discountParams,
      },
    ],
  };
}

/**
 * Attach a schedule that lowers the seat quantity when the current period ends. Schedules are never
 * cancelled (cancelling one cancels the subscription); releasing detaches them instead.
 */
export async function scheduleTeamSeatDecrease({
  teamId,
  subscription,
  item,
  quantity,
}: {
  teamId: string;
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
  quantity: number;
}): Promise<Stripe.SubscriptionSchedule> {
  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
  try {
    return await stripe.subscriptionSchedules.update(schedule.id, buildSeatDecreaseScheduleParams({ teamId, schedule, item, quantity }));
  } catch (ex) {
    // Without our metadata the schedule reads as foreign on the next sync, which blocks every future
    // seat change until someone clears it by hand
    await releaseTeamSeatSchedule(schedule.id).catch((releaseError) => {
      logger.error(
        { teamId, scheduleId: schedule.id, ...getErrorMessageAndStackObj(releaseError) },
        'Unable to release the seat decrease schedule after it failed to configure',
      );
    });
    throw ex;
  }
}

/** Detach a seat decrease schedule; an already-released or missing schedule counts as done. */
export async function releaseTeamSeatSchedule(scheduleId: string): Promise<void> {
  try {
    await stripe.subscriptionSchedules.release(scheduleId);
  } catch (ex) {
    if (isStripeInvalidRequestError(ex)) {
      logger.info({ scheduleId, ...getErrorMessageAndStackObj(ex) }, 'Seat decrease schedule was already released');
      return;
    }
    throw ex;
  }
}

/** After an immediate increase the newest invoice on the subscription is the proration invoice. */
export async function fetchLatestInvoiceForSubscription(subscriptionId: string): Promise<TeamSeatChangeResult['invoice']> {
  const { data } = await stripe.invoices.list({ subscription: subscriptionId, limit: 1 });
  const [invoice] = data;
  if (!invoice) {
    return null;
  }
  return {
    id: invoice.id,
    status: invoice.status ?? null,
    amountDue: centsToDollars(invoice.amount_due) ?? 0,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
  };
}

/**
 * Stripe errors are duck-typed rather than checked with `instanceof Stripe.errors.*` so the checks
 * hold across module boundaries and against the partial SDK mock used in tests.
 */
interface StripeErrorLike {
  type?: string;
  rawType?: string;
  code?: string;
  param?: string;
  message?: string;
  decline_code?: string;
}

function asStripeError(ex: unknown): StripeErrorLike | null {
  return isObject(ex) ? (ex as StripeErrorLike) : null;
}

export function isStripeCardError(ex: unknown): boolean {
  const error = asStripeError(ex);
  return error?.type === 'StripeCardError' || error?.rawType === 'card_error';
}

export function isStripeInvalidRequestError(ex: unknown): boolean {
  const error = asStripeError(ex);
  return error?.type === 'StripeInvalidRequestError' || error?.rawType === 'invalid_request_error';
}

/** Stripe rejects a proration_date outside the current period, which is what a stale preview looks like. */
export function isProrationDateError(ex: unknown): boolean {
  const error = asStripeError(ex);
  return isStripeInvalidRequestError(ex) && (/proration_date/i.test(error?.param ?? '') || /proration_date/i.test(error?.message ?? ''));
}

export function getStripeErrorDetails(ex: unknown): { message: string; declineCode: string | null } {
  const error = asStripeError(ex);
  return { message: error?.message || getErrorMessage(ex), declineCode: error?.decline_code ?? null };
}

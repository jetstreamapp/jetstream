import { logger, prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { classifySeatChange, getErrorMessageAndStackObj, getMinimumSeats, getPurchasedSeatCount } from '@jetstream/shared/utils';
import { getTeamSeatSummary, withTeamSeatLock } from '@jetstream/team-seats';
import {
  TEAM_BILLING_STATUS_PAST_DUE,
  TeamSeatChangePreview,
  TeamSeatChangeResult,
  TeamSeatChangeType,
  TeamSeatErrorCode,
  TeamSeatUpdateResponse,
} from '@jetstream/types';
import { format, formatISO, getUnixTime } from 'date-fns';
import Stripe from 'stripe';
import type { TeamSeatState } from '../db/subscription.db';
import * as subscriptionDbService from '../db/subscription.db';
import * as teamDbService from '../db/team.db';
import { UserFacingError } from '../utils/error-handler';
import * as stripeSeatsService from './stripe-seats.service';
import * as stripeService from './stripe.service';

/** How long a previewed proration date stays valid; matches the copy shown with the preview. */
const PREVIEW_VALIDITY_MS = 15 * 60 * 1000;
/** Tolerance for clock drift between the instance that issued the preview and the one committing it */
const PRORATION_CLOCK_SKEW_MS = 60 * 1000;

/**
 * Everything a seat change needs from Stripe and the billing account. Loading it rejects every team
 * that cannot self-serve seats, so preview and commit only deal with the happy path.
 */
interface SeatContext {
  teamId: string;
  customerId: string;
  customer: Stripe.Customer;
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
  seatState: TeamSeatState;
  /** Seats the team has today: max(item quantity, seats included by the price) */
  effectiveSeats: number;
  interval: TeamSeatChangePreview['interval'];
  hasDiscount: boolean;
}

function seatError(code: TeamSeatErrorCode, message: string, detail: Record<string, unknown> = {}): UserFacingError {
  return new UserFacingError(message, { code, ...detail });
}

const NO_ACTIVE_SUBSCRIPTION_MESSAGE = 'Your team does not have an active subscription, so seats cannot be changed.';

async function loadSeatContext(teamId: string): Promise<SeatContext> {
  const team = await subscriptionDbService.getTeamBillingAccountForSeats({ teamId });
  const { billingAccount } = team;
  if (!billingAccount) {
    throw seatError('SEATS_NO_SUBSCRIPTION', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  if (billingAccount.manualBilling) {
    throw seatError('SEATS_MANUAL_BILLING', 'Seats for this team are set by your billing agreement. Contact support to change them.');
  }
  if (team.billingStatus === TEAM_BILLING_STATUS_PAST_DUE) {
    throw seatError('SEATS_PAST_DUE', 'Your account is past due. Resolve the outstanding invoice before changing seats.');
  }

  const customer = await stripeService.fetchCustomerWithSubscriptionsById({ customerId: billingAccount.customerId });
  if (customer.deleted) {
    throw seatError('SEATS_NO_SUBSCRIPTION', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  const subscriptions = stripeService.filterInactiveSubscriptions(customer.subscriptions?.data ?? []);
  const seatItem = stripeSeatsService.findTeamSeatItem(subscriptions);
  if (!seatItem) {
    throw seatError('SEATS_NO_SUBSCRIPTION', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  const { subscription, item } = seatItem;
  if (subscription.cancel_at_period_end || subscription.cancel_at) {
    throw seatError(
      'SEATS_SUBSCRIPTION_CANCELING',
      'Your subscription is set to cancel, so seats cannot be changed. Resume it from the billing portal first.',
    );
  }

  const seatState = await stripeSeatsService.resolveTeamSeatState(subscriptions);
  if (!seatState) {
    throw seatError('SEATS_NO_SUBSCRIPTION', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  if (seatState.foreignScheduleId) {
    throw seatError(
      'SEATS_BLOCKED_BY_SCHEDULE',
      'A scheduled change already exists on your subscription, so seats cannot be changed here. Contact support for help.',
      { scheduleId: seatState.foreignScheduleId },
    );
  }

  return {
    teamId,
    customerId: billingAccount.customerId,
    customer,
    subscription,
    item,
    seatState,
    effectiveSeats: getPurchasedSeatCount(seatState),
    interval: item.price.recurring?.interval === 'year' ? 'YEAR' : 'MONTH',
    hasDiscount: Boolean(customer.discount || subscription.discounts.length > 0),
  };
}

function classifyChange(context: SeatContext, requested: number): TeamSeatChangeType {
  return classifySeatChange({ requested, purchased: context.effectiveSeats, pending: context.seatState.pending?.quantity ?? null });
}

function noChangeError(context: SeatContext): UserFacingError {
  const { pending } = context.seatState;
  // A scheduled decrease is the count the request actually matched, so report that rather than the
  // purchased count the team is still on until the period ends
  if (pending) {
    return new UserFacingError(
      `No change: your team is already scheduled to move to ${pending.quantity} seats on ${format(pending.effectiveAt, 'MMMM d, yyyy')}.`,
      { changeType: 'NONE', currentSeats: context.effectiveSeats, pendingSeats: pending.quantity },
    );
  }
  return new UserFacingError(`No change: your team already has ${context.effectiveSeats} seats.`, {
    changeType: 'NONE',
    currentSeats: context.effectiveSeats,
  });
}

/**
 * Rejects a count below the team's floor (see `getMinimumSeats`), naming whichever of usage or the
 * plan's included seats set it, and returns the floor. The request schemas already bound the count
 * to 1..MAX_TEAM_SEATS, so the floor is the only limit left to check.
 *
 * Included seats come from Stripe's live seat state rather than the mirrored columns so a lagging
 * sync can never approve a change against stale numbers.
 */
function assertSeatCountCoversMinimum({
  requested,
  used,
  reserved,
  includedSeats,
  currentSeats,
}: {
  requested: number;
  used: number;
  reserved: number;
  includedSeats: number;
  currentSeats: number;
}): number {
  const minimum = getMinimumSeats({ used, reserved, includedSeats });
  if (requested < minimum) {
    const message =
      requested < used + reserved
        ? `Your team needs at least ${minimum} seats: ${used} in use and ${reserved} reserved by pending invitations. Deactivate members or cancel invitations first.`
        : `Your plan includes ${includedSeats} seats, so the seat count cannot go below ${minimum}.`;
    throw seatError('SEATS_BELOW_MINIMUM', message, { minimum, currentSeats, used, reserved });
  }
  return minimum;
}

/**
 * An existing team's checkout must cover every seat its members and pending invitations already hold.
 * Nothing is included before the team's first subscription, so usage alone sets the floor.
 */
export async function assertCheckoutSeatsCoverUsage({ teamId, seats }: { teamId: string; seats: number }): Promise<void> {
  const {
    seats: { used, reserved },
  } = await getTeamSeatSummary(prisma, { teamId });
  const minimum = getMinimumSeats({ used, reserved, includedSeats: null });
  if (seats < minimum) {
    throw seatError(
      'SEATS_BELOW_MINIMUM',
      `Your team needs at least ${minimum} seats: ${used} in use and ${reserved} reserved by pending invitations.`,
      { minimum, used, reserved },
    );
  }
}

export async function previewSeatChange({ teamId, seats }: { teamId: string; seats: number }): Promise<TeamSeatChangePreview> {
  const context = await loadSeatContext(teamId);
  const {
    seats: { used, reserved },
  } = await getTeamSeatSummary(prisma, { teamId });

  const changeType = classifyChange(context, seats);
  const minimumSeats = assertSeatCountCoversMinimum({
    requested: seats,
    used,
    reserved,
    includedSeats: context.seatState.includedSeats,
    currentSeats: context.effectiveSeats,
  });

  const now = new Date();
  const prorationDate = changeType === 'INCREASE' ? getUnixTime(now) : null;
  const { nextInvoiceAmount, amountDueNow } = await stripeSeatsService.previewTeamSeatChange({
    customerId: context.customerId,
    subscriptionId: context.subscription.id,
    subscriptionItemId: context.item.id,
    quantity: seats,
    prorationDate,
  });

  const { pending, periodEnd } = context.seatState;
  return {
    changeType,
    currentSeats: context.effectiveSeats,
    requestedSeats: seats,
    minimumSeats,
    amountDueNow,
    prorationDate,
    nextInvoice: { amount: nextInvoiceAmount, date: formatISO(periodEnd) },
    interval: context.interval,
    effectiveAt: formatISO(changeType === 'DECREASE' ? periodEnd : now),
    replacesPendingDecrease: pending ? { seats: pending.quantity, effectiveAt: formatISO(pending.effectiveAt) } : null,
    hasDiscount: context.hasDiscount,
  };
}

/**
 * The proration date is echoed back from a preview this server issued, so it can only be in the past.
 * A future one would let a caller push Stripe's proration window forward and pay less for seats they
 * receive immediately, so it is bounded on both sides.
 */
function assertProrationDateIsFresh(prorationDate: number | null | undefined, context: SeatContext): asserts prorationDate is number {
  const ageMs = prorationDate ? Date.now() - prorationDate * 1000 : Number.POSITIVE_INFINITY;
  const isExpired = ageMs > PREVIEW_VALIDITY_MS || ageMs < -PRORATION_CLOCK_SKEW_MS;
  const isOutsideCurrentPeriod =
    !!prorationDate && (prorationDate < context.item.current_period_start || prorationDate > context.item.current_period_end);
  if (isExpired || isOutsideCurrentPeriod) {
    throw seatError('PREVIEW_EXPIRED', 'The preview has expired. Review the updated preview and try again.');
  }
}

type PendingDecrease = NonNullable<TeamSeatState['pending']>;

/**
 * Releases the pending decrease schedule and clears the mirrored fields, returning what was pending so
 * the caller can restore it if the change that replaces it fails. A no-op without a pending decrease.
 *
 * `keepReservation` leaves the reserved seat count untouched for a caller whose own Stripe call is still
 * ahead of it, whether that call writes a replacement decrease or raises the quantity. Clearing it here
 * would drop the enforced cap back to the purchased count for the duration of that call, letting a
 * concurrent invite take a seat the team does not have if the call then fails and the decrease is put back.
 */
async function releasePendingDecrease(context: SeatContext, { keepReservation = false } = {}): Promise<PendingDecrease | null> {
  const { pending } = context.seatState;
  if (!pending) {
    return null;
  }
  await stripeSeatsService.releaseTeamSeatSchedule(pending.scheduleId);
  if (keepReservation) {
    await subscriptionDbService.clearSeatScheduleId({ teamId: context.teamId });
  } else {
    await subscriptionDbService.clearPendingSeatDecrease({ teamId: context.teamId });
  }
  return pending;
}

/**
 * Puts a released decrease back after the change that replaced it failed, so a declined card never
 * silently discards a decrease the customer had already scheduled. Failure here is logged rather than
 * thrown: the original error is the one the admin needs to see.
 */
async function restorePendingDecrease({ context, pending }: { context: SeatContext; pending: PendingDecrease }): Promise<void> {
  try {
    const schedule = await stripeSeatsService.scheduleTeamSeatDecrease({
      teamId: context.teamId,
      subscription: context.subscription,
      item: context.item,
      quantity: pending.quantity,
    });
    await subscriptionDbService.setPendingSeatDecrease({
      teamId: context.teamId,
      quantity: pending.quantity,
      effectiveAt: pending.effectiveAt,
      scheduleId: schedule.id,
    });
  } catch (ex) {
    logger.error(
      { teamId: context.teamId, previousScheduleId: pending.scheduleId, quantity: pending.quantity, ...getErrorMessageAndStackObj(ex) },
      'Unable to restore the pending seat decrease after a failed seat change',
    );
  }
}

/** Recorded only once the change that replaced the decrease has succeeded. */
function logPendingDecreaseCancelled({
  context,
  pending,
  runningUserId,
}: {
  context: SeatContext;
  pending: PendingDecrease;
  runningUserId: string;
}): void {
  createTeamAuditLog({
    userId: runningUserId,
    teamId: context.teamId,
    action: AuditLogAction.TEAM_SEATS_DECREASE_CANCELLED,
    resource: AuditLogResource.TEAM_SEATS,
    resourceId: context.teamId,
    metadata: {
      previousSeats: pending.quantity,
      newSeats: context.effectiveSeats,
      effectiveAt: formatISO(new Date()),
      scheduleId: pending.scheduleId,
    },
  });
}

async function applySeatIncrease({
  context,
  seats,
  prorationDate,
  runningUserId,
}: {
  context: SeatContext;
  seats: number;
  prorationDate: number | null | undefined;
  runningUserId: string;
}): Promise<TeamSeatChangeResult> {
  assertProrationDateIsFresh(prorationDate, context);
  // Stripe refuses direct updates while a schedule manages the subscription, so the pending decrease goes
  // first. Its reserved cap stays in force until the increase has actually landed: the re-sync afterwards
  // clears it on success, and a declined payment restores the decrease it belonged to.
  const releasedDecrease = await releasePendingDecrease(context, { keepReservation: true });
  try {
    await stripeSeatsService.commitTeamSeatIncrease({ subscriptionItemId: context.item.id, quantity: seats, prorationDate });
  } catch (ex) {
    if (releasedDecrease) {
      await restorePendingDecrease({ context, pending: releasedDecrease });
    }
    if (stripeSeatsService.isStripeCardError(ex)) {
      const { message, declineCode } = stripeSeatsService.getStripeErrorDetails(ex);
      throw seatError('PAYMENT_FAILED', `Payment failed: ${message} Update your payment method in the billing portal and try again.`, {
        declineCode,
        stripeMessage: message,
      });
    }
    if (stripeSeatsService.isProrationDateError(ex)) {
      throw seatError('PREVIEW_EXPIRED', 'The preview has expired. Review the updated preview and try again.');
    }
    throw ex;
  }
  if (releasedDecrease) {
    logPendingDecreaseCancelled({ context, pending: releasedDecrease, runningUserId });
  }
  // Stripe has already applied and charged the increase, so a failed invoice lookup must not turn a
  // completed billing operation into an error the admin would retry
  const invoice = await stripeSeatsService.fetchLatestInvoiceForSubscription(context.subscription.id).catch((ex) => {
    logger.warn({ teamId: context.teamId, ...getErrorMessageAndStackObj(ex) }, 'Unable to load the invoice for a completed seat increase');
    return null;
  });
  return { changeType: 'INCREASE', seats, effectiveAt: formatISO(new Date()), invoice };
}

async function applySeatDecrease({
  context,
  seats,
  runningUserId,
}: {
  context: SeatContext;
  seats: number;
  runningUserId: string;
}): Promise<TeamSeatChangeResult> {
  // Only one schedule can manage a subscription, so a different pending target is replaced. The
  // reservation `commitSeatChange` wrote under the lock survives the swap so the lower cap keeps
  // being enforced while Stripe is called.
  const releasedDecrease = await releasePendingDecrease(context, { keepReservation: true });
  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripeSeatsService.scheduleTeamSeatDecrease({
      teamId: context.teamId,
      subscription: context.subscription,
      item: context.item,
      quantity: seats,
    });
  } catch (ex) {
    if (releasedDecrease) {
      await restorePendingDecrease({ context, pending: releasedDecrease });
    }
    throw ex;
  }
  const effectiveAt = context.seatState.periodEnd;
  await subscriptionDbService.setPendingSeatDecrease({ teamId: context.teamId, quantity: seats, effectiveAt, scheduleId: schedule.id });
  if (releasedDecrease) {
    logPendingDecreaseCancelled({ context, pending: releasedDecrease, runningUserId });
  }
  createTeamAuditLog({
    userId: runningUserId,
    teamId: context.teamId,
    action: AuditLogAction.TEAM_SEATS_DECREASE_SCHEDULED,
    resource: AuditLogResource.TEAM_SEATS,
    resourceId: context.teamId,
    metadata: { previousSeats: context.effectiveSeats, newSeats: seats, effectiveAt: formatISO(effectiveAt), scheduleId: schedule.id },
  });
  return { changeType: 'DECREASE', seats, effectiveAt: formatISO(effectiveAt), invoice: null };
}

async function applySeatChange({
  context,
  changeType,
  seats,
  prorationDate,
  runningUserId,
}: {
  context: SeatContext;
  changeType: TeamSeatChangeType;
  seats: number;
  prorationDate: number | null | undefined;
  runningUserId: string;
}): Promise<TeamSeatChangeResult> {
  switch (changeType) {
    case 'INCREASE':
      return await applySeatIncrease({ context, seats, prorationDate, runningUserId });
    case 'DECREASE':
      return await applySeatDecrease({ context, seats, runningUserId });
    case 'CANCEL_PENDING_DECREASE': {
      const releasedDecrease = await releasePendingDecrease(context);
      if (releasedDecrease) {
        logPendingDecreaseCancelled({ context, pending: releasedDecrease, runningUserId });
      }
      return { changeType, seats, effectiveAt: formatISO(new Date()), invoice: null };
    }
    case 'NONE':
    default:
      throw noChangeError(context);
  }
}

/** Mirror Stripe into the database so the response is correct without waiting for the webhook. */
async function resynchronizeSeatState(context: SeatContext): Promise<void> {
  const customer = await stripeService.fetchCustomerWithSubscriptionsById({ customerId: context.customerId });
  await stripeService.saveOrUpdateSubscription({ customer, sendWelcomeEmail: false });
}

/**
 * Apply a previewed seat change. Usage is re-validated under the team row lock so the count cannot be
 * committed below what the team uses at that instant. Stripe is called after the lock is released, so a
 * decrease first records its target under the lock: membership checks that run while Stripe is being
 * called already count against the lower cap rather than the old one. The database is re-synchronized
 * from Stripe afterwards, on success and on failure alike, which also undoes that reservation when
 * Stripe rejected the change.
 */
export async function commitSeatChange({
  teamId,
  seats,
  expectedCurrentSeats,
  prorationDate,
  runningUserId,
}: {
  teamId: string;
  seats: number;
  expectedCurrentSeats: number;
  prorationDate?: number | null;
  runningUserId: string;
}): Promise<TeamSeatUpdateResponse> {
  const context = await loadSeatContext(teamId);
  if (expectedCurrentSeats !== context.effectiveSeats) {
    throw seatError('STALE_PREVIEW', "Your team's seat count changed since the preview. Review the updated preview and try again.", {
      currentSeats: context.effectiveSeats,
    });
  }
  const changeType = classifyChange(context, seats);
  if (changeType === 'NONE') {
    throw noChangeError(context);
  }

  await withTeamSeatLock(teamId, async (tx) => {
    const {
      seats: { used, reserved },
    } = await getTeamSeatSummary(tx, { teamId });
    assertSeatCountCoversMinimum({
      requested: seats,
      used,
      reserved,
      includedSeats: context.seatState.includedSeats,
      currentSeats: context.effectiveSeats,
    });
    if (changeType === 'DECREASE') {
      await subscriptionDbService.reservePendingSeatDecrease(tx, { teamId, quantity: seats, effectiveAt: context.seatState.periodEnd });
    }
  });

  let result: TeamSeatChangeResult;
  try {
    result = await applySeatChange({ context, changeType, seats, prorationDate, runningUserId });
  } catch (ex) {
    // A partial change (e.g. schedule released, then payment declined) must still be reflected locally
    await resynchronizeSeatState(context).catch((syncError) => {
      logger.warn({ teamId, ...getErrorMessageAndStackObj(syncError) }, 'Unable to re-synchronize seat state after a failed seat change');
    });
    throw ex;
  }

  // Stripe has already applied and charged the change, so a failed mirror must not be reported as a
  // failed seat change. The team reads slightly stale until the subscription webhook re-synchronizes it
  await resynchronizeSeatState(context).catch((syncError) => {
    logger.warn({ teamId, ...getErrorMessageAndStackObj(syncError) }, 'Unable to re-synchronize seat state after a seat change');
  });
  const team = await teamDbService.findById({ teamId, runningUserId });
  return { team, result };
}

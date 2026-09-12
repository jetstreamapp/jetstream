import { logger, prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import {
  getTeamSeatSummary,
  SeatChangeValidation,
  summarizeSeats,
  validateRequestedSeatCount,
  withTeamSeatLock,
} from '@jetstream/team-seats';
import {
  MAX_TEAM_SEATS,
  TEAM_BILLING_STATUS_PAST_DUE,
  TeamSeatChangePreview,
  TeamSeatChangeResult,
  TeamSeatChangeType,
  TeamSeatErrorCode,
  TeamSeatSummary,
  TeamSeatUpdateResponse,
} from '@jetstream/types';
import { formatISO, getUnixTime } from 'date-fns';
import Stripe from 'stripe';
import type { TeamSeatState } from '../db/subscription.db';
import * as subscriptionDbService from '../db/subscription.db';
import * as teamDbService from '../db/team.db';
import { UserFacingError } from '../utils/error-handler';
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
  billingStatus: string;
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
    throw seatError('SEATS_PAST_DUE', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  if (billingAccount.manualBilling) {
    throw seatError('SEATS_MANUAL_BILLING', 'Seats for this team are set by your billing agreement. Contact support to change them.');
  }
  if (team.billingStatus === TEAM_BILLING_STATUS_PAST_DUE) {
    throw seatError('SEATS_PAST_DUE', 'Your account is past due. Resolve the outstanding invoice before changing seats.');
  }

  const customer = await stripeService.fetchCustomerWithSubscriptionsById({ customerId: billingAccount.customerId });
  if (customer.deleted) {
    throw seatError('SEATS_PAST_DUE', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  const subscriptions = stripeService.filterInactiveSubscriptions(customer.subscriptions?.data ?? []);
  const seatItem = stripeService.findTeamSeatItem(subscriptions);
  if (!seatItem) {
    throw seatError('SEATS_PAST_DUE', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
  }
  const { subscription, item } = seatItem;
  if (subscription.cancel_at_period_end || subscription.cancel_at) {
    throw seatError(
      'SEATS_SUBSCRIPTION_CANCELING',
      'Your subscription is set to cancel, so seats cannot be changed. Resume it from the billing portal first.',
    );
  }

  const seatState = await stripeService.resolveTeamSeatState(subscriptions);
  if (!seatState) {
    throw seatError('SEATS_PAST_DUE', NO_ACTIVE_SUBSCRIPTION_MESSAGE);
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
    billingStatus: team.billingStatus,
    customer,
    subscription,
    item,
    seatState,
    effectiveSeats: subscriptionDbService.getPurchasedSeatCount(seatState),
    interval: item.price.recurring?.interval === 'year' ? 'YEAR' : 'MONTH',
    hasDiscount: Boolean(customer.discount || subscription.discounts.length > 0),
  };
}

function classifyChange({
  requested,
  effectiveSeats,
  seatState,
}: Pick<SeatContext, 'effectiveSeats' | 'seatState'> & { requested: number }): TeamSeatChangeType {
  if (requested > effectiveSeats) {
    return 'INCREASE';
  }
  if (requested < effectiveSeats) {
    return 'DECREASE';
  }
  return seatState.pending ? 'CANCEL_PENDING_DECREASE' : 'NONE';
}

/** Lowest count the team can move to: what is in use, what the plan includes, and never below one. */
function getMinimumSeats(context: SeatContext, usage: TeamSeatSummary): number {
  return Math.max(context.seatState.includedSeats, usage.used + usage.reserved, 1);
}

/**
 * Validation reads Stripe's live seat state rather than the mirrored columns so a lagging sync can
 * never approve a change against stale numbers.
 */
function validateSeatRequest({
  context,
  usage,
  requested,
}: {
  context: SeatContext;
  usage: TeamSeatSummary;
  requested: number;
}): SeatChangeValidation {
  const { pending, includedSeats } = context.seatState;
  return validateRequestedSeatCount({
    requested,
    seats: summarizeSeats({
      purchasedSeats: context.effectiveSeats,
      pendingSeats: pending?.quantity ?? null,
      pendingEffectiveAt: pending?.effectiveAt ?? null,
      usedSeats: usage.used,
      reservedSeats: usage.reserved,
      includedSeats,
    }),
    billingStatus: context.billingStatus,
    manualBilling: false,
    includedSeats,
  });
}

function throwSeatRejection(
  validation: Extract<SeatChangeValidation, { ok: false }>,
  { context, usage, minimumSeats }: { context: SeatContext; usage: TeamSeatSummary; minimumSeats: number },
): never {
  const detail = { minimum: minimumSeats, currentSeats: context.effectiveSeats, used: usage.used, reserved: usage.reserved };
  switch (validation.code) {
    case 'MANUAL_BILLING':
      throw seatError('SEATS_MANUAL_BILLING', 'Seats for this team are set by your billing agreement. Contact support to change them.');
    case 'PAST_DUE':
      throw seatError('SEATS_PAST_DUE', 'Your account is past due. Resolve the outstanding invoice before changing seats.');
    case 'MAX_SEATS':
      throw new UserFacingError(`A team cannot have more than ${MAX_TEAM_SEATS} seats. Contact support for a larger plan.`, {
        maximum: MAX_TEAM_SEATS,
      });
    case 'BELOW_USAGE':
      throw seatError(
        'SEATS_BELOW_MINIMUM',
        `Your team needs at least ${minimumSeats} seats: ${usage.used} in use and ${usage.reserved} reserved by pending invitations. Deactivate members or cancel invitations first.`,
        detail,
      );
    case 'BELOW_INCLUDED':
      throw seatError(
        'SEATS_BELOW_MINIMUM',
        `Your plan includes ${context.seatState.includedSeats} seats, so the seat count cannot go below ${minimumSeats}.`,
        detail,
      );
    case 'NO_CHANGE':
      throw new UserFacingError(`No change: your team already has ${context.effectiveSeats} seats.`, { changeType: 'NONE', ...detail });
    case 'MIN_SEATS':
    default:
      throw seatError('SEATS_BELOW_MINIMUM', `Your team needs at least ${minimumSeats} seats.`, detail);
  }
}

export async function previewSeatChange({ teamId, seats }: { teamId: string; seats: number }): Promise<TeamSeatChangePreview> {
  const context = await loadSeatContext(teamId);
  const { seats: usage } = await getTeamSeatSummary(prisma, { teamId });
  const minimumSeats = getMinimumSeats(context, usage);

  let changeType = classifyChange({ requested: seats, effectiveSeats: context.effectiveSeats, seatState: context.seatState });
  const validation = validateSeatRequest({ context, usage, requested: seats });
  if (!validation.ok) {
    if (validation.code !== 'NO_CHANGE') {
      throwSeatRejection(validation, { context, usage, minimumSeats });
    }
    changeType = 'NONE';
  }

  const now = new Date();
  const prorationDate = changeType === 'INCREASE' ? getUnixTime(now) : null;
  const { nextInvoiceAmount, amountDueNow } = await stripeService.previewTeamSeatChange({
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
 */
async function releasePendingDecrease(context: SeatContext): Promise<PendingDecrease | null> {
  const { pending } = context.seatState;
  if (!pending) {
    return null;
  }
  await stripeService.releaseTeamSeatSchedule(pending.scheduleId);
  await subscriptionDbService.clearPendingSeatDecrease({ teamId: context.teamId });
  return pending;
}

/**
 * Puts a released decrease back after the change that replaced it failed, so a declined card never
 * silently discards a decrease the customer had already scheduled. Failure here is logged rather than
 * thrown: the original error is the one the admin needs to see.
 */
async function restorePendingDecrease({ context, pending }: { context: SeatContext; pending: PendingDecrease }): Promise<void> {
  try {
    const schedule = await stripeService.scheduleTeamSeatDecrease({
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
  // Stripe refuses direct updates while a schedule manages the subscription, so the pending decrease goes first
  const releasedDecrease = await releasePendingDecrease(context);
  try {
    await stripeService.commitTeamSeatIncrease({ subscriptionItemId: context.item.id, quantity: seats, prorationDate });
  } catch (ex) {
    if (releasedDecrease) {
      await restorePendingDecrease({ context, pending: releasedDecrease });
    }
    if (stripeService.isStripeCardError(ex)) {
      const { message, declineCode } = stripeService.getStripeErrorDetails(ex);
      throw seatError('PAYMENT_FAILED', `Payment failed: ${message} Update your payment method in the billing portal and try again.`, {
        declineCode,
        stripeMessage: message,
      });
    }
    if (stripeService.isProrationDateError(ex)) {
      throw seatError('PREVIEW_EXPIRED', 'The preview has expired. Review the updated preview and try again.');
    }
    throw ex;
  }
  if (releasedDecrease) {
    logPendingDecreaseCancelled({ context, pending: releasedDecrease, runningUserId });
  }
  const invoice = await stripeService.fetchLatestInvoiceForSubscription(context.subscription.id);
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
  // Only one schedule can manage a subscription, so a different pending target is replaced
  const releasedDecrease = await releasePendingDecrease(context);
  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripeService.scheduleTeamSeatDecrease({
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
      throw new UserFacingError(`No change: your team already has ${context.effectiveSeats} seats.`, { changeType: 'NONE' });
  }
}

/** Mirror Stripe into the database so the response is correct without waiting for the webhook. */
async function resynchronizeSeatState(context: SeatContext): Promise<void> {
  const customer = await stripeService.fetchCustomerWithSubscriptionsById({ customerId: context.customerId });
  await stripeService.saveOrUpdateSubscription({ customer, sendWelcomeEmail: false });
}

/**
 * Apply a previewed seat change. Usage is re-validated under the team row lock so an invite landing
 * at the same moment cannot push usage past the new count; Stripe is called outside the lock and the
 * database is re-synchronized from Stripe afterwards, on success and on failure alike.
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
  const changeType = classifyChange({ requested: seats, effectiveSeats: context.effectiveSeats, seatState: context.seatState });

  await withTeamSeatLock(teamId, async (tx) => {
    const { seats: usage } = await getTeamSeatSummary(tx, { teamId });
    const validation = validateSeatRequest({ context, usage, requested: seats });
    if (!validation.ok) {
      throwSeatRejection(validation, { context, usage, minimumSeats: getMinimumSeats(context, usage) });
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

  await resynchronizeSeatState(context);
  const team = await teamDbService.findById({ teamId, runningUserId });
  return { team, result };
}

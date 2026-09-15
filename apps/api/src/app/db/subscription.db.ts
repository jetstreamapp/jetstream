import { prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { Prisma } from '@jetstream/prisma';
import { getPurchasedSeatCount } from '@jetstream/shared/utils';
import { getTeamSeatSummary, withTeamSeatLock } from '@jetstream/team-seats';
import {
  EntitlementsAccess,
  EntitlementsAccessSchema,
  TEAM_BILLING_STATUS_PAST_DUE,
  TeamBillingStatus,
  TeamSeatSummary,
} from '@jetstream/types';
import Stripe from 'stripe';
import { resolveActiveTeamIdForUser } from './feature-flags.db';

const SELECT = {
  id: true,
  customerId: true,
  subscriptionId: true,
  status: true,
  priceId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

const TEAM_SEAT_BILLING_ACCOUNT_SELECT = {
  customerId: true,
  manualBilling: true,
  licenseCountLimit: true,
  seatQuantity: true,
  includedSeats: true,
  seatSubscriptionItemId: true,
  seatPeriodEnd: true,
  pendingSeatQuantity: true,
  pendingSeatEffectiveAt: true,
  seatScheduleId: true,
} satisfies Prisma.TeamBillingAccountSelect;

export type TeamSeatBillingAccount = Prisma.TeamBillingAccountGetPayload<{ select: typeof TEAM_SEAT_BILLING_ACCOUNT_SELECT }>;

/**
 * Seat state resolved from the Stripe TEAM_ subscription item and the schedule attached to its
 * subscription; null when the customer has no active team item.
 */
export interface TeamSeatState {
  subscriptionItemId: string;
  quantity: number;
  /** Seats the price covers with its flat first tier (legacy plans include 5); 0 for per-seat pricing */
  includedSeats: number;
  periodEnd: Date;
  /** Decrease scheduled with Stripe for the end of the current period */
  pending: { quantity: number; effectiveAt: Date; scheduleId: string } | null;
  /** A schedule Jetstream did not create; seat changes are blocked until it is gone */
  foreignScheduleId: string | null;
}

export const findByUserId = async (userId: string) => {
  return await prisma.subscription.findMany({ where: { userId, status: 'ACTIVE' }, select: SELECT });
};

export const findById = async ({ id, userId }: { id: string; userId: string }) => {
  return await prisma.subscription.findUniqueOrThrow({ where: { id, userId }, select: SELECT });
};

export const findSubscriptionsByCustomerId = async ({
  customerId,
  status,
}: {
  customerId: string;
  status?: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'PAUSED';
}) => {
  return await prisma.subscription.findMany({ where: { customerId, status }, select: SELECT });
};

export const updateUserEntitlements = async (customerId: string, entitlementAccessUntrusted: EntitlementsAccess) => {
  const entitlementAccess = EntitlementsAccessSchema.parse(entitlementAccessUntrusted);
  const user = await prisma.user.findFirstOrThrow({
    where: { billingAccount: { customerId } },
    select: { id: true },
  });

  await prisma.entitlement.upsert({
    create: {
      userId: user.id,
      ...entitlementAccess,
    },
    update: entitlementAccess,
    where: { userId: user.id },
  });
};

/**
 * Force-grant only the Analysis Tools entitlement to a user, leaving the other entitlement flags
 * untouched. Intended for test setup so the flag-gated, paid-only Analysis Tools render as usable
 * (unlocked) without provisioning a full paid subscription.
 *
 * When the user belongs to an active team, the user profile reads TEAM entitlements (see
 * `getUserProfileUi`), so a user-level grant alone is ignored for team members. Grant it on the active
 * team too so the tools render unlocked regardless of whether the user is on a team.
 */
export const grantAnalysisToolsEntitlementForUser = async (userId: string): Promise<void> => {
  await prisma.entitlement.upsert({
    create: { userId, analysisTools: true },
    update: { analysisTools: true },
    where: { userId },
  });

  const activeTeamId = await resolveActiveTeamIdForUser(userId);
  if (activeTeamId) {
    await prisma.teamEntitlement.upsert({
      create: { teamId: activeTeamId, analysisTools: true },
      update: { analysisTools: true },
      where: { teamId: activeTeamId },
    });
  }
};

export const updateTeamEntitlements = async (customerId: string, entitlementAccessUntrusted: EntitlementsAccess) => {
  const entitlementAccess = EntitlementsAccessSchema.parse(entitlementAccessUntrusted);
  const team = await prisma.team.findFirstOrThrow({
    where: { billingAccount: { customerId } },
    select: { id: true },
  });

  await prisma.teamEntitlement.upsert({
    create: {
      teamId: team.id,
      ...entitlementAccess,
    },
    update: entitlementAccess,
    where: { teamId: team.id },
  });
};

/**
 * Given a customer's current subscriptions, cancel all other subscriptions, create any needed subscriptions, and update the subscription state
 * In addition, entitlements are also updated to reflect the user's current subscription state
 */
export const updateSubscriptionStateForCustomer = async ({
  userId,
  customerId,
  subscriptions,
}: {
  userId: string;
  customerId: string;
  subscriptions: Stripe.Subscription[];
}) => {
  const priceIds = subscriptions.flatMap((subscription) => subscription.items.data.map((item) => item.price.id));

  await prisma.$transaction([
    // Delete all subscriptions that are no longer active in Stripe
    prisma.subscription.deleteMany({
      where: { userId, customerId, priceId: { notIn: priceIds } },
    }),
    // Create/Update all current subscriptions from Stripe
    ...subscriptions.flatMap((subscription) =>
      subscription.items.data.map((item) =>
        prisma.subscription.upsert({
          create: {
            userId,
            subscriptionId: subscription.id,
            status: subscription.status.toUpperCase(),
            customerId,
            priceId: item.price.id,
          },
          update: { status: subscription.status.toUpperCase() },
          where: { uniqueSubscription: { userId, subscriptionId: subscription.id, priceId: item.price.id } },
        }),
      ),
    ),
  ]);
};

/**
 * ************************************
 * Team seats
 * ************************************
 */

/** Billing status plus the billing account columns that mirror Stripe's seat state. */
export const getTeamBillingAccountForSeats = async ({ teamId }: { teamId: string }) => {
  return await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { id: true, billingStatus: true, billingAccount: { select: TEAM_SEAT_BILLING_ACCOUNT_SELECT } },
  });
};

/** Current seat usage (active billable members and unexpired billable invitations) for a team. */
export const getTeamSeatUsage = async ({ teamId }: { teamId: string }): Promise<TeamSeatSummary> => {
  const { seats } = await getTeamSeatSummary(prisma, { teamId });
  return seats;
};

function areDatesEqual(left: Date | null, right: Date | null): boolean {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

/**
 * Whether the mirrored seat columns already reflect Stripe. Manual-billing teams keep a hand-set cap
 * that sync never touches, so they are always in sync. Without an active team item the mirrors are
 * expected to be empty while `licenseCountLimit` keeps its last value.
 */
export function isTeamSeatStateInSync(billingAccount: TeamSeatBillingAccount | null, seatState: TeamSeatState | null): boolean {
  if (!billingAccount || billingAccount.manualBilling) {
    return true;
  }
  const isMirrorInSync =
    billingAccount.seatQuantity === (seatState?.quantity ?? null) &&
    billingAccount.includedSeats === (seatState?.includedSeats ?? 0) &&
    billingAccount.seatSubscriptionItemId === (seatState?.subscriptionItemId ?? null) &&
    areDatesEqual(billingAccount.seatPeriodEnd, seatState?.periodEnd ?? null) &&
    billingAccount.pendingSeatQuantity === (seatState?.pending?.quantity ?? null) &&
    areDatesEqual(billingAccount.pendingSeatEffectiveAt, seatState?.pending?.effectiveAt ?? null) &&
    billingAccount.seatScheduleId === (seatState?.pending?.scheduleId ?? null);
  if (!isMirrorInSync) {
    return false;
  }
  return seatState ? billingAccount.licenseCountLimit === getPurchasedSeatCount(seatState) : true;
}

function buildSeatFieldWrites(seatState: TeamSeatState | null): Prisma.TeamBillingAccountUpdateInput {
  if (!seatState) {
    return {
      seatQuantity: null,
      includedSeats: 0,
      seatSubscriptionItemId: null,
      seatPeriodEnd: null,
      pendingSeatQuantity: null,
      pendingSeatEffectiveAt: null,
      seatScheduleId: null,
    };
  }
  return {
    seatQuantity: seatState.quantity,
    includedSeats: seatState.includedSeats,
    seatSubscriptionItemId: seatState.subscriptionItemId,
    seatPeriodEnd: seatState.periodEnd,
    pendingSeatQuantity: seatState.pending?.quantity ?? null,
    pendingSeatEffectiveAt: seatState.pending?.effectiveAt ?? null,
    seatScheduleId: seatState.pending?.scheduleId ?? null,
    licenseCountLimit: getPurchasedSeatCount(seatState),
  };
}

export const setPendingSeatDecrease = async ({
  teamId,
  quantity,
  effectiveAt,
  scheduleId,
}: {
  teamId: string;
  quantity: number;
  effectiveAt: Date;
  scheduleId: string;
}) => {
  return await prisma.teamBillingAccount.update({
    where: { teamId },
    data: { pendingSeatQuantity: quantity, pendingSeatEffectiveAt: effectiveAt, seatScheduleId: scheduleId },
  });
};

/**
 * Records the target of a decrease before Stripe has scheduled it. Written under the team seat lock so
 * membership checks that run while Stripe is being called already count against the lower cap; the
 * schedule id follows once Stripe returns, and a failed call is undone by re-synchronizing from Stripe.
 */
export const reservePendingSeatDecrease = async (
  tx: Prisma.TransactionClient,
  { teamId, quantity, effectiveAt }: { teamId: string; quantity: number; effectiveAt: Date },
) => {
  return await tx.teamBillingAccount.update({
    where: { teamId },
    data: { pendingSeatQuantity: quantity, pendingSeatEffectiveAt: effectiveAt },
  });
};

export const clearPendingSeatDecrease = async ({ teamId }: { teamId: string }) => {
  return await prisma.teamBillingAccount.update({
    where: { teamId },
    data: { pendingSeatQuantity: null, pendingSeatEffectiveAt: null, seatScheduleId: null },
  });
};

/**
 * Drops the schedule pointer while leaving the reserved seat count in place, for a caller that is
 * replacing one pending decrease with another: the released schedule must never be referenced again,
 * but the lower cap has to stay enforced across the Stripe calls that write the replacement.
 */
export const clearSeatScheduleId = async ({ teamId }: { teamId: string }) => {
  return await prisma.teamBillingAccount.update({
    where: { teamId },
    data: { seatScheduleId: null },
  });
};

/**
 * Given a customer's current subscriptions, cancel all other subscriptions, create any needed subscriptions, and update the subscription state
 * In addition, entitlements are also updated to reflect the user's current subscription state
 *
 * Runs under the team seat lock so a period-end decrease lands atomically with respect to invites:
 * an invite cannot count seats against a cap that is being lowered in the same instant.
 */
export const updateTeamSubscriptionStateForCustomer = async ({
  teamId,
  customerId,
  subscriptions,
  seatState,
}: {
  teamId: string;
  customerId: string;
  subscriptions: Stripe.Subscription[];
  seatState: TeamSeatState | null;
}) => {
  const priceIds = subscriptions.flatMap((subscription) => subscription.items.data.map((item) => item.price.id));

  /**
   * Calculate team billing status and update it
   * ACTIVE = has active subscriptions and none are past_due
   * PAST_DUE = has no active subscriptions or any are past_due
   * MANUAL = manual billing is enabled (subscription state is ignored)
   */
  const hasSubscriptions = subscriptions.length > 0;
  const isPastDue = subscriptions.some(({ status }) => status === 'past_due');

  const appliedDecrease = await withTeamSeatLock(teamId, async (tx) => {
    const team = await tx.team.findFirstOrThrow({
      where: { id: teamId },
      select: {
        id: true,
        billingAccount: { select: { manualBilling: true, licenseCountLimit: true, seatScheduleId: true } },
      },
    });
    let teamBillingStatus: TeamBillingStatus = 'ACTIVE';
    if (team.billingAccount?.manualBilling) {
      teamBillingStatus = 'MANUAL';
    } else if (!hasSubscriptions || isPastDue) {
      teamBillingStatus = 'PAST_DUE';
    }

    // Delete all subscriptions that are no longer active in Stripe
    await tx.teamSubscription.deleteMany({
      where: { teamId, customerId, priceId: { notIn: priceIds } },
    });
    // Create/Update all current subscriptions from Stripe
    for (const subscription of subscriptions) {
      for (const item of subscription.items.data) {
        await tx.teamSubscription.upsert({
          create: {
            teamId,
            subscriptionId: subscription.id,
            status: subscription.status.toUpperCase(),
            customerId,
            priceId: item.price.id,
          },
          update: { status: subscription.status.toUpperCase() },
          where: { uniqueSubscription: { teamId, subscriptionId: subscription.id, priceId: item.price.id } },
        });
      }
    }
    await tx.team.update({
      data: { billingStatus: teamBillingStatus },
      where: { id: teamId },
    });

    // Manual-billing teams keep their hand-set cap; Stripe never dictates their seats
    if (!team.billingAccount || team.billingAccount.manualBilling) {
      return null;
    }
    await tx.teamBillingAccount.update({ where: { teamId }, data: buildSeatFieldWrites(seatState) });

    const previousLimit = team.billingAccount.licenseCountLimit;
    const newLimit = seatState ? getPurchasedSeatCount(seatState) : null;
    if (previousLimit !== null && newLimit !== null && newLimit < previousLimit) {
      return { previousSeats: previousLimit, newSeats: newLimit, scheduleId: team.billingAccount.seatScheduleId };
    }
    return null;
  });

  // Logged after the transaction commits: the audit helper writes with the global client, so logging inside
  // the callback would record a decrease that was then rolled back
  if (appliedDecrease) {
    createTeamAuditLog({
      teamId,
      action: AuditLogAction.TEAM_SEATS_DECREASE_APPLIED,
      resource: AuditLogResource.TEAM_SEATS,
      resourceId: teamId,
      metadata: appliedDecrease,
    });
  }
};

export const cancelAllSubscriptionsForUser = async ({ customerId }: { customerId: string }) => {
  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { customerId },
      data: { status: 'CANCELED' },
    }),
    prisma.teamSubscription.updateMany({
      where: { customerId },
      data: { status: 'CANCELED' },
    }),
    // A deleted customer has no subscription left for a scheduled decrease to apply to
    prisma.teamBillingAccount.updateMany({
      where: { customerId },
      data: { pendingSeatQuantity: null, pendingSeatEffectiveAt: null, seatScheduleId: null },
    }),
    // Same standing a team gets when its subscriptions go away: without it the team keeps its old
    // seat cap and every membership path would go on granting billable seats with no Stripe customer
    prisma.team.updateMany({
      where: { billingAccount: { customerId, manualBilling: false } },
      data: { billingStatus: TEAM_BILLING_STATUS_PAST_DUE },
    }),
  ]);
};

import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { PrismaClient } from '@jetstream/prisma';
import { getErrorMessageAndStackObj, getIncludedSeatsFromPriceTiers } from '@jetstream/shared/utils';
import { BILLABLE_ROLES, TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import type { Logger } from 'pino';
import type Stripe from 'stripe';

const PAGE_SIZE = 100;
const TEAM_PRICE_LOOKUP_KEY_PREFIX = 'TEAM_';
/**
 * Subscription states that still entitle the team to its seats. Deliberately wider than the API's
 * `activeSubscriptionStatuses`, which excludes `past_due`: a past-due team keeps its seats until the
 * subscription actually cancels, and the backfill must give it a cap rather than skip it.
 */
const SEAT_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due', 'incomplete']);
const BILLABLE_ROLE_LIST = Array.from(BILLABLE_ROLES);

/**
 * The subset of the Stripe client the backfill touches, so tests can pass a plain object
 * and the real `Stripe` instance still satisfies it structurally.
 */
export interface SeatBackfillStripeClient {
  customers: {
    retrieve(customerId: string, params: { expand: string[] }): Promise<Stripe.Customer | Stripe.DeletedCustomer>;
  };
  prices: {
    retrieve(priceId: string, params: { expand: string[] }): Promise<Stripe.Price>;
  };
}

export type SeatBackfillLogger = Pick<Logger, 'info' | 'warn' | 'error'>;

export interface BackfillTeamSeatsResult {
  /** In dry-run mode `updated` is what the run *would* have written — nothing was persisted. */
  dryRun: boolean;
  scanned: number;
  updated: number;
  skipped: number;
  warnings: number;
  /** Teams whose Stripe lookup failed; the run continues so one bad customer does not hide the rest. */
  failures: number;
}

type TeamBillingAccountRow = Awaited<ReturnType<PrismaClient['teamBillingAccount']['findMany']>>[number];

interface SeatPriceTier {
  flatAmount: number | null;
  unitAmount: number | null;
  upTo: number | null;
}

function centsToDollars(cents: number | null | undefined): number | null {
  return typeof cents === 'number' ? cents / 100 : null;
}

function isDeletedCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.DeletedCustomer {
  return 'deleted' in customer && customer.deleted === true;
}

/**
 * Stripe omits `tiers` from the price embedded in a subscription item, so tiered prices are fetched
 * individually. A price's tier table cannot change after creation, which makes a per-run memo safe.
 */
function createPriceTiersLoader(stripe: SeatBackfillStripeClient) {
  const tiersByPriceId = new Map<string, Promise<SeatPriceTier[] | null>>();
  return (priceId: string): Promise<SeatPriceTier[] | null> => {
    let pending = tiersByPriceId.get(priceId);
    if (!pending) {
      pending = stripe.prices.retrieve(priceId, { expand: ['tiers'] }).then(({ tiers }) => {
        if (!tiers) {
          return null;
        }
        return tiers.map((tier) => ({
          flatAmount: centsToDollars(tier.flat_amount),
          unitAmount: centsToDollars(tier.unit_amount),
          upTo: tier.up_to,
        }));
      });
      tiersByPriceId.set(priceId, pending);
    }
    return pending;
  };
}

/** Every TEAM_ item across the customer's seat-granting subscriptions */
function findTeamSeatItems(subscriptions: Stripe.Subscription[]): { subscription: Stripe.Subscription; item: Stripe.SubscriptionItem }[] {
  return subscriptions
    .filter(({ status }) => SEAT_SUBSCRIPTION_STATUSES.has(status))
    .flatMap((subscription) =>
      subscription.items.data
        .filter(({ price }) => price.lookup_key?.startsWith(TEAM_PRICE_LOOKUP_KEY_PREFIX))
        .map((item) => ({ subscription, item })),
    );
}

/** Seats in use: active billable members plus unexpired billable invitations */
async function countSeatUsage(prisma: PrismaClient, teamId: string, now: Date): Promise<number> {
  const [activeBillableMembers, reservedInvitations] = await Promise.all([
    prisma.teamMember.count({ where: { teamId, status: TEAM_MEMBER_STATUS_ACTIVE, role: { in: BILLABLE_ROLE_LIST } } }),
    prisma.teamMemberInvitation.count({ where: { teamId, role: { in: BILLABLE_ROLE_LIST }, expiresAt: { gte: now } } }),
  ]);
  return activeBillableMembers + reservedInvitations;
}

async function backfillAccount({
  account,
  prisma,
  stripe,
  loadPriceTiers,
  dryRun,
  logger,
  result,
  now,
}: {
  account: TeamBillingAccountRow;
  prisma: PrismaClient;
  stripe: SeatBackfillStripeClient;
  loadPriceTiers: ReturnType<typeof createPriceTiersLoader>;
  dryRun: boolean;
  logger: SeatBackfillLogger;
  result: BackfillTeamSeatsResult;
  now: Date;
}) {
  const { teamId, customerId } = account;

  const customer = await stripe.customers.retrieve(customerId, { expand: ['subscriptions'] });
  if (isDeletedCustomer(customer)) {
    result.skipped++;
    logger.info({ teamId, customerId }, '[SKIP_NO_SUBSCRIPTION] Stripe customer is deleted');
    return;
  }

  const seatItems = findTeamSeatItems(customer.subscriptions?.data ?? []);
  if (seatItems.length === 0) {
    result.skipped++;
    logger.info({ teamId, customerId }, '[SKIP_NO_SUBSCRIPTION] No active TEAM_ subscription item');
    return;
  }
  // Matches the API: more than one TEAM_ item makes the seat state ambiguous, so no cap is written
  if (seatItems.length > 1) {
    result.skipped++;
    result.warnings++;
    logger.warn(
      { teamId, customerId, subscriptionItemIds: seatItems.map(({ item }) => item.id) },
      '[SKIP_AMBIGUOUS_SEAT_ITEM] Customer has more than one TEAM_ subscription item; seats must be set manually',
    );
    return;
  }

  const [{ subscription, item }] = seatItems;
  const quantity = item.quantity ?? 1;
  const tiers = await loadPriceTiers(item.price.id);
  const includedSeats = getIncludedSeatsFromPriceTiers(tiers);
  const desiredSeats = Math.max(quantity, includedSeats);

  if (subscription.schedule) {
    result.warnings++;
    logger.warn(
      { teamId, customerId, subscriptionId: subscription.id, scheduleId: subscription.schedule },
      '[WARN_SCHEDULE_PRESENT] Subscription has a schedule attached; pending seat fields are not written by the backfill and should be reviewed manually',
    );
  }

  const seatsInUse = await countSeatUsage(prisma, teamId, now);
  if (seatsInUse > desiredSeats) {
    result.warnings++;
    logger.warn(
      { teamId, customerId, seatsInUse, desiredSeats },
      '[USAGE_EXCEEDS_CAP] Active members and pending invitations exceed the purchased seats; the team will be over-allocated until usage fits',
    );
  }

  const isAlreadySynced =
    account.licenseCountLimit === desiredSeats && account.seatQuantity === quantity && account.seatSubscriptionItemId === item.id;
  if (isAlreadySynced) {
    result.skipped++;
    logger.info({ teamId, customerId, seats: desiredSeats }, '[SKIP_ALREADY_SYNCED] Seat fields already match Stripe');
    return;
  }

  const seatState = {
    seatQuantity: quantity,
    includedSeats,
    seatSubscriptionItemId: item.id,
    seatPeriodEnd: new Date(item.current_period_end * 1000),
    licenseCountLimit: desiredSeats,
  };
  const logContext = { teamId, customerId, previousLimit: account.licenseCountLimit, priceLookupKey: item.price.lookup_key, ...seatState };

  result.updated++;
  if (dryRun) {
    logger.info(logContext, '[DRY_RUN] Would update purchased seats');
    return;
  }

  await prisma.teamBillingAccount.update({ where: { teamId }, data: seatState });
  await createAuditLog({
    teamId,
    action: AuditLogAction.TEAM_SEATS_BACKFILLED,
    resource: AuditLogResource.TEAM_SEATS,
    resourceId: teamId,
    metadata: {
      previousLimit: account.licenseCountLimit,
      newSeats: desiredSeats,
      seatQuantity: quantity,
      includedSeats,
      source: 'stripe-quantity',
    },
  });
  logger.info(logContext, '[UPDATED] Purchased seats set from Stripe quantity');
}

/**
 * One-time migration to the purchased-seat model: mirror each self-serve team's Stripe TEAM_ item onto
 * `TeamBillingAccount` and set `licenseCountLimit` (the enforced cap) to `max(quantity, includedSeats)`,
 * so legacy flat-tier plans keep the seats their price already covers.
 *
 * Manual-billing teams are untouched (their cap is hand-set), pending-decrease fields are never written
 * (a schedule is only reported), and the run is idempotent — re-running only touches teams whose
 * mirrored fields drifted from Stripe.
 */
export async function backfillTeamSeats({
  prisma,
  stripe,
  dryRun,
  logger,
  now = new Date(),
}: {
  prisma: PrismaClient;
  stripe: SeatBackfillStripeClient;
  dryRun: boolean;
  logger: SeatBackfillLogger;
  now?: Date;
}): Promise<BackfillTeamSeatsResult> {
  const result: BackfillTeamSeatsResult = { dryRun, scanned: 0, updated: 0, skipped: 0, warnings: 0, failures: 0 };
  const loadPriceTiers = createPriceTiersLoader(stripe);

  let cursorTeamId: string | null = null;
  while (true) {
    const accounts: TeamBillingAccountRow[] = await prisma.teamBillingAccount.findMany({
      where: { manualBilling: false },
      orderBy: { teamId: 'asc' },
      take: PAGE_SIZE,
      ...(cursorTeamId ? { cursor: { teamId: cursorTeamId }, skip: 1 } : {}),
    });
    if (accounts.length === 0) {
      break;
    }

    for (const account of accounts) {
      result.scanned++;
      try {
        await backfillAccount({ account, prisma, stripe, loadPriceTiers, dryRun, logger, result, now });
      } catch (ex) {
        result.failures++;
        logger.error(
          { teamId: account.teamId, customerId: account.customerId, ...getErrorMessageAndStackObj(ex) },
          '[FAILED] Unable to backfill seats for team',
        );
      }
    }

    cursorTeamId = accounts[accounts.length - 1].teamId;
    if (accounts.length < PAGE_SIZE) {
      break;
    }
  }

  return result;
}

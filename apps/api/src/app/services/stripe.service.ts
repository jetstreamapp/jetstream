import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { sendWelcomeToProEmail } from '@jetstream/email';
import { getErrorMessage, getErrorMessageAndStackObj, getIncludedSeatsFromPriceTiers, groupByFlat } from '@jetstream/shared/utils';
import {
  EntitlementsAccess,
  JetstreamPrice,
  JetstreamPricesByLookupKey,
  JetstreamPriceTier,
  STRIPE_PRICE_KEYS,
  StripeUserFacingCustomer,
  StripeUserFacingSubscriptionItem,
  TeamSeatChangeResult,
} from '@jetstream/types';
import { formatISO, fromUnixTime, getUnixTime } from 'date-fns';
import { isObject, isString } from 'lodash';
import Stripe from 'stripe';
import type { TeamSeatState } from '../db/subscription.db';
import * as subscriptionDbService from '../db/subscription.db';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';

const STRIPE_API_VERSION = '2026-08-26.dahlia';

/** Marks the subscription schedules Jetstream creates for end-of-period seat decreases. */
export const SEAT_DECREASE_SCHEDULE_TYPE = 'SEAT_DECREASE';

const stripe = ENV.STRIPE_API_KEY ? new Stripe(ENV.STRIPE_API_KEY, { apiVersion: STRIPE_API_VERSION }) : ({} as Stripe);

const priceCache = new WeakMap<
  typeof STRIPE_PRICE_KEYS,
  {
    prices: JetstreamPricesByLookupKey;
    expiresAt: number;
  }
>();

export const ensureStripeIsInitialized = () => {
  if (!ENV.STRIPE_API_KEY) {
    throw new Error('Stripe API Key is not set');
  }
};

export const activeSubscriptionStatuses = new Set(['active', 'trialing', 'incomplete']);

export type StripeSyncFailureReason = 'NO_CUSTOMER_ID' | 'CUSTOMER_IS_DELETED' | 'MISSING_SUBSCRIPTIONS' | 'UNKNOWN_ERROR';

/**
 * Declared explicitly rather than inferred because the Stripe SDK's generated types are no longer
 * nameable from an inferred position, which breaks declaration emit.
 */
export type StripeJetstreamSyncResult =
  | { success: true; reason?: undefined; didUpdate: boolean; stripeCustomer?: Stripe.Customer }
  | { success: false; reason: StripeSyncFailureReason; didUpdate?: boolean; stripeCustomer?: undefined };

export async function handleStripeWebhook({ signature, payload }: { signature?: string; payload: string | Buffer }) {
  if (!ENV.STRIPE_API_KEY) {
    throw new Error('Stripe API key not set');
  }

  if (!ENV.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe Webhook secret not set');
  }

  if (!signature) {
    throw new Error('Missing webhook signature');
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, ENV.STRIPE_WEBHOOK_SECRET);

    logger.info({ eventId: event.id, eventType: event.type }, '[STRIPE]: Handling event %s', event.type);

    switch (event.type) {
      case 'entitlements.active_entitlement_summary.updated': {
        await updateEntitlementsFromWebhook(event.data.object);
        break;
      }
      case 'checkout.session.completed': {
        await saveSubscriptionFromCompletedSession({ sessionId: event.data.object.id });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.updated':
      // Seat decreases are Stripe schedules, so schedule lifecycle events change the team's seat state
      case 'subscription_schedule.updated':
      case 'subscription_schedule.released':
      case 'subscription_schedule.completed':
      case 'subscription_schedule.canceled':
      case 'subscription_schedule.aborted': {
        const { customer: customerOrId } = event.data.object;
        const customer = await fetchCustomerWithSubscriptionsById({ customerId: isString(customerOrId) ? customerOrId : customerOrId.id });
        await saveOrUpdateSubscription({ customer, sendWelcomeEmail: false });
        break;
      }
      default:
        logger.info('Unhandled Stripe webhook event: %s', event.type);
        break;
    }
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Unable to process webhook event');
    throw new Error('Unable to process webhook event');
  }
}

export function filterInactiveSubscriptions(subscriptions: Stripe.Subscription[]): Stripe.Subscription[] {
  return subscriptions.filter((subscription) => activeSubscriptionStatuses.has(subscription.status));
}

function findTeamPlanSubscription(subscriptions: Stripe.Subscription[]) {
  return subscriptions.find(({ items }) => items.data.some((item) => item.price.lookup_key?.startsWith('TEAM_')));
}

/**
 * A team plan can be started either through checkout or by switching plans in the Stripe billing
 * portal, and the portal never routes through checkout. Every path that observes a TEAM price on a
 * customer funnels through here so that a delayed or failed webhook self-heals instead of leaving the
 * user without a team.
 */
async function createTeamForTeamPlanCustomer({ userId, customerId }: { userId: string; customerId: string }) {
  const team = await teamDbService.upsertTeamWithBillingAccount({ userId, billingAccountCustomerId: customerId });
  // ensure stripe has proper metadata
  await updateCustomerMetadata(customerId, { userId, teamId: team.id, type: 'TEAM' });
  return team;
}

export async function fetchCustomerWithSubscriptionsById({
  customerId,
}: {
  customerId: string;
}): Promise<Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>> {
  return await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });
}

/** Stripe amounts are in cents; every amount leaves this module in dollars. */
function centsToDollars(cents: number | null | undefined): number | null {
  return typeof cents === 'number' ? cents / 100 : null;
}

function convertPriceTiers(tiers: Stripe.Price.Tier[] | undefined): JetstreamPriceTier[] | null {
  if (!tiers) {
    return null;
  }
  return tiers.map((tier) => ({
    flatAmount: centsToDollars(tier.flat_amount),
    unitAmount: centsToDollars(tier.unit_amount),
    upTo: tier.up_to,
  }));
}

const priceTiersCache = new Map<string, { tiers: JetstreamPriceTier[] | null; expiresAt: number }>();
const PRICE_TIERS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

/**
 * Stripe omits `tiers` from the price embedded in a subscription item, and the expansion path through
 * the customer is deeper than Stripe allows, so tiered prices are fetched individually. A price's tier
 * table cannot change after creation, so a long cache is safe.
 */
async function fetchPriceTiers(priceId: string): Promise<JetstreamPriceTier[] | null> {
  const cached = priceTiersCache.get(priceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tiers;
  }
  const price = await stripe.prices.retrieve(priceId, { expand: ['tiers'] });
  const tiers = convertPriceTiers(price.tiers);
  priceTiersCache.set(priceId, { tiers, expiresAt: Date.now() + PRICE_TIERS_CACHE_TTL_MS });
  return tiers;
}

/**
 * Fill in the tier table for tiered subscription items so the client can show what the customer
 * actually pays. A failed lookup leaves `tiers` null rather than failing the whole billing page.
 */
export async function attachTiersToTieredItems(customer: StripeUserFacingCustomer): Promise<void> {
  const tieredItems = customer.subscriptions.flatMap(({ items }) => items).filter((item) => item.billingScheme === 'tiered' && !item.tiers);
  await Promise.all(
    tieredItems.map(async (item) => {
      try {
        item.tiers = await fetchPriceTiers(item.priceId);
      } catch (ex) {
        logger.warn({ priceId: item.priceId, ...getErrorMessageAndStackObj(ex) }, 'Unable to fetch price tiers for subscription item');
      }
    }),
  );
}

export async function fetchPrices({ lookupKeys }: { lookupKeys: typeof STRIPE_PRICE_KEYS }): Promise<JetstreamPricesByLookupKey> {
  const cache = priceCache.get(lookupKeys);
  if (cache?.expiresAt && cache.expiresAt > Date.now()) {
    return cache.prices;
  }

  const prices = await stripe.prices
    .list({
      lookup_keys: lookupKeys as unknown as string[],
      expand: ['data.product', 'data.tiers'],
      type: 'recurring',
      currency: 'usd',
      active: true,
    })
    .then(({ data }) => data);

  const groupedPrices = groupByFlat(prices, 'lookup_key');

  function getPrice(key: string): JetstreamPrice {
    const price = groupedPrices[key];
    if (!price) {
      throw new Error(`Price not found for lookup key: ${key}`);
    }
    const product = price.product as Stripe.Product;
    return {
      id: price.id,
      billingScheme: price.billing_scheme,
      lookupKey: key,
      interval: price.recurring?.interval === 'year' ? 'ANNUAL' : 'MONTHLY',
      amount: (price.unit_amount || 0) / 100,
      tiersMode: price.tiers_mode || null,
      tiers: convertPriceTiers(price.tiers),
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
      },
    };
  }

  const pricesByKey = lookupKeys.reduce((acc, key) => {
    acc[key] = getPrice(key);
    return acc;
  }, {} as JetstreamPricesByLookupKey);

  priceCache.set(lookupKeys, {
    prices: pricesByKey,
    expiresAt: Date.now() + 1000 * 60 * 60 * 6, // Cache for 6 hours
  });

  return pricesByKey;
}

export async function fetchCustomerEntitlements({
  customerId,
}: {
  customerId: string;
}): Promise<Stripe.Response<Stripe.ApiList<Stripe.Entitlements.ActiveEntitlement>>> {
  return await stripe.entitlements.activeEntitlements.list({ customer: customerId });
}

export async function fetchCustomerWithSubscriptionsByJetstreamId({ userId }: { userId: string }): Promise<Stripe.Customer> {
  const customerWithSubscriptions = await stripe.customers.search({
    query: `metadata["userId"]:"${userId}"`,
    limit: 1,
    expand: ['subscriptions', 'entitlements'],
  });
  return customerWithSubscriptions.data[0];
}

export async function getUserFacingStripeCustomer({ customerId }: { customerId: string }): Promise<StripeUserFacingCustomer | null> {
  try {
    const stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return null;
    }
    const customer = convertCustomerWithSubscriptionsToUserFacing(stripeCustomer);
    await attachTiersToTieredItems(customer);
    return customer;
  } catch (ex) {
    logger.warn({ customerId, ...getErrorMessageAndStackObj(ex) }, 'Unable to fetch or convert customer to user facing');
    return null;
  }
}

export function convertCustomerWithSubscriptionsToUserFacing(stripeCustomer: Stripe.Customer) {
  const customerWithSubscriptions: StripeUserFacingCustomer = {
    id: stripeCustomer.id,
    balance: stripeCustomer.balance / 100,
    delinquent: !!stripeCustomer.delinquent,
    subscriptions:
      stripeCustomer.subscriptions?.data.map(
        ({ id, billing_cycle_anchor, cancel_at, cancel_at_period_end, canceled_at, discounts, ended_at, items, start_date, status }) => ({
          id,
          // TODO: validate that the dates are correct (should be if server is on UTC I think?)
          billingCycleAnchor: formatISO(fromUnixTime(billing_cycle_anchor)),
          cancelAt: cancel_at ? formatISO(fromUnixTime(cancel_at)) : null,
          cancelAtPeriodEnd: cancel_at_period_end,
          canceledAt: canceled_at ? formatISO(fromUnixTime(canceled_at)) : null,
          endedAt: ended_at ? formatISO(fromUnixTime(ended_at)) : null,
          startDate: formatISO(fromUnixTime(start_date)),
          status: status.toUpperCase() as Uppercase<Stripe.Subscription.Status>,
          // Existence check only — `discounts` entries are unexpanded ids, and a customer-level
          // coupon discounts this subscription's invoices the same as a subscription-level one
          hasDiscount: Boolean(stripeCustomer.discount || discounts.length > 0),
          items: items.data.map(({ id, price, quantity, current_period_start, current_period_end }) => ({
            id,
            priceId: price.id,
            active: price.active,
            currentPeriodStart: formatISO(fromUnixTime(current_period_start)),
            currentPeriodEnd: formatISO(fromUnixTime(current_period_end)),
            product: price.product as string,
            lookupKey: price.lookup_key,
            unitAmount: (price.unit_amount || 0) / 100,
            billingScheme: price.billing_scheme,
            tiersMode: price.tiers_mode || null,
            tiers: convertPriceTiers(price.tiers),
            recurringInterval: (price.recurring?.interval?.toUpperCase() || null) as StripeUserFacingSubscriptionItem['recurringInterval'],
            recurringIntervalCount: price.recurring?.interval_count || null,
            quantity: quantity ?? 1,
          })),
        }),
      ) || [],
  };
  return customerWithSubscriptions;
}

export async function createCustomer(
  user: Pick<UserProfile, 'id' | 'name' | 'email'>,
  type: 'TEAM' | 'USER',
): Promise<Stripe.Response<Stripe.Customer>> {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id, teamId: null, type },
  });
  if (type === 'TEAM') {
    await stripe.customers.createFundingInstructions(customer.id, {
      currency: 'usd',
      funding_type: 'bank_transfer',
      bank_transfer: {
        type: 'us_bank_transfer',
      },
    });
  }
  return customer;
}

/**
 * Keeps the Stripe customer's email aligned with the account, so receipts and dunning notices reach
 * the address the user actually reads.
 */
export async function updateCustomerEmail(customerId: string, email: string): Promise<Stripe.Response<Stripe.Customer>> {
  return stripe.customers.update(customerId, { email });
}

/**
 * Update customer metadata to ensure that it matches based on the current state of Jetstream
 */
export async function updateCustomerMetadata(
  customerId: string,
  metadata: { userId: string; teamId: string | null; type: 'TEAM' | 'USER' },
): Promise<Stripe.Response<Stripe.Customer>> {
  const { type } = metadata;
  const customer = await stripe.customers.update(customerId, {
    metadata,
  });
  if (type === 'TEAM') {
    await stripe.customers.createFundingInstructions(customer.id, {
      currency: 'usd',
      funding_type: 'bank_transfer',
      bank_transfer: {
        type: 'us_bank_transfer',
      },
    });
  }
  return customer;
}

export async function updateEntitlementsFromWebhook(eventData: Stripe.Entitlements.ActiveEntitlementSummary) {
  const { customer, entitlements } = eventData;
  await updateEntitlements(customer, entitlements.data);
}

export async function fetchAndUpdateEntitlements(customerId: string) {
  const entitlements = await fetchCustomerEntitlements({ customerId });
  await updateEntitlements(customerId, entitlements.data);
}

/**
 * Resolve the flat entitlement flags from Stripe's active entitlement lookup_keys.
 *
 * Analysis Tools ship to all paid tiers and there is no dedicated Stripe `analysisTools` lookup_key, so
 * the grant is derived from the paid signal (chromeExtension) rather than read from Stripe. This mirrors
 * the grandfather migration and keeps the grant durable — without it, every entitlement sync would reset
 * the backfilled `analysisTools` back to false. Remove the derivation once a Stripe lookup_key exists.
 */
export function resolveEntitlementAccessFromStripe(entitlements: Stripe.Entitlements.ActiveEntitlement[]): EntitlementsAccess {
  const entitlementAccess = entitlements.reduce(
    (entitlementAccess: EntitlementsAccess, { lookup_key }) => {
      if (lookup_key in entitlementAccess) {
        entitlementAccess[lookup_key] = true;
      }
      return entitlementAccess;
    },
    {
      googleDrive: false,
      chromeExtension: false,
      recordSync: false,
      desktop: false,
      analysisTools: false,
      salesforceCanvas: false,
    },
  );
  entitlementAccess.analysisTools = entitlementAccess.analysisTools || entitlementAccess.chromeExtension;
  return entitlementAccess;
}

export async function updateEntitlements(customerId: string, entitlements: Stripe.Entitlements.ActiveEntitlement[]) {
  const entitlementAccess = resolveEntitlementAccessFromStripe(entitlements);

  const customer = await fetchCustomerWithSubscriptionsById({ customerId });
  if (!customer.deleted && customer.metadata.type === 'TEAM') {
    await subscriptionDbService.updateTeamEntitlements(customerId, entitlementAccess);
  } else {
    await subscriptionDbService.updateUserEntitlements(customerId, entitlementAccess);
  }
}

/**
 * This handles USER and TEAM subscriptions
 *
 * Upsert team
 * Upsert billing account
 * Synchronize subscription state
 */
export async function saveSubscriptionFromCompletedSession({ sessionId }: { sessionId: string }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer', 'subscription'] });

  if (!session.customer) {
    throw new Error('Invalid checkout session - a customer is required to be associated with the session');
  }
  const customerOrId = session.customer;
  const customerId = isString(customerOrId) ? customerOrId : customerOrId.id;

  const metadata = (session.metadata || {}) as { userId?: string; teamId?: string; type?: 'USER' | 'TEAM'; teamName?: string };
  const userId = session.client_reference_id as string;
  let teamId = metadata.teamId || null;
  let type = metadata.type || 'USER';
  const subscription = session.subscription;

  // If user has a team subscription, ensure that we treat as a team even if they did not initially have a teamId in metadata
  if (isObject(subscription) && subscription.items.data.find((item) => item.price.lookup_key?.startsWith('TEAM_'))) {
    type = 'TEAM';
  }

  if (type === 'TEAM') {
    // upsert team (in case webhook is being processed at about the same time - this function needs to be idempotent)
    // The name chosen at checkout only applies when the team is created here; an existing team keeps its name
    const team = await teamDbService.upsertTeamWithBillingAccount({
      userId,
      billingAccountCustomerId: customerId,
      name: metadata.teamName || undefined,
    });
    teamId = team.id;
  } else {
    // Ensure billing account exists
    await userDbService.upsertBillingAccount({ userId, customerId });
  }

  // ensure stripe has proper metadata
  await updateCustomerMetadata(customerId, { userId, teamId, type });

  // Update customer subscriptions - will also be updated via webhook
  const customer = await fetchCustomerWithSubscriptionsById({ customerId });
  await saveOrUpdateSubscription({ customer, sendWelcomeEmail: true });

  // Update customer entitlements - will also be updated via webhook
  await fetchAndUpdateEntitlements(customer.id);

  return {
    userId,
    teamId,
    type,
  };
}

/**
 * Can be used to manually synchronize Stripe with Jetstream
 * This is generally only needed if a webhook delivery fails, but we also perform this operation when a user accesses the billing page
 * and we detect things are are out of sync
 */
export async function synchronizeStripeWithJetstreamIfRequiredForTeamOrUser({
  userId,
  teamId,
  customerId,
}:
  | { userId: string; teamId?: string; customerId?: null }
  | { userId: string; teamId: string; customerId: string }): Promise<StripeJetstreamSyncResult> {
  if (teamId) {
    return synchronizeStripeWithJetstreamTeamIfRequired({ teamId, customerId });
  }
  return synchronizeStripeWithJetstreamUserIfRequired({ userId, customerId });
}

export async function synchronizeStripeWithJetstreamUserIfRequired({
  userId,
  customerId,
}: { userId: string; customerId?: null; force?: boolean } | { userId: string; customerId: string }): Promise<StripeJetstreamSyncResult> {
  try {
    let didUpdate = false;
    const userProfile = await userDbService.findById(userId);

    // TODO: would we ever need to go in the opposite direction and delete things in Jetstream?
    const billingAccountCustomerId = userProfile?.billingAccount?.customerId;
    if (!billingAccountCustomerId) {
      return { success: true, didUpdate } as const;
    }

    customerId = billingAccountCustomerId || customerId;

    if (!customerId) {
      return { success: false, reason: 'NO_CUSTOMER_ID' } as const;
    }

    const stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return { success: false, reason: 'CUSTOMER_IS_DELETED', didUpdate } as const;
    }

    if (!stripeCustomer.subscriptions?.data) {
      return { success: false, reason: 'MISSING_SUBSCRIPTIONS', didUpdate } as const;
    }

    const subscriptions = filterInactiveSubscriptions(stripeCustomer.subscriptions.data);

    // The customer upgraded to a team plan without a team existing yet - most likely a plan switch in
    // the billing portal, which never routes through checkout. Create the team and sync as a team,
    // otherwise the team subscription would be recorded against the personal account and the checks
    // below would then report the account as correctly synchronized forever.
    if (findTeamPlanSubscription(subscriptions)) {
      const team = await createTeamForTeamPlanCustomer({ userId, customerId });
      return await synchronizeStripeWithJetstreamTeamIfRequired({ teamId: team.id, customerId });
    }

    const priceRecordCount = subscriptions.flatMap((subscription) => subscription.items.data).length;

    /**
     * Check if we need to synchronize
     */
    const hasCorrectSubscriptionItemCount = priceRecordCount === userProfile.subscriptions.length;
    // This isn't very scalable as we introduce more entitlements, but that is likely going to be a really slow process
    const areEntitlementsEnabled =
      !!userProfile.entitlements?.chromeExtension &&
      !!userProfile.entitlements?.googleDrive &&
      !!userProfile.entitlements?.desktop &&
      !!userProfile.entitlements?.recordSync;
    const hasCorrectEntitlements = priceRecordCount > 0 ? areEntitlementsEnabled : !areEntitlementsEnabled;
    if (hasCorrectSubscriptionItemCount && hasCorrectEntitlements) {
      return { success: true, didUpdate, stripeCustomer } as const;
    }

    /**
     * Synchronize data
     */
    didUpdate = true;
    await subscriptionDbService.updateSubscriptionStateForCustomer({
      userId,
      customerId,
      subscriptions,
    });
    await fetchAndUpdateEntitlements(customerId);
    return { success: true, didUpdate, stripeCustomer } as const;
  } catch (ex) {
    logger.error({ userId, ...getErrorMessageAndStackObj(ex) }, 'Error synchronizing stripe with jetstream');
    return { success: false, reason: 'UNKNOWN_ERROR', didUpdate: false } as const;
  }
}

export async function synchronizeStripeWithJetstreamTeamIfRequired({
  teamId,
  customerId,
}: { teamId: string; customerId?: null; force?: boolean } | { teamId: string; customerId: string }): Promise<StripeJetstreamSyncResult> {
  try {
    let didUpdate = false;
    const team = await subscriptionDbService.getTeamBillingAccountForSeats({ teamId });
    const entitlements = await teamDbService.findEntitlements({ teamId });
    const teamSubscriptions = await teamDbService.findSubscriptions({ teamId });

    // TODO: would we ever need to go in the opposite direction and delete things in Jetstream?
    const billingAccountCustomerId = team.billingAccount?.customerId;
    if (!billingAccountCustomerId) {
      return { success: true, didUpdate } as const;
    }

    customerId = billingAccountCustomerId || customerId;

    if (!customerId) {
      return { success: false, reason: 'NO_CUSTOMER_ID' } as const;
    }

    const stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return { success: false, reason: 'CUSTOMER_IS_DELETED', didUpdate } as const;
    }

    if (!stripeCustomer.subscriptions?.data) {
      return { success: false, reason: 'MISSING_SUBSCRIPTIONS', didUpdate } as const;
    }

    const subscriptions = filterInactiveSubscriptions(stripeCustomer.subscriptions.data);
    const priceRecordCount = subscriptions.flatMap((subscription) => subscription.items.data).length;
    const seatState = await resolveTeamSeatState(subscriptions);

    /**
     * Check if we need to synchronize
     */
    const hasCorrectSubscriptionItemCount = priceRecordCount === teamSubscriptions.length;
    // This isn't very scalable as we introduce more entitlements, but that is likely going to be a really slow process
    const areEntitlementsEnabled =
      !!entitlements?.chromeExtension && !!entitlements?.googleDrive && !!entitlements?.desktop && !!entitlements?.recordSync;
    const hasCorrectEntitlements = priceRecordCount > 0 ? areEntitlementsEnabled : !areEntitlementsEnabled;
    const hasCorrectSeatState = subscriptionDbService.isTeamSeatStateInSync(team.billingAccount, seatState);
    if (hasCorrectSubscriptionItemCount && hasCorrectEntitlements && hasCorrectSeatState) {
      return { success: true, didUpdate, stripeCustomer } as const;
    }

    /**
     * Synchronize data
     */
    didUpdate = true;
    await subscriptionDbService.updateTeamSubscriptionStateForCustomer({
      teamId,
      customerId,
      subscriptions,
      seatState,
    });
    await fetchAndUpdateEntitlements(customerId);
    return { success: true, didUpdate, stripeCustomer } as const;
  } catch (ex) {
    logger.error({ teamId, ...getErrorMessageAndStackObj(ex) }, 'Error synchronizing stripe with jetstream for team');
    return { success: false, reason: 'UNKNOWN_ERROR', didUpdate: false } as const;
  }
}

/**
 * Synchronize subscription state from Stripe to Jetstream
 *
 * If customer metadata is not correct, then this may be a NOOP
 */
export async function saveOrUpdateSubscription({
  customer,
  sendWelcomeEmail,
}: {
  customer: Stripe.Customer | Stripe.DeletedCustomer;
  sendWelcomeEmail: boolean;
}) {
  if (customer.deleted) {
    logger.info({ customerId: customer.id }, '[Stripe] Customer deleted: %s', customer.id);
    await subscriptionDbService.cancelAllSubscriptionsForUser({ customerId: customer.id });
    return;
  }

  let { userId, teamId, type = 'USER' } = customer.metadata;
  const subscriptions = customer.subscriptions?.data ?? [];
  const hasTeamPlan = !!findTeamPlanSubscription(subscriptions);

  // Ensure team is auto-created if required and Stripe is updated to reflect this
  if (hasTeamPlan && userId && (!teamId || type !== 'TEAM')) {
    type = 'TEAM';
    const team = await createTeamForTeamPlanCustomer({ userId, customerId: customer.id });
    teamId = team.id;
  }

  // customer does not have Jetstream id attached - update Stripe to ensure data integrity (if possible)
  if (!userId && type === 'USER') {
    const billingAccount = await userDbService.findBillingAccountByCustomerId({ customerId: customer.id });
    if (!billingAccount) {
      logger.error(
        {
          customerId: customer.id,
          remedy: 'Manually create a billing account in Jetstream DB for this customer, then retry event or update subscription to re-sync',
        },
        'Billing Account does not exist, unable to save subscriptions',
      );
      return;
    }
    userId = billingAccount.userId;
    await stripe.customers.update(customer.id, { metadata: { userId } });
  } else if (userId && type === 'USER') {
    // For new subscriptions, create a billing account if it does not exist
    await userDbService.upsertBillingAccount({ userId, customerId: customer.id });
  } else if (teamId && type === 'TEAM') {
    // For new subscriptions, create a billing account if it does not exist
    await teamDbService.createBillingAccountIfNotExists({ teamId, customerId: customer.id });
  } else {
    // This could happen depending on the order of webhook events for subscription creation vs checkout session completion
    // it should self heal since we call this code path in both cases
    logger.error({ customerId: customer.id, userId, teamId, type }, 'Unable to save subscriptions - userId or teamId is required');
    return;
  }

  if (type === 'USER') {
    await subscriptionDbService.updateSubscriptionStateForCustomer({
      userId,
      customerId: customer.id,
      subscriptions: filterInactiveSubscriptions(subscriptions),
    });

    if (sendWelcomeEmail) {
      userDbService.findById(userId).then((user) => {
        sendWelcomeToProEmail(user.email).catch((error) => {
          logger.error({ ...getErrorMessageAndStackObj(error) }, 'Error sending welcome to pro email');
        });
      });
    }
  } else if (type === 'TEAM') {
    const activeSubscriptions = filterInactiveSubscriptions(subscriptions);
    await subscriptionDbService.updateTeamSubscriptionStateForCustomer({
      teamId,
      customerId: customer.id,
      subscriptions: activeSubscriptions,
      seatState: await resolveTeamSeatState(activeSubscriptions),
    });
  } else {
    throw new Error(`Invalid type for subscription update: ${type}`);
  }
}

/**
 * Cancel All Subscriptions
 */
export async function cancelAllSubscriptions({ customerId }: { customerId: string }) {
  const results = {
    customerId,
    success: true,
    reason: 'All subscriptions cancelled',
    canceledSubscriptions: [] as string[],
    errors: [] as { subscriptionId: string; error: string }[],
  };

  try {
    const customer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (customer.deleted) {
      results.reason = 'Customer is deleted, no action required';
      return results;
    }

    const activeSubscriptions =
      customer.subscriptions?.data.filter((subscription) => subscription.canceled_at === null && subscription.cancel_at === null) || [];
    if (activeSubscriptions.length === 0) {
      results.reason = 'One or more subscriptions could not be canceled';
      return results;
    }

    for (const activeSubscription of activeSubscriptions) {
      try {
        await stripe.subscriptions.cancel(activeSubscription.id, {
          cancellation_details: { comment: 'Account Deletion' },
          prorate: false,
          invoice_now: false,
        });
        results.canceledSubscriptions.push(activeSubscription.id);
      } catch (ex) {
        logger.error({ customerId, ...getErrorMessageAndStackObj(ex) }, 'Error cancelling subscription');
        results.success = false;
        results.reason = 'One or more subscriptions could not be cancelled';
        results.errors.push({ subscriptionId: activeSubscription.id, error: getErrorMessage(ex) });
      }
    }
  } catch (ex) {
    logger.error({ customerId, ...getErrorMessageAndStackObj(ex) }, 'Error cancelling subscriptions');
    results.success = false;
    results.reason = `Fatal exception: ${getErrorMessage(ex)}`;
  }

  return results;
}

/**
 * CREATE BILLING PORTAL SESSION
 */
export async function createCheckoutSession({
  customerId,
  mode = 'subscription',
  priceId,
  user,
  type,
  teamId,
  quantity = 1,
  teamName,
}: {
  user: Pick<UserProfile, 'id' | 'name' | 'email'>;
  priceId: string;
  mode: Stripe.Checkout.SessionCreateParams.Mode;
  customerId?: string;
  type: 'TEAM' | 'USER';
  teamId?: string;
  /** Seats purchased up front for team plans; the customer cannot change it inside Checkout */
  quantity?: number;
  /** Name for the team created when checkout completes; ignored when the user already has a team */
  teamName?: string;
}): Promise<Stripe.Response<Stripe.Checkout.Session>> {
  const urlParams = new URLSearchParams({ sessionId: 'CHECKOUT_SESSION_ID', type, priceId, userId: user.id, mode });

  // Create customer if one does not exist
  if (!customerId) {
    const customer = await createCustomer(user, type);
    customerId = customer.id;
  }

  urlParams.set('customerId', customerId);
  if (teamId) {
    urlParams.set('teamId', teamId);
  }

  const serializedUrlParams = urlParams.toString().replace('CHECKOUT_SESSION_ID', '{CHECKOUT_SESSION_ID}');
  const successUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/complete?${serializedUrlParams}`;
  const cancelUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/cancel?${serializedUrlParams}`;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: priceId,
        quantity,
        // Seats are chosen in-app so the count Jetstream validated is the count Stripe charges for
        adjustable_quantity: { enabled: false },
      },
    ],
    allow_promotion_codes: true,
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: false },
    client_reference_id: user.id,
    currency: 'usd',
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    billing_address_collection: type === 'TEAM' ? 'required' : 'auto',
    tax_id_collection: { enabled: type === 'TEAM' },
    consent_collection: {
      terms_of_service: 'required',
    },
    customer_update: {
      name: 'auto',
      shipping: 'auto',
      address: 'auto',
    },
    payment_method_data: {
      allow_redisplay: 'always',
    },
    metadata: { userId: user.id, teamId: teamId || null, type, teamName: teamName || null },
  });

  return session;
}

const cachedPortalSessions = new Map<'USER' | 'TEAM' | 'MANUAL', Stripe.BillingPortal.Configuration>();

/**
 * CREATE BILLING PORTAL SESSION
 */
export async function createBillingPortalSession({
  customerId,
  portalType,
  returnUrl = `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`,
}: {
  customerId: string;
  portalType: 'USER' | 'TEAM' | 'MANUAL';
  returnUrl?: string;
}): Promise<Stripe.Response<Stripe.BillingPortal.Session>> {
  if (cachedPortalSessions.size === 0) {
    logger.info('Loading billing portal configurations from Stripe');
    await stripe.billingPortal.configurations.list({ active: true }).then((res) => {
      res.data.forEach((configuration) => {
        if (configuration.metadata?.type) {
          cachedPortalSessions.set(configuration.metadata.type as 'USER' | 'TEAM' | 'MANUAL', configuration);
        }
      });
    });
  }

  const portalId = cachedPortalSessions.get(portalType)?.id;

  if (!portalId) {
    throw new Error(`Billing portal not found for type ${portalType}`);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: portalId,
    return_url: returnUrl,
  });

  return session;
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
  // A failed tier lookup must fail the sync: writing includedSeats=0 for a legacy plan would shrink the cap under the team
  const tiers = item.price.billing_scheme === 'tiered' ? await fetchPriceTiers(item.price.id) : null;
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
    // The decrease landed when phase two started; release so the subscription is no longer schedule-managed
    await releaseTeamSeatSchedule(schedule.id).catch((ex) => {
      logger.warn({ scheduleId: schedule.id, ...getErrorMessageAndStackObj(ex) }, 'Unable to release applied seat decrease schedule');
    });
    return { pending: null, foreignScheduleId: null };
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

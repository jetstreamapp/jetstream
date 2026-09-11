import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { sendWelcomeToProEmail } from '@jetstream/email';
import { convertStripePriceTiers, getErrorMessage, getErrorMessageAndStackObj, groupByFlat } from '@jetstream/shared/utils';
import {
  EntitlementsAccess,
  JetstreamPrice,
  JetstreamPricesByLookupKey,
  Maybe,
  SALESFORCE_ORG_ID_REGEX,
  STRIPE_PRICE_KEYS,
  StripeUserFacingCustomer,
  StripeUserFacingSubscriptionItem,
} from '@jetstream/types';
import { formatISO, fromUnixTime } from 'date-fns';
import { isObject, isString } from 'lodash';
import Stripe from 'stripe';
import * as subscriptionDbService from '../db/subscription.db';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';
import { fetchPriceTiers, resolveTeamSeatState } from './stripe-seats.service';
import { stripe } from './stripe.client';

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

/**
 * Salesforce requires the customer's production org id on every order we submit, so it is collected at
 * checkout and kept on the Stripe customer. Checkout has no tooltip or help text for a custom field and
 * caps the label at 50 characters, so the label carries the "why" and the long form explanation is
 * rendered next to the pay button (up to 1200 characters).
 */
const PRODUCTION_ORG_ID_FIELD_KEY = 'productionOrgId';
const PRODUCTION_ORG_ID_FIELD_LABEL = 'Production Org ID (required by Salesforce)';
const PRODUCTION_ORG_ID_HELP_TEXT =
  "As a Salesforce partner, we're required to report each order to Salesforce along with the Org ID of the customer's production org. " +
  'The Org ID only identifies your org. It does not give us or anyone else access to it. ' +
  'You can find it in your production org (not a sandbox) in Salesforce Setup under Company Information. ' +
  'It starts with 00D and is 15 or 18 characters long. ' +
  "Not sure which Org ID to use, or don't have a production org? Email support@getjetstream.app and we'll help.";

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

/** Any other status still holds the customer's plan, including past due, unpaid and set to cancel */
const endedSubscriptionStatuses = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired']);

/**
 * A second TEAM subscription on the same customer leaves the seat item ambiguous (see `findTeamSeatItem`),
 * so checkout must not start another one until the current one has ended.
 */
export function hasCurrentTeamPlanSubscription(customer: Stripe.Customer): boolean {
  const currentSubscriptions = (customer.subscriptions?.data ?? []).filter(({ status }) => !endedSubscriptionStatuses.has(status));
  return !!findTeamPlanSubscription(currentSubscriptions);
}

/**
 * A team plan can be started either through checkout or by switching plans in the Stripe billing
 * portal, and the portal never routes through checkout. Every path that observes a TEAM price on a
 * customer funnels through here so that a delayed or failed webhook self-heals instead of leaving the
 * user without a team.
 *
 * `name` only applies when the team is created here; an existing team keeps its name.
 */
async function createTeamForTeamPlanCustomer({ userId, customerId, name }: { userId: string; customerId: string; name?: string }) {
  const team = await teamDbService.upsertTeamWithBillingAccount({ userId, billingAccountCustomerId: customerId, name: name || undefined });
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
      tiers: convertStripePriceTiers(price.tiers),
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
            tiers: convertStripePriceTiers(price.tiers),
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
  metadata: { userId: string; teamId: string | null; type: 'TEAM' | 'USER'; productionOrgId?: string },
): Promise<Stripe.Response<Stripe.Customer>> {
  const customer = await stripe.customers.update(customerId, { metadata });
  if (metadata.type === 'TEAM') {
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
 * Checkout can only enforce a length on a custom field, so the customer's input is kept as entered
 * (it is the only copy) and anything that does not look like an org id is flagged for follow up.
 */
function getProductionOrgIdFromSession({ id: sessionId, custom_fields: customFields }: Stripe.Checkout.Session) {
  const enteredValue = customFields.find(({ key }) => key === PRODUCTION_ORG_ID_FIELD_KEY)?.text?.value;
  // The field is left off checkout when a valid org id is already on file
  if (typeof enteredValue !== 'string') {
    return undefined;
  }
  // Checkout only counts characters, so an entry of all spaces gets through and must still be flagged
  const productionOrgId = enteredValue.trim();
  if (!SALESFORCE_ORG_ID_REGEX.test(productionOrgId)) {
    logger.warn({ sessionId, productionOrgId }, '[STRIPE]: Production org id collected at checkout is not a valid Salesforce org id');
  }
  // Stripe deletes a metadata key that is set to an empty string, which would wipe any value already on file
  return productionOrgId || undefined;
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
  // Stripe merges metadata keys, so an absent productionOrgId keeps a previously collected value in place
  await updateCustomerMetadata(customerId, { userId, teamId, type, productionOrgId: getProductionOrgIdFromSession(session) });

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
    const teamPlanSubscription = findTeamPlanSubscription(subscriptions);
    if (teamPlanSubscription) {
      const team = await createTeamForTeamPlanCustomer({ userId, customerId, name: teamPlanSubscription.metadata?.teamName });
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
  const teamPlanSubscription = findTeamPlanSubscription(subscriptions);

  // Ensure team is auto-created if required and Stripe is updated to reflect this
  if (teamPlanSubscription && userId && (!teamId || type !== 'TEAM')) {
    type = 'TEAM';
    // Stripe does not order webhooks, so this can run before checkout.session.completed; the name chosen at
    // checkout is read from the subscription so the team does not fall back to the user's email
    const team = await createTeamForTeamPlanCustomer({
      userId,
      customerId: customer.id,
      name: teamPlanSubscription.metadata?.teamName,
    });
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
    await stripe.customers.update(customer.id, { metadata: { userId, type } });
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
 * A customer who already gave us their org id is not asked again. A stored value that is not a valid
 * org id counts as missing, so the customer gets the chance to correct it.
 */
function hasValidProductionOrgId(customer: Stripe.Customer | Stripe.DeletedCustomer) {
  return !customer.deleted && SALESFORCE_ORG_ID_REGEX.test(customer.metadata.productionOrgId ?? '');
}

/**
 * Fails open: asking a customer a second time is a minor annoyance, while a failed lookup that stops
 * them from reaching checkout is a lost sale.
 */
async function hasProductionOrgIdOnFile(customerId: string) {
  try {
    return hasValidProductionOrgId(await stripe.customers.retrieve(customerId));
  } catch (ex) {
    logger.warn(
      { customerId, ...getErrorMessageAndStackObj(ex) },
      '[STRIPE]: Unable to check for a production org id on file, asking again',
    );
    return false;
  }
}

/**
 * The field and the help text that explains it always travel together, so checkout either shows both or neither
 */
function getProductionOrgIdCheckoutParams(
  productionOrgId: Maybe<string>,
): Pick<Stripe.Checkout.SessionCreateParams, 'custom_fields' | 'custom_text'> {
  // Stripe rejects the entire session if the default breaks the field's length rules - never let a pre-fill block checkout
  const defaultValue = productionOrgId && SALESFORCE_ORG_ID_REGEX.test(productionOrgId) ? productionOrgId : undefined;
  return {
    custom_fields: [
      {
        key: PRODUCTION_ORG_ID_FIELD_KEY,
        label: { type: 'custom', custom: PRODUCTION_ORG_ID_FIELD_LABEL },
        type: 'text',
        optional: false,
        text: { minimum_length: 15, maximum_length: 18, default_value: defaultValue },
      },
    ],
    custom_text: { submit: { message: PRODUCTION_ORG_ID_HELP_TEXT } },
  };
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
  productionOrgId,
  quantity = 1,
  teamName,
}: {
  user: Pick<UserProfile, 'id' | 'name' | 'email'>;
  priceId: string;
  mode: Stripe.Checkout.SessionCreateParams.Mode;
  customerId?: string;
  type: 'TEAM' | 'USER';
  teamId?: string;
  /** Pre-fills the production org id field, the customer can still change it. Unused when the customer already has one on file. */
  productionOrgId?: Maybe<string>;
  /** Seats purchased up front for team plans; the customer cannot change it inside Checkout */
  quantity?: number;
  /** Name for the team created when checkout completes; ignored when the user already has a team */
  teamName?: string;
}): Promise<Stripe.Response<Stripe.Checkout.Session>> {
  const urlParams = new URLSearchParams({ sessionId: 'CHECKOUT_SESSION_ID', type, priceId, userId: user.id, mode });

  let shouldCollectProductionOrgId: boolean;
  if (customerId) {
    shouldCollectProductionOrgId = !(await hasProductionOrgIdOnFile(customerId));
  } else {
    // Checks what came back instead of assuming a brand new customer, so this stays correct if an existing one is ever resolved here
    const customer = await createCustomer(user, type);
    customerId = customer.id;
    shouldCollectProductionOrgId = !hasValidProductionOrgId(customer);
  }

  urlParams.set('customerId', customerId);
  if (teamId) {
    urlParams.set('teamId', teamId);
  }

  const serializedUrlParams = urlParams.toString().replace('CHECKOUT_SESSION_ID', '{CHECKOUT_SESSION_ID}');
  const successUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/complete?${serializedUrlParams}`;
  const cancelUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/cancel?${serializedUrlParams}`;

  // The subscription webhook can create the team before the session completes, so the name also travels
  // on the subscription itself (see saveOrUpdateSubscription)
  const subscriptionDataParams: Pick<Stripe.Checkout.SessionCreateParams, 'subscription_data'> =
    mode === 'subscription' && teamName ? { subscription_data: { metadata: { teamName } } } : {};

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
    ...(shouldCollectProductionOrgId ? getProductionOrgIdCheckoutParams(productionOrgId) : {}),
    metadata: { userId: user.id, teamId: teamId || null, type, teamName: teamName || null },
    ...subscriptionDataParams,
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

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

function isTeamPlanSubscription({ items }: Stripe.Subscription): boolean {
  return items.data.some((item) => item.price.lookup_key?.startsWith('TEAM_'));
}

function findTeamPlanSubscription(subscriptions: Stripe.Subscription[]) {
  return subscriptions.find(isTeamPlanSubscription);
}

/** Any other status still holds the customer's plan, including past due, unpaid and set to cancel */
const endedSubscriptionStatuses = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired']);

/** The customer is actually paying, as opposed to Stripe still waiting on the first invoice (`incomplete`) */
const paidSubscriptionStatuses = new Set<Stripe.Subscription.Status>(['active', 'trialing']);

function getCurrentSubscriptions(customer: Stripe.Customer): Stripe.Subscription[] {
  return (customer.subscriptions?.data ?? []).filter(({ status }) => !endedSubscriptionStatuses.has(status));
}

/**
 * A second TEAM subscription on the same customer leaves the seat item ambiguous (see `findTeamSeatItem`),
 * so checkout must not start another one until the current one has ended.
 */
export function hasCurrentTeamPlanSubscription(customer: Stripe.Customer): boolean {
  return !!findTeamPlanSubscription(getCurrentSubscriptions(customer));
}

/**
 * The individual plan counterpart of `hasCurrentTeamPlanSubscription`: a second one on the same customer charges the
 * user twice for the same entitlements, so checkout must not start another one until the current one has ended.
 * Any subscription without a TEAM price counts, so a legacy individual price is covered too.
 */
export function hasCurrentPersonalPlanSubscription(customer: Stripe.Customer): boolean {
  return getCurrentSubscriptions(customer).some((subscription) => !isTeamPlanSubscription(subscription));
}

/**
 * A team plan can be started either through checkout or by switching plans in the Stripe billing
 * portal, and the portal never routes through checkout. Every path that observes a TEAM price on a
 * customer funnels through here so that a delayed or failed webhook self-heals instead of leaving the
 * user without a team.
 *
 * The team name on the subscription only applies when the team is created here; an existing team keeps its name.
 *
 * Returns null when the user already belongs to a team billed on a different customer (e.g. a Team checkout
 * opened before accepting an invitation). That customer is not labelled as the team's, so it keeps syncing
 * as the user's personal customer; the purchase is logged for a refund review.
 */
async function createTeamForTeamPlanCustomer({
  userId,
  customerId,
  teamPlanSubscription,
}: {
  userId: string;
  customerId: string;
  teamPlanSubscription: Stripe.Subscription;
}): Promise<{ id: string } | null> {
  const team = await teamDbService.upsertTeamWithBillingAccount({
    userId,
    billingAccountCustomerId: customerId,
    name: teamPlanSubscription.metadata?.teamName || undefined,
    // Set only by a checkout opened for an existing team, so the webhook can bind the replacement customer
    rebindCustomerForTeamId: teamPlanSubscription.metadata?.teamId || undefined,
  });
  if (team.customerId !== customerId) {
    return null;
  }
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

/**
 * Upper bound on customers read when looking a user's customer up by metadata. One is the norm; more only exist
 * for users who opened checkout repeatedly before customers were reused, and Stripe's page maximum keeps the one
 * they pay on in view for any plausible number of those.
 */
const CUSTOMER_SEARCH_LIMIT = 100;

/**
 * Lower is better: a customer being paid for, then one with any current subscription, then one with none. This is
 * where money has moved, so it is the customer that checkout must keep using.
 */
function getCustomerReuseRank(customer: Stripe.Customer): number {
  const currentSubscriptions = getCurrentSubscriptions(customer);
  if (currentSubscriptions.some(({ status }) => paidSubscriptionStatuses.has(status))) {
    return 0;
  }
  return currentSubscriptions.length > 0 ? 1 : 2;
}

/**
 * Finds a personal Stripe customer left behind by an earlier checkout, for a user who has no billing account yet.
 * Checkout used to create a customer on every visit until one completed, so repeat visits (and a double click)
 * each minted another one.
 *
 * Customers carrying a `teamId` are never reused: a team's customer also carries its purchaser's `userId`, and
 * neither a personal plan nor a new team may land on it. Duplicates resolve deterministically (see
 * `getCustomerReuseRank`, then the oldest, then the id), because Stripe search does not guarantee an order.
 *
 * Only the email is refreshed on the customer that is reused: checkout never corrects it once a customer is
 * attached, while the name is left to checkout, which sets it to the legal business name it collects.
 */
export async function findReusableCustomerForUser({ user }: { user: Pick<UserProfile, 'id' | 'email'> }): Promise<Stripe.Customer | null> {
  let searchResult: Stripe.ApiSearchResult<Stripe.Customer>;
  try {
    searchResult = await stripe.customers.search({
      query: `metadata["userId"]:"${user.id}"`,
      limit: CUSTOMER_SEARCH_LIMIT,
      expand: ['data.subscriptions'],
    });
  } catch (ex) {
    // Creating a customer is the behavior from before reuse existed, and the idempotency key on create still
    // stops a double click from minting two
    logger.warn({ userId: user.id, ...getErrorMessageAndStackObj(ex) }, '[STRIPE]: Unable to search for an existing Stripe customer');
    return null;
  }

  if (searchResult.has_more) {
    logger.error(
      { userId: user.id, customerCount: searchResult.data.length },
      '[STRIPE]: More Stripe customers for one user than a single search page, reconcile them manually',
    );
  }

  const customers = searchResult.data
    .filter(({ metadata }) => !metadata.teamId)
    .sort(
      (left, right) =>
        getCustomerReuseRank(left) - getCustomerReuseRank(right) || left.created - right.created || left.id.localeCompare(right.id),
    );
  const [customer] = customers;
  if (!customer) {
    return null;
  }
  if (customers.length > 1) {
    logger.warn(
      { userId: user.id, customerId: customer.id, customerIds: customers.map(({ id }) => id) },
      '[STRIPE]: Multiple Stripe customers found for one user, reusing the best match',
    );
  }

  if (customer.email !== user.email) {
    // Receipts going to an old address is not worth failing checkout over
    try {
      await stripe.customers.update(customer.id, { email: user.email });
      customer.email = user.email;
    } catch (ex) {
      logger.warn({ customerId: customer.id, ...getErrorMessageAndStackObj(ex) }, '[STRIPE]: Unable to refresh the reused customer email');
    }
  }
  logger.info({ userId: user.id, customerId: customer.id }, '[STRIPE]: Reusing existing Stripe customer for checkout');
  return customer;
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

async function createBankTransferFundingInstructions(customerId: string) {
  await stripe.customers.createFundingInstructions(customerId, {
    currency: 'usd',
    funding_type: 'bank_transfer',
    bank_transfer: {
      type: 'us_bank_transfer',
    },
  });
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
    await createBankTransferFundingInstructions(customer.id);
  }
  return customer;
}

/**
 * Creates the user's customer at most once per day, however many checkouts they open at the same time.
 *
 * Stripe's search index lags writes by up to a minute, so a double click misses the customer the first click
 * created and `findReusableCustomerForUser` cannot catch it. Stripe honors an idempotency key for 24 hours but
 * rejects a reused key whose parameters changed, so the create carries only the invariant `userId` and everything
 * that can change between attempts (email, name, plan type) is applied by a follow-up update.
 */
async function createCustomerForUser(
  user: Pick<UserProfile, 'id' | 'name' | 'email'>,
  type: 'TEAM' | 'USER',
): Promise<Stripe.Response<Stripe.Customer>> {
  const { id: customerId } = await stripe.customers.create(
    { metadata: { userId: user.id } },
    { idempotencyKey: `customer-create:${user.id}` },
  );
  // `teamId` is left out rather than nulled: a replayed key returns the customer an earlier attempt created, and
  // a team bound to it since then must keep its id
  const customer = await stripe.customers.update(customerId, {
    email: user.email,
    name: user.name,
    metadata: { userId: user.id, type },
  });
  if (type === 'TEAM') {
    await createBankTransferFundingInstructions(customer.id);
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
    await createBankTransferFundingInstructions(customer.id);
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
export async function saveSubscriptionFromCompletedSession({
  sessionId,
  expectedUserId,
}: {
  sessionId: string;
  /** The signed-in user when the call comes from the success redirect; the webhook has no caller to bind to */
  expectedUserId?: string;
}) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer', 'subscription'] });

  // The success redirect carries a client-supplied session id, and a checkout that was opened but
  // never paid still has a customer and TEAM metadata. Only a completed session may create a team,
  // billing account or entitlements, and only for the user who opened it.
  if (session.status !== 'complete') {
    throw new Error(`Invalid checkout session - session is not complete (status: ${session.status})`);
  }
  if (expectedUserId && session.client_reference_id !== expectedUserId) {
    logger.warn(
      { sessionId, expectedUserId, clientReferenceId: session.client_reference_id },
      '[STRIPE]: Checkout session does not belong to the current user',
    );
    throw new Error('Invalid checkout session - session does not belong to the current user');
  }

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
      rebindCustomerForTeamId: metadata.teamId || undefined,
    });
    if (team.customerId === customerId) {
      teamId = team.id;
    } else {
      // The buyer's team is billed on another customer (logged for a refund review), so this customer stays personal
      type = 'USER';
      teamId = null;
    }
  }
  // Stripe merges metadata keys, so an absent productionOrgId keeps a previously collected value in place
  const productionOrgId = getProductionOrgIdFromSession(session);
  if (type === 'USER') {
    // A subscription still waiting on its first payment cannot take the account; the subscription event that
    // follows payment claims it through `saveOrUpdateSubscription`
    const billingAccount = await userDbService.upsertBillingAccount({
      userId,
      customerId,
      canRepoint: isObject(subscription) && paidSubscriptionStatuses.has(subscription.status),
    });
    if (billingAccount.customerId !== customerId) {
      // Recording this customer would overwrite the subscriptions of the customer that holds the account. Returning
      // instead of throwing keeps the webhook from retrying a decision that will not change.
      await updateCustomerMetadata(customerId, { userId, teamId: null, type: 'USER', productionOrgId });
      return { userId, teamId: null, type: 'USER' as const };
    }
  }

  // ensure stripe has proper metadata
  await updateCustomerMetadata(customerId, { userId, teamId, type, productionOrgId });

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
      const team = await createTeamForTeamPlanCustomer({ userId, customerId, teamPlanSubscription });
      if (team) {
        return await synchronizeStripeWithJetstreamTeamIfRequired({ teamId: team.id, customerId });
      }
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
 * Checkout refuses a second subscription of a plan the customer already has, but a checkout that was open before the
 * first one completed, or a change made in Stripe, can still leave a customer paying twice. Nothing is canceled or
 * refunded automatically; this only makes the double charge visible.
 */
function logDuplicatePlanSubscriptions(customer: Stripe.Customer) {
  const currentSubscriptions = getCurrentSubscriptions(customer);
  const teamPlanSubscriptionIds = currentSubscriptions.filter(isTeamPlanSubscription).map(({ id }) => id);
  const personalPlanSubscriptionIds = currentSubscriptions
    .filter((subscription) => !isTeamPlanSubscription(subscription))
    .map(({ id }) => id);
  if (teamPlanSubscriptionIds.length <= 1 && personalPlanSubscriptionIds.length <= 1) {
    return;
  }
  logger.error(
    {
      customerId: customer.id,
      userId: customer.metadata.userId,
      teamId: customer.metadata.teamId,
      teamPlanSubscriptionIds,
      personalPlanSubscriptionIds,
    },
    '[STRIPE]: Customer has more than one current subscription for the same plan, review for a refund',
  );
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

  logDuplicatePlanSubscriptions(customer);

  let { userId, teamId, type = 'USER' } = customer.metadata;
  const subscriptions = customer.subscriptions?.data ?? [];
  const teamPlanSubscription = findTeamPlanSubscription(subscriptions);

  // Ensure team is auto-created if required and Stripe is updated to reflect this
  if (teamPlanSubscription && userId && (!teamId || type !== 'TEAM')) {
    // Stripe does not order webhooks, so this can run before checkout.session.completed; the name chosen at
    // checkout is read from the subscription so the team does not fall back to the user's email
    const team = await createTeamForTeamPlanCustomer({ userId, customerId: customer.id, teamPlanSubscription });
    // No team means the user's team is billed on another customer, so this one stays their personal customer
    if (team) {
      type = 'TEAM';
      teamId = team.id;
    } else {
      type = 'USER';
    }
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
    const billingAccount = await userDbService.upsertBillingAccount({
      userId,
      customerId: customer.id,
      canRepoint: subscriptions.some(({ status }) => paidSubscriptionStatuses.has(status)),
    });
    if (billingAccount.customerId !== customer.id) {
      logger.warn(
        { customerId: customer.id, userId, billingAccountCustomerId: billingAccount.customerId },
        'Unable to save subscriptions - the customer does not hold the user billing account',
      );
      return;
    }
  } else if (teamId && type === 'TEAM') {
    // For new subscriptions, create a billing account if it does not exist
    const billingAccount = await teamDbService.createBillingAccountIfNotExists({ teamId, customerId: customer.id });
    // Another customer can carry this team's id in its metadata, e.g. a Team checkout the buyer opened before
    // accepting an invitation to this team. Its subscriptions must never set the team's billing status or seats.
    if (billingAccount.customerId !== customer.id) {
      logger.error(
        { customerId: customer.id, teamId, teamCustomerId: billingAccount.customerId },
        'Unable to save subscriptions - the customer is not the billing customer of its team, review for a refund',
      );
      return;
    }
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
    // Stripe's entitlement summary event only fires when entitlements change, so a customer that already had them
    // before it was linked to a team (e.g. a team provisioned from the admin app) would otherwise never sync.
    // With no active subscription there is nothing to pick up: a fixed-seat team keeps the access it was provisioned
    // with until its subscription starts (schedule events land here before then), and when a subscription ends the
    // summary event fires and revokes it.
    if (activeSubscriptions.length > 0) {
      const { data: activeEntitlements } = await fetchCustomerEntitlements({ customerId: customer.id });
      await subscriptionDbService.updateTeamEntitlements(customer.id, resolveEntitlementAccessFromStripe(activeEntitlements));
    }
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

const CHECKOUT_SESSION_LIFETIME_SECONDS = 60 * 60;

/**
 * Every checkout tab is its own session and every one of them can be paid, so a forgotten tab could start a second
 * subscription. Expiring the customer's other open subscription sessions leaves only the newest one payable.
 *
 * Failures never block checkout: a session that completed or expired since the list cannot be expired, which is fine.
 */
async function expireOpenCheckoutSessions(customerId: string) {
  let openSessions: Stripe.Checkout.Session[];
  try {
    ({ data: openSessions } = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 }));
  } catch (ex) {
    logger.warn({ customerId, ...getErrorMessageAndStackObj(ex) }, '[STRIPE]: Unable to list open checkout sessions to expire');
    return;
  }
  await Promise.all(
    openSessions
      .filter(({ mode }) => mode === 'subscription')
      .map(async ({ id: sessionId }) => {
        try {
          await stripe.checkout.sessions.expire(sessionId);
          logger.info({ customerId, sessionId }, '[STRIPE]: Expired an older open checkout session');
        } catch (ex) {
          logger.warn({ customerId, sessionId, ...getErrorMessageAndStackObj(ex) }, '[STRIPE]: Unable to expire an open checkout session');
        }
      }),
  );
}

/**
 * CREATE CHECKOUT SESSION
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
  let canHaveOpenCheckoutSessions = true;
  if (customerId) {
    shouldCollectProductionOrgId = !(await hasProductionOrgIdOnFile(customerId));
  } else {
    // An existing team's replacement customer must be its own, and the per-user idempotency key could hand back the
    // buyer's personal customer. Checks what came back instead of assuming a brand new customer, since the key can
    // return one an earlier checkout created.
    const customer = teamId ? await createCustomer(user, type) : await createCustomerForUser(user, type);
    customerId = customer.id;
    shouldCollectProductionOrgId = !hasValidProductionOrgId(customer);
    // Only the per-user key can return a customer that already has a checkout open (a double click)
    canHaveOpenCheckoutSessions = !teamId;
  }

  if (canHaveOpenCheckoutSessions) {
    await expireOpenCheckoutSessions(customerId);
  }

  urlParams.set('customerId', customerId);
  if (teamId) {
    urlParams.set('teamId', teamId);
  }

  const serializedUrlParams = urlParams.toString().replace('CHECKOUT_SESSION_ID', '{CHECKOUT_SESSION_ID}');
  const successUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/complete?${serializedUrlParams}`;
  const cancelUrl = `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/cancel?${serializedUrlParams}`;

  // The subscription webhook can arrive before the session completes, so the team name (for a new team) and the
  // team id (for an existing team whose deleted customer is being replaced) also travel on the subscription itself
  // (see saveOrUpdateSubscription)
  const subscriptionMetadata = { ...(teamName ? { teamName } : {}), ...(teamId ? { teamId } : {}) };
  const subscriptionDataParams: Pick<Stripe.Checkout.SessionCreateParams, 'subscription_data'> =
    mode === 'subscription' && Object.keys(subscriptionMetadata).length > 0
      ? { subscription_data: { metadata: subscriptionMetadata } }
      : {};

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
    // Stripe's default is 24 hours; a short life bounds how long a forgotten tab can still be paid (minimum 30 minutes)
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_LIFETIME_SECONDS,
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: false },
    client_reference_id: user.id,
    currency: 'usd',
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    billing_address_collection: 'required',
    // Salesforce requires the legal business name on every order we report, Stripe saves it to `customer.business_name`
    name_collection: { business: { enabled: true, optional: false } },
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

/** Matches `metadata.type` on the portal configurations written by scripts/stripe-update-billing-portal-config.mjs */
export type BillingPortalType = 'USER' | 'TEAM' | 'TEAM_LEGACY' | 'MANUAL';

const cachedPortalSessions = new Map<BillingPortalType, Stripe.BillingPortal.Configuration>();

/**
 * CREATE BILLING PORTAL SESSION
 */
export async function createBillingPortalSession({
  customerId,
  portalType,
  returnUrl = `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`,
}: {
  customerId: string;
  portalType: BillingPortalType;
  returnUrl?: string;
}): Promise<Stripe.Response<Stripe.BillingPortal.Session>> {
  // Reloaded whenever a type is missing so a configuration added by the portal script is found without a restart
  if (!cachedPortalSessions.has(portalType)) {
    logger.info('Loading billing portal configurations from Stripe');
    await stripe.billingPortal.configurations.list({ active: true }).then((res) => {
      res.data.forEach((configuration) => {
        if (configuration.metadata?.type) {
          cachedPortalSessions.set(configuration.metadata.type as BillingPortalType, configuration);
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

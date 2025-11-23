import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { sendWelcomeToProEmail } from '@jetstream/email';
import { getErrorMessage, getErrorMessageAndStackObj, groupByFlat } from '@jetstream/shared/utils';
import {
  EntitlementsAccess,
  JetstreamPrice,
  JetstreamPricesByLookupKey,
  JetstreamPriceTier,
  Maybe,
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

const stripe = ENV.STRIPE_API_KEY ? new Stripe(ENV.STRIPE_API_KEY) : ({} as Stripe);

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
      case 'customer.subscription.updated': {
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

function filterInactiveSubscriptions(subscriptions: Stripe.Subscription[]) {
  return subscriptions.filter((subscription) => activeSubscriptionStatuses.has(subscription.status));
}

async function fetchCustomerWithSubscriptionsById({ customerId }: { customerId: string }) {
  return await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });
}

export async function fetchPrices({ lookupKeys }: { lookupKeys: typeof STRIPE_PRICE_KEYS }): Promise<JetstreamPricesByLookupKey> {
  const cache = priceCache.get(lookupKeys);
  if (cache?.expiresAt && cache.expiresAt > Date.now()) {
    return cache.prices;
  }

  const prices = await stripe.prices
    .list({
      lookup_keys: lookupKeys as unknown as string[],
      expand: ['data.product'],
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
      tiers:
        price.tiers?.map(
          (tier) =>
            ({
              flatAmount: tier.flat_amount ? tier.flat_amount / 100 : null,
              unitAmount: tier.unit_amount ? tier.unit_amount / 100 : null,
              upTo: tier.up_to,
            }) as JetstreamPriceTier,
        ) || null,
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

export async function fetchCustomerEntitlements({ customerId }: { customerId: string }) {
  return await stripe.entitlements.activeEntitlements.list({ customer: customerId });
}

export async function fetchCustomerWithSubscriptionsByJetstreamId({ userId }: { userId: string }) {
  const customerWithSubscriptions = await stripe.customers.search({
    query: `metadata["userId"]:"${userId}"`,
    limit: 1,
    expand: ['subscriptions', 'entitlements'],
  });
  return customerWithSubscriptions.data[0];
}

export async function getUserFacingStripeCustomer({ customerId }: { customerId: string }): Promise<StripeUserFacingCustomer | null> {
  try {
    const stripeCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return null;
    }
    return convertCustomerWithSubscriptionsToUserFacing(stripeCustomer);
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
        ({
          id,
          billing_cycle_anchor,
          cancel_at,
          cancel_at_period_end,
          canceled_at,
          // current_period_end,
          // current_period_start,
          ended_at,
          items,
          start_date,
          status,
        }) => ({
          id,
          // TODO: validate that the dates are correct (should be if server is on UTC I think?)
          billingCycleAnchor: formatISO(fromUnixTime(billing_cycle_anchor)),
          cancelAt: cancel_at ? formatISO(fromUnixTime(cancel_at)) : null,
          cancelAtPeriodEnd: cancel_at_period_end,
          canceledAt: canceled_at ? formatISO(fromUnixTime(canceled_at)) : null,
          // TODO: these are moved to line items in stripe v18
          // currentPeriodEnd: formatISO(fromUnixTime(current_period_end)),
          // currentPeriodStart: formatISO(fromUnixTime(current_period_start)),
          endedAt: ended_at ? formatISO(fromUnixTime(ended_at)) : null,
          startDate: formatISO(fromUnixTime(start_date)),
          status: status.toUpperCase() as Uppercase<Stripe.Subscription.Status>,
          items: items.data.map(({ id, price, quantity }) => ({
            id,
            priceId: price.id,
            active: price.active,
            product: price.product as string,
            lookupKey: price.lookup_key,
            unitAmount: (price.unit_amount || 0) / 100,
            recurringInterval: (price.recurring?.interval?.toUpperCase() || null) as StripeUserFacingSubscriptionItem['recurringInterval'],
            recurringIntervalCount: price.recurring?.interval_count || null,
            quantity: quantity ?? 1,
          })),
        }),
      ) || [],
  };
  return customerWithSubscriptions;
}

export async function createCustomer(user: Pick<UserProfile, 'id' | 'name' | 'email'>, type: 'TEAM' | 'USER') {
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
 * Update customer metadata to ensure that it matches based on the current state of Jetstream
 */
export async function updateCustomerMetadata(
  customerId: string,
  metadata: { userId: string; teamId: string | null; type: 'TEAM' | 'USER' },
) {
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

export async function updateEntitlements(customerId: string, entitlements: Stripe.Entitlements.ActiveEntitlement[]) {
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
    },
  );

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

  const metadata = (session.metadata || {}) as { userId?: string; teamId?: string; type?: 'USER' | 'TEAM' };
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
    const team = await teamDbService.upsertTeamWithBillingAccount({ userId, billingAccountCustomerId: customerId });
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
}: { userId: string; teamId?: string; customerId?: null } | { userId: string; teamId: string; customerId: string }) {
  if (teamId) {
    return synchronizeStripeWithJetstreamTeamIfRequired({ teamId, customerId });
  }
  return synchronizeStripeWithJetstreamUserIfRequired({ userId, customerId });
}

export async function synchronizeStripeWithJetstreamUserIfRequired({
  userId,
  customerId,
}: { userId: string; customerId?: null; force?: boolean } | { userId: string; customerId: string }) {
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

    const stripeCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return { success: false, reason: 'CUSTOMER_IS_DELETED', didUpdate } as const;
    }

    if (!stripeCustomer.subscriptions?.data) {
      return { success: false, reason: 'MISSING_SUBSCRIPTIONS', didUpdate } as const;
    }

    const subscriptions = filterInactiveSubscriptions(stripeCustomer.subscriptions.data);
    const priceRecordCount = subscriptions.flatMap((subscription) => subscription.items.data.length).length;

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
}: { teamId: string; customerId?: null; force?: boolean } | { teamId: string; customerId: string }) {
  try {
    let didUpdate = false;
    const team = await teamDbService.findById({ teamId });
    const entitlements = await teamDbService.findEntitlements({ teamId });
    const teamSubscriptions = await teamDbService.findSubscriptions({ teamId });

    // TODO: would we ever need to go in the opposite direction and delete things in Jetstream?
    const billingAccountCustomerId = team?.billingAccount?.customerId;
    if (!billingAccountCustomerId) {
      return { success: true, didUpdate } as const;
    }

    customerId = billingAccountCustomerId || customerId;

    if (!customerId) {
      return { success: false, reason: 'NO_CUSTOMER_ID' } as const;
    }

    const stripeCustomer = await fetchCustomerWithSubscriptionsById({ customerId });
    if (stripeCustomer.deleted) {
      return { success: false, reason: 'CUSTOMER_IS_DELETED', didUpdate } as const;
    }

    if (!stripeCustomer.subscriptions?.data) {
      return { success: false, reason: 'MISSING_SUBSCRIPTIONS', didUpdate } as const;
    }

    const subscriptions = filterInactiveSubscriptions(stripeCustomer.subscriptions.data);
    const priceRecordCount = subscriptions.flatMap((subscription) => subscription.items.data.length).length;

    /**
     * Check if we need to synchronize
     */
    const hasCorrectSubscriptionItemCount = priceRecordCount === teamSubscriptions.length;
    // This isn't very scalable as we introduce more entitlements, but that is likely going to be a really slow process
    const areEntitlementsEnabled =
      !!entitlements?.chromeExtension && !!entitlements?.googleDrive && !!entitlements?.desktop && !!entitlements?.recordSync;
    const hasCorrectEntitlements = priceRecordCount > 0 ? areEntitlementsEnabled : !areEntitlementsEnabled;
    if (hasCorrectSubscriptionItemCount && hasCorrectEntitlements) {
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
  const hasTeamPlan = subscriptions.find(({ items }) => items.data.find((item) => item.price.lookup_key?.startsWith('TEAM_')));

  // Ensure team is auto-created if required and Stripe is updated to reflect this
  if (hasTeamPlan && userId && (!teamId || type !== 'TEAM')) {
    type = 'TEAM';
    const team = await teamDbService.upsertTeamWithBillingAccount({ userId, billingAccountCustomerId: customer.id });
    teamId = team.id;
    // ensure stripe has proper metadata
    await updateCustomerMetadata(customer.id, { userId, teamId, type: 'TEAM' });
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
    await subscriptionDbService.updateTeamSubscriptionStateForCustomer({
      teamId,
      customerId: customer.id,
      subscriptions: filterInactiveSubscriptions(subscriptions),
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
}: {
  user: Pick<UserProfile, 'id' | 'name' | 'email'>;
  priceId: string;
  mode: Stripe.Checkout.SessionCreateParams.Mode;
  customerId?: string;
  type: 'TEAM' | 'USER';
  teamId?: string;
}) {
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
        quantity: 1,
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
    metadata: { userId: user.id, teamId: teamId || null, type },
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
}) {
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
 * Update Stripe subscription item quantity to match the number of active users in Jetstream
 * This will invoice the customer immediately if required based on their plan and the number of users
 */
export async function updateSubscriptionItemQuantity(
  customerId: string,
  newQuantity: number,
): Promise<{
  success: boolean;
  didUpdate: boolean;
  subscriptionId?: Maybe<string>;
  subscriptionItemId?: Maybe<string>;
  quantity?: Maybe<number>;
  error?: Maybe<string>;
}> {
  let subscription: Stripe.Subscription | undefined = undefined;
  let subscriptionItem: Stripe.SubscriptionItem | undefined = undefined;
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['subscriptions'],
    });

    if (customer.deleted) {
      throw new Error('Customer is deleted');
    }

    const subscriptions = (customer.subscriptions?.data || []).filter((subscription) =>
      ['active', 'past_due', 'unpaid'].includes(subscription.status),
    );
    subscription = subscriptions[0];
    const subscriptionItems = subscriptions[0]?.items?.data || [];
    subscriptionItem = subscriptionItems[0];

    if (subscriptions.length !== 1 || !subscription) {
      throw new Error('Customer does not have an eligible subscription');
    }

    if (subscriptionItems.length !== 1 || !subscriptionItem) {
      throw new Error('Customer does not have an eligible subscription item');
    }

    if (subscriptionItem.quantity === newQuantity) {
      logger.info(
        {
          customerId,
          quantity: newQuantity,
          subscriptionId: subscription?.id,
          subscriptionItemId: subscriptionItem?.id,
        },
        `Skipping Stripe quantity update, quantity already matches desired number`,
      );
      return {
        success: true,
        didUpdate: false,
        subscriptionId: subscription.id,
        subscriptionItemId: subscriptionItem.id,
        quantity: newQuantity,
        error: null,
      };
    }

    await stripe.subscriptionItems.update(subscriptionItem.id, {
      payment_behavior: 'allow_incomplete',
      proration_behavior: 'always_invoice',
      quantity: newQuantity,
    });

    logger.info(
      {
        customerId,
        quantity: newQuantity,
        subscriptionId: subscription?.id,
        subscriptionItemId: subscriptionItem?.id,
      },
      `Updated Stripe subscription item quantity`,
    );

    return {
      success: true,
      didUpdate: true,
      subscriptionId: subscription.id,
      subscriptionItemId: subscriptionItem.id,
      quantity: newQuantity,
      error: null,
    };
  } catch (ex) {
    logger.warn(
      {
        customerId,
        quantity: newQuantity,
        subscriptionId: subscription?.id,
        subscriptionItemId: subscriptionItem?.id,
        ...getErrorMessageAndStackObj(ex),
      },
      `Error updating subscription quantity: ${getErrorMessage(ex)}`,
    );
    return {
      success: false,
      didUpdate: false,
      subscriptionId: subscription?.id,
      subscriptionItemId: subscriptionItem?.id,
      quantity: newQuantity,
      error: getErrorMessage(ex),
    };
  }
}

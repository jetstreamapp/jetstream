import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { sendWelcomeToProEmail } from '@jetstream/email';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { EntitlementsAccess, StripeUserFacingCustomer, StripeUserFacingSubscriptionItem } from '@jetstream/types';
import { formatISO, fromUnixTime } from 'date-fns';
import { isString } from 'lodash';
import Stripe from 'stripe';
import * as subscriptionDbService from '../db/subscription.db';
import * as userDbService from '../db/user.db';

const stripe = ENV.STRIPE_API_KEY ? new Stripe(ENV.STRIPE_API_KEY) : ({} as Stripe);

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

export function filterInactiveSubscriptions(subscriptions: Stripe.Subscription[]) {
  return subscriptions.filter((subscription) => activeSubscriptionStatuses.has(subscription.status));
}

export async function fetchCustomerWithSubscriptionsById({ customerId }: { customerId: string }) {
  return await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });
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
          current_period_end,
          current_period_start,
          ended_at,
          items,
          start_date,
          status,
        }) => ({
          id: id,
          // TODO: validate that the dates are correct (should be if server is on UTC I think?)
          billingCycleAnchor: formatISO(fromUnixTime(billing_cycle_anchor)),
          cancelAt: cancel_at ? formatISO(fromUnixTime(cancel_at)) : null,
          cancelAtPeriodEnd: cancel_at_period_end,
          canceledAt: canceled_at ? formatISO(fromUnixTime(canceled_at)) : null,
          currentPeriodEnd: formatISO(fromUnixTime(current_period_end)),
          currentPeriodStart: formatISO(fromUnixTime(current_period_start)),
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
        })
      ) || [],
  };
  return customerWithSubscriptions;
}

export async function createCustomer(user: UserProfile) {
  return await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
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
    }
  );

  await subscriptionDbService.updateUserEntitlements(customerId, entitlementAccess);
}

export async function saveSubscriptionFromCompletedSession({ sessionId }: { sessionId: string }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session.customer) {
    throw new Error('Invalid checkout session - a customer is required to be associated with the session');
  }

  // Update customer subscriptions - will also be updated via webhook
  const customerOrId = session.customer;
  const customer = await fetchCustomerWithSubscriptionsById({ customerId: isString(customerOrId) ? customerOrId : customerOrId.id });
  await saveOrUpdateSubscription({ customer, sendWelcomeEmail: true });

  // Update customer entitlements - will also be updated via webhook
  await fetchAndUpdateEntitlements(customer.id);
}

/**
 * Can be used to manually synchronize Stripe with Jetstream
 * This is generally only needed if a webhook delivery fails, but we also perform this operation when a user accesses the billing page
 * and we detect things are are out of sync
 */
export async function synchronizeStripeWithJetstreamIfRequired({
  userId,
  customerId,
  force = false,
}: { userId: string; customerId?: null; force?: boolean } | { userId: string; customerId: string; force: true }) {
  try {
    let didUpdate = false;
    const userProfile = await userDbService.findById(userId);

    // TODO: would we ever need to go in the opposite direction and delete things in Jetstream?
    const billingAccountCustomerId = userProfile?.billingAccount?.customerId;
    if (!billingAccountCustomerId) {
      if (customerId && force) {
        await userDbService.createBillingAccountIfNotExists({ userId, customerId });
      } else {
        return { success: true, didUpdate } as const;
      }
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
    if (!force && hasCorrectSubscriptionItemCount && hasCorrectEntitlements) {
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

/**
 * Synchronize subscription state from Stripe to Jetstream
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

  let { userId } = customer.metadata;
  const subscriptions = customer.subscriptions?.data ?? [];

  // customer does not have Jetstream id attached - update Stripe to ensure data integrity (if possible)
  if (!userId) {
    const billingAccount = await userDbService.findBillingAccountByCustomerId({ customerId: customer.id });
    if (!billingAccount) {
      logger.error(
        {
          customerId: customer.id,
          remedy: 'Manually create a billing account in Jetstream DB for this customer, then retry event or update subscription to re-sync',
        },
        'Billing Account does not exist, unable to save subscriptions'
      );
      return;
    }
    userId = billingAccount.userId;
    await stripe.customers.update(customer.id, { metadata: { userId } });
  } else {
    // For new subscriptions, create a billing account if it does not exist
    await userDbService.createBillingAccountIfNotExists({ userId: userId, customerId: customer.id });
  }

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
}: {
  user: UserProfile;
  priceId: string;
  mode: Stripe.Checkout.SessionCreateParams.Mode;
  customerId?: string;
}) {
  if (!customerId) {
    const customer = await createCustomer(user);
    customerId = customer.id;
  }

  await userDbService.createBillingAccountIfNotExists({ userId: user.id, customerId });

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    mode,
    success_url: `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/complete?subscribeAction=success&sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ENV.JETSTREAM_CLIENT_URL}/settings/billing?subscribeAction=canceled`,
    automatic_tax: { enabled: false },
    client_reference_id: user.id,
    currency: 'usd',
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    billing_address_collection: 'auto',
    customer_update: {
      address: 'auto',
    },
    payment_method_data: {
      allow_redisplay: 'always',
    },
    metadata: { userId: user.id },
  });

  return session;
}

/**
 * CREATE BILLING PORTAL SESSION
 */
export async function createBillingPortalSession({ customerId }: { customerId: string }) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`,
  });
  return session;
}

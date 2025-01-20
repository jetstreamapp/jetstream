import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { EntitlementsAccess, StripeUserFacingCustomer, StripeUserFacingSubscriptionItem } from '@jetstream/types';
import { formatISO, fromUnixTime } from 'date-fns';
import { isString } from 'lodash';
import Stripe from 'stripe';
import * as subscriptionDbService from '../db/subscription.db';
import * as userDbService from '../db/user.db';

const stripe = ENV.STRIPE_API_KEY ? new Stripe(ENV.STRIPE_API_KEY) : ({} as Stripe);

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
      case 'entitlements.active_entitlement_summary.updated':
        {
          await updateEntitlements(event.data.object);
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.updated': {
        const { customer: customerOrId } = event.data.object;
        const customer = await fetchCustomerWithSubscriptionsById({ customerId: isString(customerOrId) ? customerOrId : customerOrId.id });
        await saveOrUpdateSubscription({ customer });
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

export async function fetchCustomerWithSubscriptionsById({ customerId }: { customerId: string }) {
  return await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });
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
    const subscriptionInfo: StripeUserFacingCustomer = {
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
              recurringInterval: (price.recurring?.interval?.toUpperCase() ||
                null) as StripeUserFacingSubscriptionItem['recurringInterval'],
              recurringIntervalCount: price.recurring?.interval_count || null,
              quantity: quantity ?? 1,
            })),
          })
        ) || [],
    };
    return subscriptionInfo;
  } catch (ex) {
    return null;
  }
}

export async function createCustomer(user: UserProfile) {
  return await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
}

export async function updateEntitlements(eventData: Stripe.Entitlements.ActiveEntitlementSummary) {
  const { customer, entitlements } = eventData;
  const entitlementAccess = entitlements.data.reduce(
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
    }
  );

  await subscriptionDbService.updateUserEntitlements(customer, entitlementAccess);
}

export async function saveSubscriptionFromCompletedSession({ sessionId }: { sessionId: string }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session.customer) {
    throw new Error('Invalid checkout session - a customer is required to be associated with the session');
  }

  const customerOrId = session.customer;
  const customer = await fetchCustomerWithSubscriptionsById({ customerId: isString(customerOrId) ? customerOrId : customerOrId.id });
  await saveOrUpdateSubscription({ customer });
}

/**
 * Synchronize subscription state from Stripe to Jetstream
 */
export async function saveOrUpdateSubscription({ customer }: { customer: Stripe.Customer | Stripe.DeletedCustomer }) {
  if (customer.deleted) {
    logger.info({ customerId: customer.id }, '[Stripe] Customer deleted: %s', customer.id);
    await subscriptionDbService.cancelAllSubscriptionsForUser({ customerId: customer.id });
    return;
  }

  let { userId } = customer.metadata;
  const subscriptions = customer.subscriptions?.data ?? [];

  // customer does not have Jetstream id attached - update Stripe to ensure data integrity (if possible)
  if (!userId) {
    const billingAccount = await userDbService.findByBillingAccountByCustomerId({ customerId: customer.id });
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
    subscriptions,
  });
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

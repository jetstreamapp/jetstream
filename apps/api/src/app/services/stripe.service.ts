import { ENV, logger } from '@jetstream/api-config';
import { UserProfile } from '@jetstream/auth/types';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { isString } from 'lodash';
import Stripe from 'stripe';
import * as subscriptionDbService from '../db/subscription.db';

const stripe = new Stripe(ENV.STRIPE_API_KEY || '');

export async function handleStripeWebhook({ signature, payload }: { signature?: string; payload: string | Buffer }) {
  if (!ENV.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe Webhook secret not set');
  }
  if (!signature) {
    throw new Error('Missing webhook signature');
  }
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, ENV.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        // event.data
        // TODO: create subscription for user
        break;
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
    expand: ['subscriptions'],
  });
  return customerWithSubscriptions.data[0];
}

export async function createCustomer(user: UserProfile) {
  return await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
}

export async function saveSubscriptionFromCompletedSession({ sessionId, userId }: { userId: string; sessionId: string }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionItems = await stripe.checkout.sessions.listLineItems(sessionId);

  // since we only allow one subscription, just get first item
  const priceId = sessionItems.data[0]?.price?.id;

  if (session.status !== 'complete' || !session.customer || !priceId) {
    throw new Error('Invalid checkout session');
  }

  const customerId = isString(session.customer) ? session.customer : session.customer.id;

  return await subscriptionDbService.upsertSubscription({ customerId, userId, providerId: priceId, planId: priceId });
}

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

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode,
    success_url: `${ENV.JETSTREAM_SERVER_URL}/api/billing/checkout-session/complete?subscribeAction=success&sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ENV.JETSTREAM_CLIENT_URL}/app/settings/billing?subscribeAction=canceled`,
    automatic_tax: { enabled: false },
    client_reference_id: user.id,
    currency: 'usd',
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    metadata: { userId: user.id },
  });

  return session;
}

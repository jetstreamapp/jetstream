import { ENV, logger } from '@jetstream/api-config';
import { UserProfileUi } from '@jetstream/types';
import { Request, Response } from 'express';
import { z } from 'zod';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  webhook: {
    controllerFn: () => stripeWebhookHandler,
    validators: {
      query: z.object({
        priceId: z.string(),
      }),
      hasSourceOrg: false,
    },
  },
  createCheckoutSession: {
    controllerFn: () => createCheckoutSessionHandler,
    validators: {
      body: z.object({
        priceId: z.string().regex(/^price_[\w\d]+$/),
      }),
      hasSourceOrg: false,
    },
  },
  processCheckoutSuccess: {
    controllerFn: () => processCheckoutSuccessHandler,
    validators: {
      query: z.object({
        subscribeAction: z.string().optional(),
        sessionId: z.string().optional(),
      }),
      hasSourceOrg: false,
    },
  },
  getSubscriptions: {
    controllerFn: () => getSubscriptionsHandler,
    validators: {
      hasSourceOrg: false,
    },
  },
  createBillingPortalSession: {
    controllerFn: () => createBillingPortalSession,
    validators: {
      hasSourceOrg: false,
    },
  },
};

const ensureStripeIsInitialized = () => {
  if (!ENV.STRIPE_API_KEY) {
    throw new Error('Stripe API Key is not set');
  }
};

const stripeWebhookHandler = async (req: Request, res: Response) => {
  try {
    ensureStripeIsInitialized();
    const payload = req.body;
    const signature = req.get('stripe-signature');
    await stripeService.handleStripeWebhook({ payload, signature });
    res.status(200).end();
  } catch (err) {
    return res.status(400).send(`Error: ${err.message}`);
  }
};

const createCheckoutSessionHandler = createRoute(
  routeDefinition.createCheckoutSession.validators,
  async ({ user: sessionUser, body }, req, res) => {
    ensureStripeIsInitialized();
    const { priceId } = body;

    const user = await userDbService.findByIdWithSubscriptions(sessionUser.id);

    const sessions = await stripeService.createCheckoutSession({
      mode: 'subscription',
      priceId,
      customerId: user.billingAccount?.customerId,
      user,
    });

    redirect(res, sessions.url);
  }
);

const processCheckoutSuccessHandler = createRoute(routeDefinition.processCheckoutSuccess.validators, async ({ user, query }, req, res) => {
  ensureStripeIsInitialized();
  const { subscribeAction, sessionId } = query;

  if (!subscribeAction || !sessionId) {
    return redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
  }

  await stripeService.saveSubscriptionFromCompletedSession({ sessionId });

  redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
});

const getSubscriptionsHandler = createRoute(routeDefinition.getSubscriptions.validators, async ({ user }, req, res) => {
  ensureStripeIsInitialized();

  const {
    success,
    reason,
    didUpdate,
    stripeCustomer: internalCustomer,
  } = await stripeService.synchronizeStripeWithJetstreamIfRequired({ userId: user.id });
  if (!success) {
    logger.error({ userId: user.id }, `Did not synchronize Stripe with Jetstream: ${reason}`);
    sendJson(res, { customer: null, didUpdate });
    return;
  }
  if (!internalCustomer) {
    sendJson(res, { customer: null, didUpdate });
    return;
  }
  const customer = stripeService.convertCustomerWithSubscriptionsToUserFacing(internalCustomer);

  let userProfile: UserProfileUi | undefined;
  if (didUpdate) {
    userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id });
  }

  sendJson(res, { customer, didUpdate, userProfile });
});

const createBillingPortalSession = createRoute(
  routeDefinition.createBillingPortalSession.validators,
  async ({ user: sessionUser }, req, res) => {
    ensureStripeIsInitialized();
    const user = await userDbService.findByIdWithSubscriptions(sessionUser.id);

    if (!user.billingAccount) {
      throw new Error('User does not have a billing account');
    }

    const sessions = await stripeService.createBillingPortalSession({
      customerId: user.billingAccount?.customerId,
    });

    redirect(res, sessions.url);
  }
);

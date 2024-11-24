import { ENV } from '@jetstream/api-config';
import { Request, Response } from 'express';
import { z } from 'zod';
import * as subscriptionDbService from '../db/subscription.db';
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
};

const stripeWebhookHandler = async (req: Request, res: Response) => {
  try {
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
    const { priceId } = body;

    const user = await userDbService.findById(sessionUser.id);

    const sessions = await stripeService.createCheckoutSession({
      mode: 'subscription',
      priceId,
      customerId: user.subscriptions?.[0]?.customerId,
      user,
    });

    redirect(res, sessions.url);
  }
);

const processCheckoutSuccessHandler = createRoute(
  routeDefinition.processCheckoutSuccess.validators,
  async ({ user: sessionUser, query }, req, res) => {
    const { subscribeAction, sessionId } = query;

    if (!subscribeAction || !sessionId) {
      return redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
    }

    const user = await userDbService.findById(sessionUser.id);
    if (!user.subscriptions?.[0]?.customerId) {
      return redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
    }

    await stripeService.saveSubscriptionFromCompletedSession({
      sessionId,
      userId: user.id,
    });

    redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
  }
);

const getSubscriptionsHandler = createRoute(routeDefinition.getSubscriptions.validators, async ({ user }, req, res) => {
  const subscriptions = await subscriptionDbService.findByUserId(user.id);

  sendJson(res, subscriptions);
});

import { ENV, logger } from '@jetstream/api-config';
import { UserProfileUi } from '@jetstream/types';
import { Request, Response } from 'express';
import { z } from 'zod';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  webhook: {
    controllerFn: () => stripeWebhookHandler,
    validators: {
      hasSourceOrg: false,
    },
  },
  createCheckoutSession: {
    controllerFn: () => createCheckoutSessionHandler,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        priceId: z
          .string()
          .regex(/^price_[\w\d]+$/)
          .refine((val) => val === ENV.STRIPE_PRO_ANNUAL_PRICE_ID || val === ENV.STRIPE_PRO_MONTHLY_PRICE_ID, {
            message: 'Invalid price ID',
          }),
      }),
    },
  },
  processCheckoutSuccess: {
    controllerFn: () => processCheckoutSuccessHandler,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        subscribeAction: z.string().optional(),
        sessionId: z.string().optional(),
      }),
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
  createTeamCheckoutSessionHandler: {
    controllerFn: () => createTeamCheckoutSessionHandler,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        priceId: z
          .string()
          .regex(/^price_[\w\d]+$/)
          .refine((val) => val === ENV.STRIPE_TEAM_ANNUAL_PRICE_ID || val === ENV.STRIPE_TEAM_MONTHLY_PRICE_ID, {
            message: 'Invalid price ID',
          }),
      }),
    },
  },
  processTeamCheckoutSuccessHandler: {
    controllerFn: () => processTeamCheckoutSuccessHandler,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        subscribeAction: z.string().optional(),
        sessionId: z.string().optional(),
      }),
    },
  },
  createTeamBillingPortalSession: {
    controllerFn: () => createTeamBillingPortalSession,
    validators: {
      hasSourceOrg: false,
    },
  },
};

const stripeWebhookHandler = async (req: Request, res: Response) => {
  try {
    stripeService.ensureStripeIsInitialized();
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
    stripeService.ensureStripeIsInitialized();
    const { priceId } = body;

    const user = await userDbService.findByIdWithSubscriptions(sessionUser.id);

    const sessions = await stripeService.createCheckoutSession({
      mode: 'subscription',
      priceId,
      customerId: user.billingAccount?.customerId,
      user,
      type: 'USER',
    });

    redirect(res, sessions.url);
  }
);

const processCheckoutSuccessHandler = createRoute(routeDefinition.processCheckoutSuccess.validators, async ({ user, query }, req, res) => {
  stripeService.ensureStripeIsInitialized();
  const { subscribeAction, sessionId } = query;

  if (!subscribeAction || !sessionId) {
    return redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
  }

  await stripeService.saveSubscriptionFromCompletedSession({ sessionId });

  redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
});

const getSubscriptionsHandler = createRoute(routeDefinition.getSubscriptions.validators, async ({ user }, req, res) => {
  stripeService.ensureStripeIsInitialized();

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
    stripeService.ensureStripeIsInitialized();
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

const createTeamCheckoutSessionHandler = createRoute(
  routeDefinition.createTeamCheckoutSessionHandler.validators,
  async ({ user: sessionUser, body }, req, res) => {
    const { priceId } = body;
    stripeService.ensureStripeIsInitialized();

    const user = await userDbService.findByIdWithSubscriptions(sessionUser.id);
    const team = await teamDbService.findByUserId({ userId: sessionUser.id });

    const sessions = await stripeService.createCheckoutSession({
      mode: 'setup',
      priceId,
      customerId: user.billingAccount?.customerId,
      user,
      type: 'TEAM',
      team,
    });

    redirect(res, sessions.url);
  }
);

const processTeamCheckoutSuccessHandler = createRoute(
  routeDefinition.processTeamCheckoutSuccessHandler.validators,
  async ({ user, query }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const { subscribeAction, sessionId } = query;

    if (!subscribeAction || !sessionId) {
      // FIXME: figure out correct path
      return redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/app/teams/billing`);
    }

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId });

    redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
  }
);

const createTeamBillingPortalSession = createRoute(
  routeDefinition.createTeamBillingPortalSession.validators,
  async ({ user: sessionUser }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const team = await teamDbService.findByUserId({ userId: sessionUser.id });

    if (!team.teamBillingAccount) {
      throw new Error('Team does not have a billing account');
    }

    const sessions = await stripeService.createBillingPortalSession({
      customerId: team.teamBillingAccount.customerId,
    });

    redirect(res, sessions.url);
  }
);

import { ENV, logger } from '@jetstream/api-config';
import type { Request, Response } from '@jetstream/api-types';
import { refreshSessionUser } from '@jetstream/auth/server';
import { STRIPE_PRICE_KEYS, TeamMemberRole, TeamMemberRoleSchema, UserProfileUi } from '@jetstream/types';
import Stripe from 'stripe';
import { z } from 'zod';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import { NotFoundError, UserFacingError } from '../utils/error-handler';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  webhook: {
    controllerFn: () => stripeWebhookHandler,
    validators: {
      hasSourceOrg: false,
    },
  },
  fetchPrices: {
    controllerFn: () => fetchPrices,
    validators: {
      hasSourceOrg: false,
    },
  },
  createCheckoutSession: {
    controllerFn: () => createCheckoutSessionHandler,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        priceLookupKey: z.enum(STRIPE_PRICE_KEYS),
      }),
    },
  },
  processCheckoutSuccess: {
    controllerFn: () => processCheckoutSuccessHandler,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        action: z.enum(['complete', 'cancel']),
      }),
      query: z.object({
        sessionId: z.string(),
        customerId: z.string(),
        type: z.string(),
        userId: z.string(),
        teamId: z.string().optional(),
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
};

const stripeWebhookHandler = async (req: Request, res: Response) => {
  try {
    stripeService.ensureStripeIsInitialized();
    const payload = req.body as string | Buffer;
    const signature = req.get('stripe-signature');
    await stripeService.handleStripeWebhook({ payload, signature });
    res.status(200).end();
  } catch (err) {
    return res.status(400).send(`Error: ${err.message}`);
  }
};

const fetchPrices = createRoute(routeDefinition.fetchPrices.validators, async ({ user, body }, req, res) => {
  stripeService.ensureStripeIsInitialized();

  const pricesByLookupKey = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS });

  sendJson(res, pricesByLookupKey);
});

const createCheckoutSessionHandler = createRoute(
  routeDefinition.createCheckoutSession.validators,
  async ({ user: sessionUser, body }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const { priceLookupKey } = body;

    const priceId = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS }).then((prices) => prices[priceLookupKey]?.id);
    if (!priceId) {
      res.log.error({ priceLookupKey }, 'Price lookup key not found');
      throw new UserFacingError(`There was a problem initializing your billing session`);
    }

    const user = await userDbService.findByIdWithSubscriptions(sessionUser.id);
    const team = await teamDbService.findByUserIdWithSubscriptions({ userId: sessionUser.id });
    const teamMember = team?.members.find(({ userId }) => userId === sessionUser.id);

    const type = priceLookupKey.startsWith('TEAM_') ? 'TEAM' : 'USER';
    let session: Stripe.Response<Stripe.Checkout.Session> | null = null;

    if (type === 'TEAM') {
      if (team && teamMember?.role !== 'ADMIN' && teamMember?.role !== 'BILLING') {
        throw new UserFacingError(`You do not have permission to create a billing session for this team`);
      }
      session = await stripeService.createCheckoutSession({
        mode: 'subscription',
        priceId,
        // Customer will be created if it doesn't exist
        customerId: user.billingAccount?.customerId,
        user,
        type: 'TEAM',
        teamId: team?.id,
      });
    } else {
      session = await stripeService.createCheckoutSession({
        mode: 'subscription',
        priceId,
        // Customer will be created if it doesn't exist
        customerId: user.billingAccount?.customerId,
        user,
        type: 'USER',
      });
    }

    if (!session) {
      throw new Error('Failed to create checkout session');
    }

    if (req.accepts('json')) {
      sendJson(res, { url: session.url });
    } else {
      // Legacy path - TODO: remove once everything is deployed
      redirect(res, session.url);
    }
  },
);

const processCheckoutSuccessHandler = createRoute(
  routeDefinition.processCheckoutSuccess.validators,
  async ({ params, query }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const { action } = params;
    const { sessionId } = query;

    if (action === 'complete') {
      const { teamId } = await stripeService.saveSubscriptionFromCompletedSession({ sessionId });
      await refreshSessionUser(req);
      if (teamId) {
        redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/teams`);
        return;
      }
      redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
      return;
    }

    redirect(res, `${ENV.JETSTREAM_CLIENT_URL}/settings/billing`);
  },
);

const getSubscriptionsHandler = createRoute(routeDefinition.getSubscriptions.validators, async ({ user, teamMembership }, req, res) => {
  stripeService.ensureStripeIsInitialized();

  const teamId = teamMembership?.teamId;
  const teamRole = teamMembership?.role;

  if (teamId && teamRole !== 'ADMIN' && teamRole !== 'BILLING') {
    sendJson(res, { customer: null, pricesByLookupKey: null, didUpdate: false });
    return;
  }

  const {
    success,
    reason,
    didUpdate,
    stripeCustomer: internalCustomer,
  } = await stripeService.synchronizeStripeWithJetstreamIfRequiredForTeamOrUser({ userId: user.id, teamId });
  if (!success) {
    logger.error({ userId: user.id }, `Did not synchronize Stripe with Jetstream: ${reason}`);
    sendJson(res, { customer: null, pricesByLookupKey: null, hasManualBilling: false, didUpdate });
    return;
  }
  if (!internalCustomer) {
    sendJson(res, { customer: null, pricesByLookupKey: null, hasManualBilling: false, didUpdate });
    return;
  }
  const customer = stripeService.convertCustomerWithSubscriptionsToUserFacing(internalCustomer);
  const pricesByLookupKey = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS });
  const hasManualBilling = await userDbService.hasManualBilling({ userId: user.id });

  let userProfile: UserProfileUi | undefined;
  if (didUpdate) {
    userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id });
  }

  sendJson(res, { customer, pricesByLookupKey, hasManualBilling, didUpdate, userProfile });
});

const createBillingPortalSession = createRoute(
  routeDefinition.createBillingPortalSession.validators,
  async ({ user: sessionUser }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const billingAccount = await userDbService.getBillingAccount(sessionUser.id);
    let portalType: 'USER' | 'TEAM' | 'MANUAL' = 'USER';

    if (!billingAccount?.customerId) {
      throw new NotFoundError('Billing account not found');
    }

    if (
      billingAccount?.teamRole &&
      !([TeamMemberRoleSchema.Enum.ADMIN, TeamMemberRoleSchema.Enum.BILLING] as TeamMemberRole[]).includes(billingAccount.teamRole)
    ) {
      throw new UserFacingError('Billing portal not allowed for this account');
    }

    if (billingAccount?.manualBilling) {
      portalType = 'MANUAL';
    } else if (billingAccount?.teamId) {
      portalType = 'TEAM';
    }

    const sessions = await stripeService.createBillingPortalSession({
      customerId: billingAccount.customerId,
      portalType,
    });

    redirect(res, sessions.url);
  },
);

import { ENV, getLogger } from '@jetstream/api-config';
import { refreshSessionUser } from '@jetstream/auth/server';
import { CheckoutSessionRequestSchema, STRIPE_PRICE_KEYS, TeamMemberRole, TeamMemberRoleSchema, UserProfileUi } from '@jetstream/types';
import Stripe from 'stripe';
import { z } from 'zod';
import * as subscriptionDbService from '../db/subscription.db';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import type { Request, Response } from '../types/route.types';
import { NotFoundError, UserFacingError } from '../utils/error-handler';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  webhook: {
    controllerFn: () => stripeWebhookHandler,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  fetchPrices: {
    controllerFn: () => fetchPrices,
    responseType: z.record(z.string(), z.any()), // FIXME: improve this
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  createCheckoutSession: {
    controllerFn: () => createCheckoutSessionHandler,
    responseType: z.object({ url: z.url() }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: CheckoutSessionRequestSchema,
    } satisfies RouteValidator,
  },
  processCheckoutSuccess: {
    controllerFn: () => processCheckoutSuccessHandler,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
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
    } satisfies RouteValidator,
  },
  getSubscriptions: {
    controllerFn: () => getSubscriptionsHandler,
    responseType: z.object({
      customer: z.any(),
      pricesByLookupKey: z.any(),
      hasManualBilling: z.boolean(),
      didUpdate: z.boolean(),
      userProfile: z.any(),
    }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  createBillingPortalSession: {
    controllerFn: () => createBillingPortalSession,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
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

const fetchPrices = createRoute(routeDefinition.fetchPrices.validators, async ({}, _, res) => {
  stripeService.ensureStripeIsInitialized();

  const pricesByLookupKey = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS });

  sendJson(res, pricesByLookupKey);
});

const createCheckoutSessionHandler = createRoute(
  routeDefinition.createCheckoutSession.validators,
  async ({ user: sessionUser, body }, req, res) => {
    stripeService.ensureStripeIsInitialized();
    const { priceLookupKey, seats, teamName } = body;

    const priceId = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS }).then((prices) => prices[priceLookupKey]?.id);
    if (!priceId) {
      getLogger().error({ priceLookupKey }, 'Price lookup key not found');
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
      if (!seats) {
        throw new UserFacingError('Choose how many seats to purchase for your team', { code: 'SEATS_BELOW_MINIMUM', minimum: 1 });
      }
      // Self-serve checkout would charge the card while sync leaves the agreed cap untouched, so the
      // team would pay for seats it never receives
      if (team?.billingAccount?.manualBilling) {
        throw new UserFacingError('Seats for this team are set by your billing agreement. Contact support to change them.', {
          code: 'SEATS_MANUAL_BILLING',
        });
      }
      // An existing team's members and pending invitations already occupy seats, so the purchase must cover them
      if (team) {
        const usage = await subscriptionDbService.getTeamSeatUsage({ teamId: team.id });
        const minimumSeats = Math.max(1, usage.used + usage.reserved);
        if (seats < minimumSeats) {
          throw new UserFacingError(
            `Your team needs at least ${minimumSeats} seats: ${usage.used} in use and ${usage.reserved} reserved by pending invitations.`,
            { code: 'SEATS_BELOW_MINIMUM', minimum: minimumSeats, used: usage.used, reserved: usage.reserved },
          );
        }
      }
      session = await stripeService.createCheckoutSession({
        mode: 'subscription',
        priceId,
        // An existing team already bills against its own customer; using the buyer's personal customer
        // would put the subscription somewhere the team's seat sync never looks.
        // Customer will be created if it doesn't exist
        customerId: team?.billingAccount?.customerId ?? user.billingAccount?.customerId,
        user,
        type: 'TEAM',
        teamId: team?.id,
        quantity: seats,
        teamName,
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
    } else if (session.url) {
      // Legacy path - TODO: remove once everything is deployed
      redirect(res, session.url);
    } else {
      throw new Error('No URL found for checkout session');
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

const getSubscriptionsHandler = createRoute(routeDefinition.getSubscriptions.validators, async ({ user }, _, res) => {
  stripeService.ensureStripeIsInitialized();

  // /api/billing does not pass through validateTeamRoleMiddleware, so the caller's teamMembership
  // on the session may be stale — read the current role from the DB before any authz decision.
  // We only need role/teamId here; the downstream Stripe sync fetches its own data.
  const membership = await teamDbService.findActiveTeamMembershipByUserId({ userId: user.id });
  const teamId = membership?.teamId;
  const teamRole = membership?.role;

  // Prices are needed even without a customer: the checkout seat picker prices seats from Stripe's tiers
  const pricesByLookupKey = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS });

  if (teamId && teamRole !== 'ADMIN' && teamRole !== 'BILLING') {
    sendJson(res, { customer: null, pricesByLookupKey, hasManualBilling: false, didUpdate: false });
    return;
  }

  const {
    success,
    reason,
    didUpdate,
    stripeCustomer: internalCustomer,
  } = await stripeService.synchronizeStripeWithJetstreamIfRequiredForTeamOrUser({ userId: user.id, teamId });
  if (!success) {
    getLogger().error({ userId: user.id }, `Did not synchronize Stripe with Jetstream: ${reason}`);
    sendJson(res, { customer: null, pricesByLookupKey, hasManualBilling: false, didUpdate });
    return;
  }
  if (!internalCustomer) {
    sendJson(res, { customer: null, pricesByLookupKey, hasManualBilling: false, didUpdate });
    return;
  }
  const customer = stripeService.convertCustomerWithSubscriptionsToUserFacing(internalCustomer);
  // Stripe omits the tier table from the expanded subscription item, so a tiered Team plan renders
  // unknown pricing until the tables are filled in
  await stripeService.attachTiersToTieredItems(customer);
  const hasManualBilling = await userDbService.hasManualBilling({ userId: user.id });

  let userProfile: UserProfileUi | undefined;
  if (didUpdate) {
    userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id });
  }

  sendJson(res, { customer, pricesByLookupKey, hasManualBilling, didUpdate, userProfile });
});

const createBillingPortalSession = createRoute(
  routeDefinition.createBillingPortalSession.validators,
  async ({ user: sessionUser }, _, res) => {
    stripeService.ensureStripeIsInitialized();
    const billingAccount = await userDbService.getBillingAccount(sessionUser.id);
    let portalType: 'USER' | 'TEAM' | 'MANUAL' = 'USER';

    if (!billingAccount?.customerId) {
      throw new NotFoundError('Billing account not found');
    }

    if (
      billingAccount?.teamRole &&
      !([TeamMemberRoleSchema.enum.ADMIN, TeamMemberRoleSchema.enum.BILLING] as TeamMemberRole[]).includes(billingAccount.teamRole)
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

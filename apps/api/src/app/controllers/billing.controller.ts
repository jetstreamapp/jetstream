import { ENV, getLogger } from '@jetstream/api-config';
import { refreshSessionUser } from '@jetstream/auth/server';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import {
  CheckoutSessionRequestSchema,
  STRIPE_PRICE_KEYS,
  TEAM_MEMBER_STATUS_ACTIVE,
  TEAM_STATUS_ACTIVE,
  TeamMemberRole,
  TeamMemberRoleSchema,
  UserProfileUi,
} from '@jetstream/types';
import Stripe from 'stripe';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import * as teamDbService from '../db/team.db';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import * as teamSeatsService from '../services/team-seats.service';
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

/**
 * A team whose Stripe customer was deleted cannot open Checkout against it, and would otherwise be stuck
 * past due with no self-serve way back. Omitting the customer makes Checkout create a fresh one, which the
 * completed session then binds to the team. Any other Stripe failure is rethrown rather than treated as
 * "no customer", since that would quietly split a healthy team across two customers.
 */
async function resolveUsableTeamCustomer(customerId: string | undefined): Promise<Stripe.Customer | undefined> {
  if (!customerId) {
    return undefined;
  }
  const customer = await stripeService.fetchCustomerWithSubscriptionsById({ customerId });
  if (customer.deleted) {
    getLogger().warn({ customerId }, 'Team billing account points at a deleted Stripe customer; checkout will create a new one');
    return undefined;
  }
  return customer;
}

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
    // The pre-fill is only a convenience, so a failed lookup must never block checkout
    const productionOrgId = await salesforceOrgsDb.findProductionOrganizationId(sessionUser.id).catch((ex) => {
      getLogger().warn(
        { userId: sessionUser.id, ...getErrorMessageAndStackObj(ex) },
        'Unable to look up the production org id to pre-fill',
      );
      return null;
    });

    const type = priceLookupKey.startsWith('TEAM_') ? 'TEAM' : 'USER';
    let session: Stripe.Response<Stripe.Checkout.Session> | null = null;

    if (type === 'TEAM') {
      // Membership is returned regardless of status, so a deactivated admin would otherwise keep the
      // ability to open checkout against the team's Stripe customer
      const isActiveTeamMember = team?.status === TEAM_STATUS_ACTIVE && teamMember?.status === TEAM_MEMBER_STATUS_ACTIVE;
      const hasBillingRole = teamMember?.role === 'ADMIN' || teamMember?.role === 'BILLING';
      if (team && (!isActiveTeamMember || !hasBillingRole)) {
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
      const teamCustomer = team ? await resolveUsableTeamCustomer(team.billingAccount?.customerId) : undefined;
      // Read from Stripe rather than the database so a checkout that just completed counts before its
      // webhook lands. The billing page never offers checkout in this state, so this catches direct
      // calls and a stale second tab.
      if (teamCustomer && stripeService.hasCurrentTeamPlanSubscription(teamCustomer)) {
        throw new UserFacingError(
          'Your team already has a subscription. Change seats from the team dashboard, or manage your plan from the billing portal.',
          { code: 'SEATS_ALREADY_SUBSCRIBED' },
        );
      }
      if (team) {
        await teamSeatsService.assertCheckoutSeatsCoverUsage({ teamId: team.id, seats });
      }
      session = await stripeService.createCheckoutSession({
        mode: 'subscription',
        priceId,
        // An existing team always bills against its own customer, never the buyer's personal one, so a
        // team whose billing account is not set up yet gets a dedicated TEAM customer. A brand-new team
        // starts from the buyer's own customer when they have one.
        // Customer will be created if it doesn't exist
        customerId: team ? teamCustomer?.id : user.billingAccount?.customerId,
        user,
        type: 'TEAM',
        teamId: team?.id,
        productionOrgId,
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
        productionOrgId,
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

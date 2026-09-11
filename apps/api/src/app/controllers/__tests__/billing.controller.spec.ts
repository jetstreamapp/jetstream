/**
 * Covers the authorization and customer-selection branches of the checkout handler. Every existing team must
 * bill against its own Stripe customer (never the buyer's personal one), only active admins/billing members of
 * an active team may open checkout, and the seat guards (missing seats, manual billing, an existing TEAM
 * subscription, seats below usage) must reject before a Stripe session is created.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFacingError } from '../../utils/error-handler';
import { routeDefinition } from '../billing.controller';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  redirect: vi.fn(),
  ensureStripeIsInitialized: vi.fn(),
  fetchPrices: vi.fn(),
  fetchCustomerWithSubscriptionsById: vi.fn(),
  hasCurrentTeamPlanSubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
  synchronizeStripeWithJetstreamIfRequiredForTeamOrUser: vi.fn(),
  convertCustomerWithSubscriptionsToUserFacing: vi.fn(),
  attachTiersToTieredItems: vi.fn(),
  findByIdWithSubscriptions: vi.fn(),
  hasManualBilling: vi.fn(),
  findIdByUserIdUserFacing: vi.fn(),
  findByUserIdWithSubscriptions: vi.fn(),
  findActiveTeamMembershipByUserId: vi.fn(),
  assertCheckoutSeatsCoverUsage: vi.fn(),
  findProductionOrganizationId: vi.fn(),
  getBillingAccount: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', JETSTREAM_CLIENT_URL: 'https://client.test', ENVIRONMENT: 'test', CI: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));

vi.mock('@jetstream/auth/server', () => ({
  StepUpAuthRequiredError: class extends Error {},
  getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
  refreshSessionUser: vi.fn(),
}));

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: () => false,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  toTypedPrismaError: () => ({ code: undefined }),
}));

vi.mock('../../services/stripe.service', () => ({
  ensureStripeIsInitialized: mocks.ensureStripeIsInitialized,
  fetchPrices: mocks.fetchPrices,
  fetchCustomerWithSubscriptionsById: mocks.fetchCustomerWithSubscriptionsById,
  hasCurrentTeamPlanSubscription: mocks.hasCurrentTeamPlanSubscription,
  createCheckoutSession: mocks.createCheckoutSession,
  synchronizeStripeWithJetstreamIfRequiredForTeamOrUser: mocks.synchronizeStripeWithJetstreamIfRequiredForTeamOrUser,
  convertCustomerWithSubscriptionsToUserFacing: mocks.convertCustomerWithSubscriptionsToUserFacing,
  attachTiersToTieredItems: mocks.attachTiersToTieredItems,
  createBillingPortalSession: mocks.createBillingPortalSession,
  filterInactiveSubscriptions: (subscriptions: { status: string }[]) => subscriptions.filter(({ status }) => status === 'active'),
}));
vi.mock('../../services/team-seats.service', () => ({
  assertCheckoutSeatsCoverUsage: mocks.assertCheckoutSeatsCoverUsage,
}));
vi.mock('../../db/user.db', () => ({
  findByIdWithSubscriptions: mocks.findByIdWithSubscriptions,
  hasManualBilling: mocks.hasManualBilling,
  findIdByUserIdUserFacing: mocks.findIdByUserIdUserFacing,
  getBillingAccount: mocks.getBillingAccount,
}));
vi.mock('../../db/team.db', () => ({
  findByUserIdWithSubscriptions: mocks.findByUserIdWithSubscriptions,
  findActiveTeamMembershipByUserId: mocks.findActiveTeamMembershipByUserId,
}));
vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
  findProductionOrganizationId: mocks.findProductionOrganizationId,
}));
vi.mock('../../utils/response.handlers', () => ({
  sendJson: mocks.sendJson,
  redirect: mocks.redirect,
}));

const USER_ID = 'user-1';
const TEAM_ID = 'team-1';
const PERSONAL_CUSTOMER_ID = 'cus_personal';
const TEAM_CUSTOMER_ID = 'cus_team';
const PRODUCTION_ORG_ID = '00D000000000001';
const CHECKOUT_URL = 'https://checkout.stripe.test/session';

const PRICES = {
  TEAM_ANNUAL: { id: 'price_team_annual' },
  TEAM_MONTHLY: { id: 'price_team_monthly' },
  PRO_ANNUAL: { id: 'price_pro_annual' },
  PRO_MONTHLY: { id: 'price_pro_monthly' },
};

const buyer = {
  id: USER_ID,
  email: 'buyer@example.com',
  name: 'Buyer',
  billingAccount: { customerId: PERSONAL_CUSTOMER_ID, manualBilling: false },
  subscriptions: [],
};

type TeamOverrides = {
  status?: string;
  member?: { role: string; status: string } | null;
  billingAccount?: { customerId: string; manualBilling: boolean } | null;
};

function makeTeam({ status = 'ACTIVE', member = { role: 'ADMIN', status: 'ACTIVE' }, billingAccount }: TeamOverrides = {}) {
  return {
    id: TEAM_ID,
    status,
    name: 'Existing Team',
    billingStatus: 'ACTIVE',
    billingAccount: billingAccount === undefined ? { customerId: TEAM_CUSTOMER_ID, manualBilling: false } : billingAccount,
    subscriptions: [],
    members: member ? [{ userId: USER_ID, ...member }] : [],
  };
}

function makeReq(body: Record<string, unknown>) {
  return {
    method: 'POST',
    url: '/api/billing/checkout-session',
    headers: {},
    params: {},
    query: {},
    body,
    session: { id: 'session-id', user: { id: USER_ID, email: buyer.email } },
    accepts: vi.fn(() => 'json'),
    get: vi.fn(() => undefined),
    ip: '127.0.0.1',
  };
}

function makeRes() {
  return { locals: { cookies: {}, requestId: 'request-id', ipAddress: '127.0.0.1' } };
}

async function runCheckout(body: Record<string, unknown>) {
  const next = vi.fn();
  const handler = routeDefinition.createCheckoutSession.controllerFn();
  await handler(makeReq(body) as never, makeRes() as never, next);
  return { next };
}

function expectRejected(next: ReturnType<typeof vi.fn>, { message, code }: { message?: string | RegExp; code?: string }) {
  expect(next).toHaveBeenCalledTimes(1);
  const [error] = next.mock.calls[0];
  expect(error).toBeInstanceOf(UserFacingError);
  if (message) {
    expect(error.message).toMatch(message);
  }
  if (code) {
    expect(error.additionalData?.code).toBe(code);
  }
  expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  expect(mocks.sendJson).not.toHaveBeenCalled();
}

function getCheckoutSessionArgs() {
  expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
  return mocks.createCheckoutSession.mock.calls[0][0];
}

describe('billing.controller - createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPrices.mockResolvedValue(PRICES);
    mocks.findByIdWithSubscriptions.mockResolvedValue(buyer);
    mocks.findByUserIdWithSubscriptions.mockResolvedValue(null);
    mocks.findProductionOrganizationId.mockResolvedValue(PRODUCTION_ORG_ID);
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue({ id: TEAM_CUSTOMER_ID, subscriptions: { data: [] } });
    mocks.hasCurrentTeamPlanSubscription.mockReturnValue(false);
    mocks.assertCheckoutSeatsCoverUsage.mockResolvedValue(undefined);
    mocks.createCheckoutSession.mockResolvedValue({ url: CHECKOUT_URL });
  });

  describe('TEAM checkout for an existing team', () => {
    it('bills an active admin of an active team against the team customer and checks seats cover usage', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5, teamName: 'Ignored Name' });

      expect(next).not.toHaveBeenCalled();
      expect(mocks.fetchCustomerWithSubscriptionsById).toHaveBeenCalledWith({ customerId: TEAM_CUSTOMER_ID });
      expect(mocks.assertCheckoutSeatsCoverUsage).toHaveBeenCalledWith({ teamId: TEAM_ID, seats: 5 });
      const args = getCheckoutSessionArgs();
      expect(args).toMatchObject({
        mode: 'subscription',
        priceId: PRICES.TEAM_ANNUAL.id,
        customerId: TEAM_CUSTOMER_ID,
        type: 'TEAM',
        teamId: TEAM_ID,
        quantity: 5,
        productionOrgId: PRODUCTION_ORG_ID,
      });
      expect(args.customerId).not.toBe(PERSONAL_CUSTOMER_ID);
      expect(args.user).toBe(buyer);
      expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), { url: CHECKOUT_URL });
    });

    it('allows an active BILLING member to open checkout for the team', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ member: { role: 'BILLING', status: 'ACTIVE' } }));

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_MONTHLY', seats: 3 });

      expect(next).not.toHaveBeenCalled();
      expect(getCheckoutSessionArgs()).toMatchObject({ customerId: TEAM_CUSTOMER_ID, type: 'TEAM', teamId: TEAM_ID, quantity: 3 });
    });

    it('rejects an inactive admin without creating a session', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ member: { role: 'ADMIN', status: 'INACTIVE' } }));

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expectRejected(next, { message: /You do not have permission to create a billing session for this team/ });
      expect(mocks.assertCheckoutSeatsCoverUsage).not.toHaveBeenCalled();
    });

    it('rejects an active admin of an inactive team without creating a session', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ status: 'INACTIVE' }));

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expectRejected(next, { message: /You do not have permission to create a billing session for this team/ });
    });

    it('rejects an active member without a billing role', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ member: { role: 'MEMBER', status: 'ACTIVE' } }));

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expectRejected(next, { message: /You do not have permission to create a billing session for this team/ });
      expect(mocks.assertCheckoutSeatsCoverUsage).not.toHaveBeenCalled();
    });

    it('rejects a team checkout without seats', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL' });

      expectRejected(next, { code: 'SEATS_BELOW_MINIMUM' });
    });

    it('rejects a manual-billing team', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(
        makeTeam({ billingAccount: { customerId: TEAM_CUSTOMER_ID, manualBilling: true } }),
      );

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expectRejected(next, { code: 'SEATS_MANUAL_BILLING' });
      expect(mocks.fetchCustomerWithSubscriptionsById).not.toHaveBeenCalled();
    });

    it('rejects a team whose customer already has a current TEAM subscription', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());
      mocks.hasCurrentTeamPlanSubscription.mockReturnValue(true);

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expectRejected(next, { code: 'SEATS_ALREADY_SUBSCRIBED' });
      expect(mocks.hasCurrentTeamPlanSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: TEAM_CUSTOMER_ID }));
      expect(mocks.assertCheckoutSeatsCoverUsage).not.toHaveBeenCalled();
    });

    it('rejects when the requested seats do not cover current usage', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());
      mocks.assertCheckoutSeatsCoverUsage.mockRejectedValue(
        new UserFacingError('Your team needs at least 4 seats', { code: 'SEATS_BELOW_MINIMUM' }),
      );

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 2 });

      expectRejected(next, { code: 'SEATS_BELOW_MINIMUM' });
    });

    it('lets checkout create a fresh customer when the team customer was deleted', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());
      mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue({ id: TEAM_CUSTOMER_ID, deleted: true });

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expect(next).not.toHaveBeenCalled();
      expect(mocks.hasCurrentTeamPlanSubscription).not.toHaveBeenCalled();
      const args = getCheckoutSessionArgs();
      expect(args.customerId).toBeUndefined();
      expect(args).toMatchObject({ type: 'TEAM', teamId: TEAM_ID, quantity: 5 });
    });

    it('never falls back to the buyer personal customer when the team has no billing account yet', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ billingAccount: null }));

      const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

      expect(next).not.toHaveBeenCalled();
      expect(mocks.fetchCustomerWithSubscriptionsById).not.toHaveBeenCalled();
      const args = getCheckoutSessionArgs();
      expect(args.customerId).toBeUndefined();
      expect(args).toMatchObject({ type: 'TEAM', teamId: TEAM_ID, quantity: 5 });
    });
  });

  describe('TEAM checkout for a brand-new team', () => {
    it('uses the buyer personal customer and passes the seats and team name', async () => {
      const { next } = await runCheckout({ priceLookupKey: 'TEAM_MONTHLY', seats: 4, teamName: 'Acme Admins' });

      expect(next).not.toHaveBeenCalled();
      expect(mocks.fetchCustomerWithSubscriptionsById).not.toHaveBeenCalled();
      expect(mocks.assertCheckoutSeatsCoverUsage).not.toHaveBeenCalled();
      const args = getCheckoutSessionArgs();
      expect(args).toMatchObject({
        priceId: PRICES.TEAM_MONTHLY.id,
        customerId: PERSONAL_CUSTOMER_ID,
        type: 'TEAM',
        quantity: 4,
        teamName: 'Acme Admins',
        productionOrgId: PRODUCTION_ORG_ID,
      });
      expect(args.teamId).toBeUndefined();
    });

    it('rejects a new team checkout without seats', async () => {
      const { next } = await runCheckout({ priceLookupKey: 'TEAM_MONTHLY', teamName: 'Acme Admins' });

      expectRejected(next, { code: 'SEATS_BELOW_MINIMUM' });
    });
  });

  describe('USER checkout', () => {
    it('bills the buyer personal customer without team fields', async () => {
      const { next } = await runCheckout({ priceLookupKey: 'PRO_MONTHLY' });

      expect(next).not.toHaveBeenCalled();
      const args = getCheckoutSessionArgs();
      expect(args).toMatchObject({
        mode: 'subscription',
        priceId: PRICES.PRO_MONTHLY.id,
        customerId: PERSONAL_CUSTOMER_ID,
        type: 'USER',
        productionOrgId: PRODUCTION_ORG_ID,
      });
      expect(args).not.toHaveProperty('teamId');
      expect(args).not.toHaveProperty('quantity');
      expect(args).not.toHaveProperty('teamName');
      expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), { url: CHECKOUT_URL });
    });

    it('ignores seats and team name sent with an individual plan', async () => {
      mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam({ member: { role: 'MEMBER', status: 'ACTIVE' } }));

      const { next } = await runCheckout({ priceLookupKey: 'PRO_ANNUAL', seats: 3, teamName: 'Ignored' });

      expect(next).not.toHaveBeenCalled();
      const args = getCheckoutSessionArgs();
      expect(args).toMatchObject({ customerId: PERSONAL_CUSTOMER_ID, type: 'USER' });
      expect(args).not.toHaveProperty('quantity');
      expect(args).not.toHaveProperty('teamName');
      expect(mocks.assertCheckoutSeatsCoverUsage).not.toHaveBeenCalled();
    });
  });

  it('rejects a price lookup key that Stripe did not return', async () => {
    mocks.fetchPrices.mockResolvedValue({ PRO_MONTHLY: PRICES.PRO_MONTHLY });

    const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

    expectRejected(next, { message: /There was a problem initializing your billing session/ });
    expect(mocks.findByIdWithSubscriptions).not.toHaveBeenCalled();
  });

  it('does not block checkout when the production org lookup fails', async () => {
    mocks.findByUserIdWithSubscriptions.mockResolvedValue(makeTeam());
    mocks.findProductionOrganizationId.mockRejectedValue(new Error('database unavailable'));

    const { next } = await runCheckout({ priceLookupKey: 'TEAM_ANNUAL', seats: 5 });

    expect(next).not.toHaveBeenCalled();
    expect(getCheckoutSessionArgs()).toMatchObject({ customerId: TEAM_CUSTOMER_ID, teamId: TEAM_ID, productionOrgId: null });
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), { url: CHECKOUT_URL });
  });
});

describe('billing.controller - getSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPrices.mockResolvedValue(PRICES);
  });

  it('returns prices without customer data for a plain team member', async () => {
    mocks.findActiveTeamMembershipByUserId.mockResolvedValue({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' });
    const next = vi.fn();

    const handler = routeDefinition.getSubscriptions.controllerFn();
    await handler(makeReq({}) as never, makeRes() as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.findActiveTeamMembershipByUserId).toHaveBeenCalledWith({ userId: USER_ID });
    expect(mocks.synchronizeStripeWithJetstreamIfRequiredForTeamOrUser).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), {
      customer: null,
      pricesByLookupKey: PRICES,
      hasManualBilling: false,
      didUpdate: false,
    });
  });
});

describe('billing.controller - createBillingPortalSession', () => {
  function customerOnPrice(lookupKey: string) {
    return {
      id: TEAM_CUSTOMER_ID,
      subscriptions: { data: [{ status: 'active', items: { data: [{ id: 'si_1', price: { id: 'price_1', lookup_key: lookupKey } }] } }] },
    };
  }

  async function openPortal() {
    const next = vi.fn();
    const handler = routeDefinition.createBillingPortalSession.controllerFn();
    await handler(makeReq({}) as never, makeRes() as never, next);
    expect(next).not.toHaveBeenCalled();
    return mocks.createBillingPortalSession.mock.calls[0][0].portalType;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createBillingPortalSession.mockResolvedValue({ url: 'https://portal.stripe.test' });
    mocks.getBillingAccount.mockResolvedValue({ customerId: TEAM_CUSTOMER_ID, manualBilling: false, teamId: TEAM_ID, teamRole: 'ADMIN' });
  });

  it('lets a team on a current Team price switch between monthly and annual', async () => {
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(customerOnPrice('TEAM_MONTHLY'));

    await expect(openPortal()).resolves.toBe('TEAM');
  });

  it('keeps a team on a legacy price out of plan changes', async () => {
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(customerOnPrice('TEAM_ANNUAL_OLD4'));

    await expect(openPortal()).resolves.toBe('TEAM_LEGACY');
  });

  it('keeps a team without an active Team subscription out of plan changes', async () => {
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue({ id: TEAM_CUSTOMER_ID, deleted: true });

    await expect(openPortal()).resolves.toBe('TEAM_LEGACY');
  });

  it('routes manual billing and personal customers without reading Stripe', async () => {
    mocks.getBillingAccount.mockResolvedValueOnce({
      customerId: TEAM_CUSTOMER_ID,
      manualBilling: true,
      teamId: TEAM_ID,
      teamRole: 'ADMIN',
    });
    await expect(openPortal()).resolves.toBe('MANUAL');

    mocks.createBillingPortalSession.mockClear();
    mocks.getBillingAccount.mockResolvedValueOnce({ customerId: PERSONAL_CUSTOMER_ID, manualBilling: false });
    await expect(openPortal()).resolves.toBe('USER');

    expect(mocks.fetchCustomerWithSubscriptionsById).not.toHaveBeenCalled();
  });
});

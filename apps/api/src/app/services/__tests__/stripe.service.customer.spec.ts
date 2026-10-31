import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

const mocks = vi.hoisted(() => ({
  customersSearch: vi.fn(),
  customersCreate: vi.fn(),
  customersUpdate: vi.fn(),
  customersRetrieve: vi.fn(),
  createFundingInstructions: vi.fn(async () => ({})),
  sessionsCreate: vi.fn(async () => ({ id: 'cs_new', url: 'https://checkout.stripe.test/cs_new' })),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class {
    customers = {
      search: mocks.customersSearch,
      create: mocks.customersCreate,
      createFundingInstructions: mocks.createFundingInstructions,
      retrieve: mocks.customersRetrieve,
      update: mocks.customersUpdate,
    };
    checkout = { sessions: { create: mocks.sessionsCreate } };
    entitlements = { activeEntitlements: { list: vi.fn(async () => ({ data: [] })) } };
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { STRIPE_API_KEY: 'sk_test_x', JETSTREAM_SERVER_URL: 'https://jetstream.test' },
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn, info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/email', () => ({ sendWelcomeToProEmail: vi.fn() }));
vi.mock('../../db/subscription.db', () => ({}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../db/user.db', () => ({}));

const user = { id: 'user-1', name: 'Test User', email: 'user@example.com' };

const customer = ({
  id,
  created,
  email = user.email,
  subscriptions = [],
  metadata = {},
}: {
  id: string;
  created: number;
  email?: string;
  subscriptions?: { id: string; status: string }[];
  metadata?: Record<string, string>;
}) => ({
  id,
  created,
  email,
  metadata: { userId: user.id, type: 'USER', ...metadata },
  subscriptions: { object: 'list', data: subscriptions },
});

const subscriptionWithStatus = (status: string) => ({ id: `sub_${status}`, status });

const searchReturns = (...customers: ReturnType<typeof customer>[]) =>
  mocks.customersSearch.mockResolvedValue({ data: customers, has_more: false });

let stripeService: typeof StripeService;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.customersCreate.mockResolvedValue({ id: 'cus_created' });
  mocks.customersUpdate.mockImplementation(async (customerId: string, params: Record<string, unknown>) => ({
    id: customerId,
    metadata: {},
    ...params,
  }));
  stripeService = await import('../stripe.service');
});

describe('findReusableCustomerForUser', () => {
  it('reuses the customer stamped with the user id', async () => {
    searchReturns(customer({ id: 'cus_existing', created: 100 }));

    const result = await stripeService.findReusableCustomerForUser({ user });

    expect(result?.id).toBe('cus_existing');
    expect(mocks.customersSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: `metadata["userId"]:"user-1"`, expand: ['data.subscriptions'] }),
    );
  });

  it('returns null when the user has no customer', async () => {
    searchReturns();

    await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toBeNull();
  });

  // Checkout sets the name to the legal business name it collects, so writing the profile name here would
  // replace it whenever the user came back and abandoned checkout
  it('refreshes only the email on the reused customer', async () => {
    searchReturns(customer({ id: 'cus_existing', created: 100, email: 'old@example.com' }));

    const result = await stripeService.findReusableCustomerForUser({ user });

    expect(mocks.customersUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_existing', { email: user.email });
    expect(result?.email).toBe(user.email);
  });

  it('does not write to the customer when its email is already current', async () => {
    searchReturns(customer({ id: 'cus_existing', created: 100 }));

    await stripeService.findReusableCustomerForUser({ user });

    expect(mocks.customersUpdate).not.toHaveBeenCalled();
  });

  // A team's customer carries its purchaser's user id too, and must never become anyone's personal customer
  it('never reuses, or writes to, a customer a team is attached to', async () => {
    const teamCustomer = customer({
      id: 'cus_team',
      created: 50,
      email: 'billing@acme.test',
      subscriptions: [subscriptionWithStatus('active')],
      metadata: { teamId: 'team-1', type: 'TEAM' },
    });
    searchReturns(teamCustomer);

    await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toBeNull();
    expect(mocks.customersUpdate).not.toHaveBeenCalled();

    searchReturns(teamCustomer, customer({ id: 'cus_personal', created: 200 }));

    await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toEqual(expect.objectContaining({ id: 'cus_personal' }));
  });

  it('returns null rather than blocking checkout when the search fails', async () => {
    mocks.customersSearch.mockRejectedValue(new Error('search unavailable'));

    await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  it('flags a user whose customers do not fit one search page', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [customer({ id: 'cus_1', created: 100 })], has_more: true });

    await stripeService.findReusableCustomerForUser({ user });

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id }), expect.any(String));
  });

  describe('when a user already has duplicate customers', () => {
    it('prefers the customer being paid for over an older one waiting on payment', async () => {
      searchReturns(
        customer({ id: 'cus_incomplete', created: 100, subscriptions: [subscriptionWithStatus('incomplete')] }),
        customer({ id: 'cus_paid', created: 300, subscriptions: [subscriptionWithStatus('trialing')] }),
      );

      await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toEqual(expect.objectContaining({ id: 'cus_paid' }));
    });

    it('prefers a customer with a current subscription over an older one whose subscription ended', async () => {
      searchReturns(
        customer({ id: 'cus_ended', created: 100, subscriptions: [subscriptionWithStatus('incomplete_expired')] }),
        customer({ id: 'cus_past_due', created: 200, subscriptions: [subscriptionWithStatus('past_due')] }),
      );

      await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toEqual(expect.objectContaining({ id: 'cus_past_due' }));
    });

    it('resolves to the oldest customer when none has a subscription', async () => {
      searchReturns(customer({ id: 'cus_second', created: 200 }), customer({ id: 'cus_first', created: 100 }));

      await expect(stripeService.findReusableCustomerForUser({ user })).resolves.toEqual(expect.objectContaining({ id: 'cus_first' }));
    });

    // Stripe search does not guarantee an order, so an unstable tie-break could alternate between customers
    it('resolves to the same customer regardless of search order when created timestamps tie', async () => {
      const first = customer({ id: 'cus_aaa', created: 100 });
      const second = customer({ id: 'cus_bbb', created: 100 });

      searchReturns(first, second);
      const forwards = await stripeService.findReusableCustomerForUser({ user });
      searchReturns(second, first);
      const backwards = await stripeService.findReusableCustomerForUser({ user });

      expect(forwards?.id).toBe('cus_aaa');
      expect(backwards?.id).toBe('cus_aaa');
    });
  });
});

describe('createCheckoutSession without a customer', () => {
  const createSession = (overrides: { type?: 'USER' | 'TEAM'; teamId?: string; user?: typeof user } = {}) =>
    stripeService.createCheckoutSession({
      mode: 'subscription',
      priceId: 'price_1',
      user: overrides.user ?? user,
      type: overrides.type ?? 'USER',
      teamId: overrides.teamId,
    });

  // The seconds-apart double submission happens inside the search index's lag window, so the key rather than the
  // search is what stops it from minting a second customer
  it('creates the customer from the user id alone under a per-user idempotency key', async () => {
    await createSession();
    await createSession({ user: { ...user, name: 'Renamed User', email: 'renamed@example.com' }, type: 'TEAM' });

    expect(mocks.customersCreate).toHaveBeenCalledTimes(2);
    for (const [params, options] of mocks.customersCreate.mock.calls) {
      expect(params).toEqual({ metadata: { userId: user.id } });
      expect(options).toEqual({ idempotencyKey: 'customer-create:user-1' });
    }
  });

  it('applies the email, name and plan type in a follow-up update without clearing a team id', async () => {
    await createSession();

    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_created', {
      email: user.email,
      name: user.name,
      metadata: { userId: user.id, type: 'USER' },
    });
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_created' }));
    expect(mocks.createFundingInstructions).not.toHaveBeenCalled();
  });

  it('sets up bank transfer funding for a new team customer', async () => {
    await createSession({ type: 'TEAM' });

    expect(mocks.createFundingInstructions).toHaveBeenCalledWith('cus_created', expect.objectContaining({ currency: 'usd' }));
  });

  // The per-user key could replay the buyer's personal customer, and an existing team must bill on its own
  it("creates an existing team's replacement customer without the per-user idempotency key", async () => {
    mocks.customersCreate.mockResolvedValue({ id: 'cus_team_new', metadata: {} });

    await createSession({ type: 'TEAM', teamId: 'team-1' });

    expect(mocks.customersCreate).toHaveBeenCalledTimes(1);
    expect(mocks.customersCreate.mock.calls[0]).toHaveLength(1);
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_team_new' }));
  });

  it('never searches for a customer itself', async () => {
    await createSession();

    expect(mocks.customersSearch).not.toHaveBeenCalled();
  });
});

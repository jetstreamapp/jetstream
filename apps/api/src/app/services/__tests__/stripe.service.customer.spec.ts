import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

const mocks = vi.hoisted(() => ({
  customersSearch: vi.fn(),
  customersCreate: vi.fn(),
  customersUpdate: vi.fn(),
  createFundingInstructions: vi.fn(async () => ({})),
}));

vi.mock('stripe', () => ({
  default: class {
    customers = {
      search: mocks.customersSearch,
      create: mocks.customersCreate,
      createFundingInstructions: mocks.createFundingInstructions,
      retrieve: vi.fn(),
      update: mocks.customersUpdate,
    };
    entitlements = { activeEntitlements: { list: vi.fn(async () => ({ data: [] })) } };
    webhooks = { constructEvent: vi.fn() };
    prices = { list: vi.fn() };
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { STRIPE_API_KEY: 'sk_test_x' },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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
  subscriptions = [],
  metadata = {},
}: {
  id: string;
  created: number;
  subscriptions?: unknown[];
  metadata?: Record<string, string>;
}) => ({
  id,
  created,
  deleted: undefined,
  metadata: { userId: user.id, type: 'USER', ...metadata },
  subscriptions: { object: 'list', data: subscriptions },
});

const subscriptionWithStatus = (status: string) => ({ id: `sub_${status}`, status });

describe('findOrCreateCustomer', () => {
  let stripeService: typeof StripeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    stripeService = await import('../stripe.service');
    mocks.customersCreate.mockResolvedValue({ id: 'cus_created' });
    mocks.customersUpdate.mockImplementation(async (customerId: string, params: Record<string, unknown>) => ({
      id: customerId,
      ...params,
    }));
  });

  it('reuses the existing customer rather than creating another one', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [customer({ id: 'cus_existing', created: 100 })] });

    const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

    expect(result.id).toBe('cus_existing');
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.customersSearch).toHaveBeenCalledWith(expect.objectContaining({ query: `metadata["userId"]:"user-1"` }));
  });

  it('creates a customer when the user has none', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [] });

    const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

    expect(result.id).toBe('cus_created');
    expect(mocks.customersCreate).toHaveBeenCalledTimes(1);
  });

  // The seconds-apart double submission that produced the original duplicate pair happens inside the
  // search index's lag window, so the key rather than the search is what prevents it.
  it('passes a stable idempotency key so a repeated submission cannot mint a second customer', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [] });

    await stripeService.findOrCreateCustomer({ user, type: 'USER' });
    await stripeService.findOrCreateCustomer({ user, type: 'USER' });

    const [firstKey, secondKey] = mocks.customersCreate.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(firstKey).toMatch(/^customer-create:USER:user-1:[0-9a-f]{16}$/);
    expect(secondKey).toBe(firstKey);
  });

  it('uses a different idempotency key when the profile changed, since Stripe rejects a reused key with new parameters', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [] });

    await stripeService.findOrCreateCustomer({ user, type: 'USER' });
    await stripeService.findOrCreateCustomer({ user: { ...user, name: 'Renamed User' }, type: 'USER' });

    const [firstKey, secondKey] = mocks.customersCreate.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(secondKey).not.toBe(firstKey);
  });

  it('falls back to creating a customer when the search fails, so an outage cannot block checkout', async () => {
    mocks.customersSearch.mockRejectedValue(new Error('search unavailable'));

    const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

    expect(result.id).toBe('cus_created');
  });

  it('ensures bank transfer funding instructions when a reused customer is upgrading to a team', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [customer({ id: 'cus_existing', created: 100 })] });

    await stripeService.findOrCreateCustomer({ user, type: 'TEAM' });

    expect(mocks.createFundingInstructions).toHaveBeenCalledWith('cus_existing', expect.objectContaining({ currency: 'usd' }));
  });

  // A team's customer carries its purchaser's `userId` and ranks first once paid for, so without the scope a
  // former team member's personal plan would be reconciled into the team.
  it('does not reuse a customer a team is attached to for a personal plan', async () => {
    const teamCustomer = customer({
      id: 'cus_team',
      created: 100,
      subscriptions: [subscriptionWithStatus('active')],
      metadata: { teamId: 'team-1', type: 'TEAM' },
    });
    mocks.customersSearch.mockResolvedValue({ data: [teamCustomer, customer({ id: 'cus_personal', created: 200 })] });

    const personal = await stripeService.findOrCreateCustomer({ user, type: 'USER' });
    const team = await stripeService.findOrCreateCustomer({ user, type: 'TEAM' });

    expect(personal.id).toBe('cus_personal');
    expect(team.id).toBe('cus_team');
  });

  describe('when a user already has duplicate customers', () => {
    it('prefers the one carrying subscriptions, since that is where money has moved', async () => {
      mocks.customersSearch.mockResolvedValue({
        data: [customer({ id: 'cus_empty', created: 100 }), customer({ id: 'cus_paid', created: 200, subscriptions: [{ id: 'sub_1' }] })],
      });

      const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

      expect(result.id).toBe('cus_paid');
    });

    it('resolves to the earliest created customer when neither has subscriptions', async () => {
      mocks.customersSearch.mockResolvedValue({
        data: [customer({ id: 'cus_second', created: 200 }), customer({ id: 'cus_first', created: 100 })],
      });

      const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

      expect(result.id).toBe('cus_first');
      expect(mocks.customersCreate).not.toHaveBeenCalled();
    });

    // Earliest-created alone would hand the next checkout to the abandoned customer whenever the one that
    // is actually paying was created later, which is the normal shape of the duplicate bug.
    it('prefers an active subscription over an older customer whose subscription has ended', async () => {
      mocks.customersSearch.mockResolvedValue({
        data: [
          customer({ id: 'cus_canceled', created: 100, subscriptions: [subscriptionWithStatus('canceled')] }),
          customer({ id: 'cus_active', created: 200, subscriptions: [subscriptionWithStatus('active')] }),
        ],
      });

      const result = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

      expect(result.id).toBe('cus_active');
    });

    // Stripe search does not guarantee an order, so an unstable tie-break could alternate between customers
    // on repeated calls and attach checkouts to different ones.
    it('resolves to the same customer regardless of search order when created timestamps tie', async () => {
      const first = customer({ id: 'cus_aaa', created: 100 });
      const second = customer({ id: 'cus_bbb', created: 100 });

      mocks.customersSearch.mockResolvedValueOnce({ data: [first, second] });
      const forwards = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

      mocks.customersSearch.mockResolvedValueOnce({ data: [second, first] });
      const backwards = await stripeService.findOrCreateCustomer({ user, type: 'USER' });

      expect(forwards.id).toBe('cus_aaa');
      expect(backwards.id).toBe('cus_aaa');
    });
  });
});

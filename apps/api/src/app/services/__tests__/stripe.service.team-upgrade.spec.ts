import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

// `stripe` v22 ships its types inline per module format, so `import type Stripe from 'stripe'` here
// resolves to the ESM declarations while the service resolves to the CJS ones - structurally identical
// but nominally distinct. Derive the fixture type from the service itself to stay on one identity.
type StripeCustomer = Parameters<typeof StripeService.saveOrUpdateSubscription>[0]['customer'];

const mocks = vi.hoisted(() => ({
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(async () => ({ id: 'cus_1' })),
  upsertTeamWithBillingAccount: vi.fn(async () => ({ id: 'team_new' })),
  updateSubscriptionStateForCustomer: vi.fn(async () => ({})),
  updateTeamSubscriptionStateForCustomer: vi.fn(async () => ({})),
  findUserById: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class {
    customers = {
      retrieve: mocks.customersRetrieve,
      update: mocks.customersUpdate,
      createFundingInstructions: vi.fn(async () => ({})),
      search: vi.fn(),
      create: vi.fn(),
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

vi.mock('../../db/subscription.db', () => ({
  updateSubscriptionStateForCustomer: mocks.updateSubscriptionStateForCustomer,
  updateTeamSubscriptionStateForCustomer: mocks.updateTeamSubscriptionStateForCustomer,
  updateUserEntitlements: vi.fn(async () => ({})),
  updateTeamEntitlements: vi.fn(async () => ({})),
}));
vi.mock('../../db/team.db', () => ({
  upsertTeamWithBillingAccount: mocks.upsertTeamWithBillingAccount,
  createBillingAccountIfNotExists: vi.fn(async () => ({})),
  findById: vi.fn(async () => ({ id: 'team_new' })),
  findEntitlements: vi.fn(async () => ({})),
  findSubscriptions: vi.fn(async () => []),
}));
vi.mock('../../db/user.db', () => ({
  findById: mocks.findUserById,
  upsertBillingAccount: vi.fn(async () => ({})),
  findBillingAccountByCustomerId: vi.fn(),
}));

const subscriptionWithPrice = (lookupKey: string) => ({
  id: 'sub_1',
  status: 'active',
  items: { object: 'list', data: [{ id: 'si_1', price: { id: `price_${lookupKey}`, lookup_key: lookupKey } }] },
});

const customerWithPlan = (lookupKey: string) =>
  ({
    id: 'cus_1',
    deleted: undefined,
    metadata: { userId: 'user_1', type: 'USER' },
    subscriptions: { object: 'list', data: [subscriptionWithPrice(lookupKey)] },
  }) as unknown as StripeCustomer;

describe('personal -> team plan upgrade', () => {
  let stripeService: typeof StripeService;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.customersRetrieve.mockResolvedValue(customerWithPlan('TEAM_MONTHLY'));
    // Jetstream still records the user as a personal subscriber whose entitlements already look
    // correct - the state that made the sync path report "nothing to do" and never create a team.
    mocks.findUserById.mockResolvedValue({
      id: 'user_1',
      billingAccount: { customerId: 'cus_1' },
      subscriptions: [{ id: 'sub_row_1' }],
      entitlements: { chromeExtension: true, googleDrive: true, desktop: true, recordSync: true },
    });
    stripeService = await import('../stripe.service');
  });

  it('creates the team from the subscription webhook', async () => {
    await stripeService.saveOrUpdateSubscription({ customer: customerWithPlan('TEAM_MONTHLY'), sendWelcomeEmail: false });

    expect(mocks.upsertTeamWithBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', billingAccountCustomerId: 'cus_1' }),
    );
    expect(mocks.updateTeamSubscriptionStateForCustomer).toHaveBeenCalled();
  });

  it('creates the team from the billing page sync when the webhook was missed', async () => {
    const result = await stripeService.synchronizeStripeWithJetstreamUserIfRequired({ userId: 'user_1' });

    expect(mocks.upsertTeamWithBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', billingAccountCustomerId: 'cus_1' }),
    );
    expect(result.success).toBe(true);
    // The team subscription must not be recorded against the personal account
    expect(mocks.updateSubscriptionStateForCustomer).not.toHaveBeenCalled();
  });

  it('leaves a personal plan on the personal account', async () => {
    mocks.customersRetrieve.mockResolvedValue(customerWithPlan('PRO_MONTHLY'));
    // Disagreeing subscription counts force the sync to actually run
    mocks.findUserById.mockResolvedValue({
      id: 'user_1',
      billingAccount: { customerId: 'cus_1' },
      subscriptions: [],
      entitlements: { chromeExtension: true, googleDrive: true, desktop: true, recordSync: true },
    });

    await stripeService.synchronizeStripeWithJetstreamUserIfRequired({ userId: 'user_1' });

    expect(mocks.upsertTeamWithBillingAccount).not.toHaveBeenCalled();
    expect(mocks.updateSubscriptionStateForCustomer).toHaveBeenCalled();
  });
});

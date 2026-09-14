import { logger } from '@jetstream/api-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

type BillingAccountHolder = { customerId: string; subscriptions: { status: string }[] };

const mocks = vi.hoisted(() => ({
  customersSearch: vi.fn(),
  customersCreate: vi.fn(),
  customersUpdate: vi.fn(),
  createFundingInstructions: vi.fn(async () => ({})),
  checkoutSessionsCreate: vi.fn(async () => ({ id: 'cs_1', url: 'https://checkout.example/cs_1' })),
  claimBillingAccountForCustomer: vi.fn(async () => true),
  findBillingAccountWithSubscriptionsByUserId: vi.fn(async (): Promise<BillingAccountHolder | null> => null),
  updateSubscriptionStateForCustomer: vi.fn(async () => ({})),
  claimTeamBillingAccountForCustomer: vi.fn(async () => true),
  findTeamBillingAccountWithSubscriptionsByTeamId: vi.fn(async (): Promise<BillingAccountHolder | null> => null),
  updateTeamSubscriptionStateForCustomer: vi.fn(async () => ({})),
  checkoutSessionsRetrieve: vi.fn(),
  customersRetrieve: vi.fn(),
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
    checkout = { sessions: { create: mocks.checkoutSessionsCreate, retrieve: mocks.checkoutSessionsRetrieve } };
    entitlements = { activeEntitlements: { list: vi.fn(async () => ({ data: [] })) } };
    webhooks = { constructEvent: vi.fn() };
    prices = { list: vi.fn() };
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { STRIPE_API_KEY: 'sk_test_x', JETSTREAM_SERVER_URL: 'https://api.example' },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/email', () => ({ sendWelcomeToProEmail: vi.fn() }));
vi.mock('../../db/subscription.db', () => ({
  updateSubscriptionStateForCustomer: mocks.updateSubscriptionStateForCustomer,
  updateTeamSubscriptionStateForCustomer: mocks.updateTeamSubscriptionStateForCustomer,
  cancelAllSubscriptionsForUser: vi.fn(async () => ({})),
  updateUserEntitlements: vi.fn(async () => ({})),
  updateTeamEntitlements: vi.fn(async () => ({})),
}));
vi.mock('../../db/team.db', () => ({
  claimTeamBillingAccountForCustomer: mocks.claimTeamBillingAccountForCustomer,
  findTeamBillingAccountWithSubscriptionsByTeamId: mocks.findTeamBillingAccountWithSubscriptionsByTeamId,
  upsertTeamWithBillingAccount: vi.fn(async () => ({ id: 'team_1' })),
}));
vi.mock('../../db/user.db', () => ({
  findById: vi.fn(async () => ({ email: user.email })),
  findBillingAccountByCustomerId: vi.fn(),
  claimBillingAccountForCustomer: mocks.claimBillingAccountForCustomer,
  findBillingAccountWithSubscriptionsByUserId: mocks.findBillingAccountWithSubscriptionsByUserId,
}));

const user = { id: 'user-1', name: 'Test User', email: 'user@example.com' };

const customer = ({ id, created, subscriptions = [] }: { id: string; created: number; subscriptions?: unknown[] }) => ({
  id,
  created,
  deleted: undefined,
  metadata: { userId: user.id, type: 'USER' },
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
    expect(firstKey).toBe('customer-create:user-1');
    expect(secondKey).toBe(firstKey);
  });

  // Stripe rejects a reused idempotency key whose request parameters changed, so anything mutable has to
  // stay out of the create call or a second attempt fails checkout instead of deduplicating.
  it('keeps the key and the create parameters invariant when the profile or the plan type differ', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [] });

    await stripeService.findOrCreateCustomer({ user, type: 'USER' });
    await stripeService.findOrCreateCustomer({ user: { ...user, name: 'Renamed User' }, type: 'TEAM' });

    const createCalls = mocks.customersCreate.mock.calls;
    expect(createCalls.map(([, options]) => options.idempotencyKey)).toEqual(['customer-create:user-1', 'customer-create:user-1']);
    expect(createCalls.map(([params]) => params)).toEqual([{ metadata: { userId: 'user-1' } }, { metadata: { userId: 'user-1' } }]);
  });

  // `teamId` stays out of the update: the idempotency key can return a customer from an earlier attempt that
  // already carries a real one, and Stripe deletes a metadata key written as `null`.
  it('applies the mutable profile and plan type in the follow-up update without clearing the team', async () => {
    mocks.customersSearch.mockResolvedValue({ data: [] });

    await stripeService.findOrCreateCustomer({ user, type: 'USER' });

    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_created', {
      email: user.email,
      name: user.name,
      metadata: { userId: 'user-1', type: 'USER' },
    });
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

    // `incomplete` means Stripe is still waiting on the initial invoice, so it must not rank alongside a
    // subscription that has been paid for - the earliest-created tie-break would otherwise hand the next
    // checkout to the unpaid duplicate, which is the older of the two in the usual shape of this bug.
    it('prefers a paid subscription over an older customer whose initial invoice is unpaid', async () => {
      mocks.customersSearch.mockResolvedValue({
        data: [
          customer({ id: 'cus_incomplete', created: 100, subscriptions: [subscriptionWithStatus('incomplete')] }),
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

describe('saveOrUpdateSubscription when a user has duplicate customers', () => {
  let stripeService: typeof StripeService;

  const customerWithSubscriptions = (id: string, subscriptions: unknown[]) =>
    ({
      id,
      deleted: undefined,
      metadata: { userId: user.id, type: 'USER' },
      subscriptions: { object: 'list', data: subscriptions },
    }) as unknown as Parameters<typeof StripeService.saveOrUpdateSubscription>[0]['customer'];

  const activeSubscription = {
    id: 'sub_1',
    status: 'active',
    items: { object: 'list', data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    stripeService = await import('../stripe.service');
    // The claim is what decides whether a customer may take the account over; the default is a user whose
    // account this customer already holds or who has none yet.
    mocks.claimBillingAccountForCustomer.mockResolvedValue(true);
    mocks.findBillingAccountWithSubscriptionsByUserId.mockResolvedValue(null);
  });

  // The abandoned customer emits events too, and letting one through would repoint the billing account away
  // from the customer that is paying and then delete its subscription rows.
  it('does not let a customer carrying no subscriptions take the account from another one', async () => {
    await stripeService.saveOrUpdateSubscription({ customer: customerWithSubscriptions('cus_orphan', []), sendWelcomeEmail: false });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith({
      userId: user.id,
      customerId: 'cus_orphan',
      allowRepoint: false,
    });
  });

  it('still repoints the account when the other customer is the one carrying the subscription', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_new_payment', [activeSubscription]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith({
      userId: user.id,
      customerId: 'cus_new_payment',
      allowRepoint: true,
    });
    expect(mocks.updateSubscriptionStateForCustomer).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cus_new_payment' }));
  });

  // A cancellation on the current customer legitimately arrives with no subscriptions and must be recorded.
  it('records an empty subscription list for the customer the account already points at', async () => {
    await stripeService.saveOrUpdateSubscription({ customer: customerWithSubscriptions('cus_paying', []), sendWelcomeEmail: false });

    expect(mocks.updateSubscriptionStateForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_paying', subscriptions: [] }),
    );
  });

  // A customer abandoned after a cancellation still carries the canceled subscription, so counting every
  // subscription would let it take the account over and then delete the paying customer's cascaded rows.
  it('treats a customer whose only subscription has ended as having none', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_orphan', [{ ...activeSubscription, status: 'canceled' }]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith({
      userId: user.id,
      customerId: 'cus_orphan',
      allowRepoint: false,
    });
  });

  // `incomplete` means Stripe is still holding the initial invoice unpaid, so such a customer has not paid
  // for anything yet and must not be able to take the account from the customer that has.
  it('does not let a customer whose initial invoice is unpaid take the account over', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_unpaid', [{ ...activeSubscription, status: 'incomplete' }]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith({
      userId: user.id,
      customerId: 'cus_unpaid',
      allowRepoint: false,
    });
  });

  it('lets a trialing customer take the account over', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_trial', [{ ...activeSubscription, status: 'trialing' }]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith(expect.objectContaining({ allowRepoint: true }));
  });

  // Two customers that are both being paid for is a double charge, which needs a human to refund one of them.
  it('logs an error when the repoint displaces a customer that is also being paid for', async () => {
    mocks.findBillingAccountWithSubscriptionsByUserId.mockResolvedValue({
      customerId: 'cus_already_paying',
      subscriptions: [{ status: 'ACTIVE' }],
    });

    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_new_payment', [activeSubscription]),
      sendWelcomeEmail: false,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ claimingCustomerId: 'cus_new_payment', displacedCustomerId: 'cus_already_paying' }),
      expect.stringContaining('repointed away from a customer that is also being paid for'),
    );
  });

  it('stays quiet when the customer it displaces has nothing being paid for', async () => {
    mocks.findBillingAccountWithSubscriptionsByUserId.mockResolvedValue({
      customerId: 'cus_orphan',
      subscriptions: [{ status: 'CANCELED' }],
    });

    await stripeService.saveOrUpdateSubscription({
      customer: customerWithSubscriptions('cus_new_payment', [activeSubscription]),
      sendWelcomeEmail: false,
    });

    expect(logger.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('repointed away from a customer that is also being paid for'),
    );
  });

  // The claim losing means a concurrent event moved the account to the customer that is paying, so this
  // event must not go on to reconcile subscriptions against a customer it no longer owns.
  it('stops without touching subscriptions when another customer holds the account', async () => {
    mocks.claimBillingAccountForCustomer.mockResolvedValue(false);

    await stripeService.saveOrUpdateSubscription({ customer: customerWithSubscriptions('cus_orphan', []), sendWelcomeEmail: false });

    expect(mocks.updateSubscriptionStateForCustomer).not.toHaveBeenCalled();
  });
});

describe('saveOrUpdateSubscription when a team has duplicate customers', () => {
  let stripeService: typeof StripeService;

  const teamCustomer = (id: string, subscriptions: unknown[]) =>
    ({
      id,
      deleted: undefined,
      metadata: { userId: user.id, teamId: 'team_1', type: 'TEAM' },
      subscriptions: { object: 'list', data: subscriptions },
    }) as unknown as Parameters<typeof StripeService.saveOrUpdateSubscription>[0]['customer'];

  const teamSubscription = (status: string) => ({
    id: `sub_${status}`,
    status,
    items: { object: 'list', data: [{ id: 'si_1', price: { id: 'price_team', lookup_key: 'TEAM_MONTHLY' } }] },
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    stripeService = await import('../stripe.service');
    mocks.claimTeamBillingAccountForCustomer.mockResolvedValue(true);
    mocks.findTeamBillingAccountWithSubscriptionsByTeamId.mockResolvedValue(null);
  });

  // The team billing account used to be repointed at whichever customer emitted the event. Because
  // `team_subscription.customerId` cascades on that update, an abandoned duplicate could drag the paying
  // customer's rows across and have them deleted by the reconciliation that follows.
  it('does not let a customer whose team subscription has ended take the account from another one', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: teamCustomer('cus_stale', [teamSubscription('canceled')]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimTeamBillingAccountForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team_1', customerId: 'cus_stale', allowRepoint: false }),
    );
  });

  it('still repoints the team account when the customer is the one being paid for', async () => {
    await stripeService.saveOrUpdateSubscription({
      customer: teamCustomer('cus_paying', [teamSubscription('active')]),
      sendWelcomeEmail: false,
    });

    expect(mocks.claimTeamBillingAccountForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team_1', customerId: 'cus_paying', allowRepoint: true }),
    );
  });

  it('stops without touching team subscriptions when another customer holds the account', async () => {
    mocks.claimTeamBillingAccountForCustomer.mockResolvedValue(false);

    await stripeService.saveOrUpdateSubscription({ customer: teamCustomer('cus_stale', []), sendWelcomeEmail: false });

    expect(mocks.updateTeamSubscriptionStateForCustomer).not.toHaveBeenCalled();
  });

  it('logs an error when the team repoint displaces a customer that is also being paid for', async () => {
    mocks.findTeamBillingAccountWithSubscriptionsByTeamId.mockResolvedValue({
      customerId: 'cus_other',
      subscriptions: [{ status: 'ACTIVE' }],
    });

    await stripeService.saveOrUpdateSubscription({
      customer: teamCustomer('cus_paying', [teamSubscription('active')]),
      sendWelcomeEmail: false,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team_1', claimingCustomerId: 'cus_paying', displacedCustomerId: 'cus_other' }),
      expect.stringContaining('repointed away from a customer that is also being paid for'),
    );
  });
});

describe('saveSubscriptionFromCompletedSession', () => {
  let stripeService: typeof StripeService;

  const session = (subscriptionStatus: string) => ({
    id: 'cs_1',
    customer: 'cus_completed',
    client_reference_id: user.id,
    metadata: { type: 'USER' },
    subscription: {
      id: 'sub_1',
      status: subscriptionStatus,
      items: { object: 'list', data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
    },
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    stripeService = await import('../stripe.service');
    mocks.claimBillingAccountForCustomer.mockResolvedValue(true);
    mocks.customersRetrieve.mockResolvedValue({
      id: 'cus_completed',
      deleted: undefined,
      metadata: { userId: user.id, type: 'USER' },
      subscriptions: { object: 'list', data: [] },
    });
  });

  it('lets a paid checkout take the account from an abandoned duplicate', async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue(session('active'));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_completed', allowRepoint: true }),
    );
  });

  // A delayed payment method leaves the subscription `incomplete` until Stripe collects, and this service does
  // not let an unpaid customer displace a paying one anywhere else either.
  it('does not let a checkout whose invoice is unpaid take the account over', async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue(session('incomplete'));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    expect(mocks.claimBillingAccountForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_completed', allowRepoint: false }),
    );
  });

  // Retrying cannot help until the invoice clears, and reconciling against a customer that does not hold the
  // account would overwrite the paying customer's rows.
  it('stops after stamping metadata when an unpaid checkout cannot claim the account', async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue(session('incomplete'));
    mocks.claimBillingAccountForCustomer.mockResolvedValue(false);

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_completed', {
      metadata: { userId: user.id, teamId: null, type: 'USER' },
    });
    expect(mocks.customersRetrieve).not.toHaveBeenCalled();
    expect(mocks.updateSubscriptionStateForCustomer).not.toHaveBeenCalled();
  });

  // A refusal despite a paid subscription is a concurrent claim, which the webhook retry can still resolve.
  it('throws when a paid checkout loses the claim to a concurrent event', async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue(session('active'));
    mocks.claimBillingAccountForCustomer.mockResolvedValue(false);

    await expect(stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' })).rejects.toThrow(
      'held by another Stripe customer',
    );
  });
});

describe('createCheckoutSession', () => {
  let stripeService: typeof StripeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    stripeService = await import('../stripe.service');
    mocks.checkoutSessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.example/cs_1' });
  });

  // The personal-to-team upgrade supplies the customer from our own billing account, so it never reaches
  // `findOrCreateCustomer` and would otherwise start team checkout with no funding instructions.
  it('ensures bank transfer funding instructions when an existing customer starts team checkout', async () => {
    await stripeService.createCheckoutSession({
      user,
      type: 'TEAM',
      priceId: 'price_team',
      mode: 'subscription',
      customerId: 'cus_existing',
    });

    expect(mocks.createFundingInstructions).toHaveBeenCalledWith('cus_existing', expect.objectContaining({ currency: 'usd' }));
    expect(mocks.customersSearch).not.toHaveBeenCalled();
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it('does not create funding instructions for a personal plan', async () => {
    await stripeService.createCheckoutSession({
      user,
      type: 'USER',
      priceId: 'price_pro',
      mode: 'subscription',
      customerId: 'cus_existing',
    });

    expect(mocks.createFundingInstructions).not.toHaveBeenCalled();
  });
});

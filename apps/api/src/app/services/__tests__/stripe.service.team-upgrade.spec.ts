import { STRIPE_PRICE_KEYS } from '@jetstream/types';
import { fromUnixTime } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

// `stripe` v22 ships its types inline per module format, so `import type Stripe from 'stripe'` here
// resolves to the ESM declarations while the service resolves to the CJS ones - structurally identical
// but nominally distinct. Derive the fixture types from the service itself to stay on one identity.
type StripeCustomer = Parameters<typeof StripeService.saveOrUpdateSubscription>[0]['customer'];
type StripeSubscription = Parameters<typeof StripeService.resolveTeamSeatState>[0][number];

const mocks = vi.hoisted(() => ({
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(async () => ({ id: 'cus_1' })),
  pricesRetrieve: vi.fn(),
  pricesList: vi.fn(),
  checkoutSessionsCreate: vi.fn(async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/cs_1' })),
  subscriptionItemsUpdate: vi.fn(async () => ({ id: 'si_1' })),
  schedulesCreate: vi.fn(),
  schedulesUpdate: vi.fn(),
  schedulesRelease: vi.fn(async () => ({})),
  schedulesRetrieve: vi.fn(),
  schedulesCancel: vi.fn(),
  invoicesCreatePreview: vi.fn(),
  invoicesList: vi.fn(),
  webhooksConstructEvent: vi.fn(),
  upsertTeamWithBillingAccount: vi.fn(async () => ({ id: 'team_new' })),
  updateSubscriptionStateForCustomer: vi.fn(async () => ({})),
  updateTeamSubscriptionStateForCustomer: vi.fn(async () => ({})),
  getTeamBillingAccountForSeats: vi.fn(),
  isTeamSeatStateInSync: vi.fn(() => true),
  findTeamSubscriptions: vi.fn(async (): Promise<{ status: string }[]> => []),
  findTeamEntitlements: vi.fn(async () => ({})),
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
    webhooks = { constructEvent: mocks.webhooksConstructEvent };
    prices = { list: mocks.pricesList, retrieve: mocks.pricesRetrieve };
    checkout = { sessions: { create: mocks.checkoutSessionsCreate } };
    subscriptionItems = { update: mocks.subscriptionItemsUpdate };
    subscriptionSchedules = {
      create: mocks.schedulesCreate,
      update: mocks.schedulesUpdate,
      release: mocks.schedulesRelease,
      retrieve: mocks.schedulesRetrieve,
      // Present only so the tests can prove it is never called: cancelling a schedule cancels the subscription
      cancel: mocks.schedulesCancel,
    };
    invoices = { createPreview: mocks.invoicesCreatePreview, list: mocks.invoicesList };
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { STRIPE_API_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', JETSTREAM_SERVER_URL: 'http://localhost:3333' },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/email', () => ({ sendWelcomeToProEmail: vi.fn() }));

vi.mock('../../db/subscription.db', () => ({
  updateSubscriptionStateForCustomer: mocks.updateSubscriptionStateForCustomer,
  updateTeamSubscriptionStateForCustomer: mocks.updateTeamSubscriptionStateForCustomer,
  updateUserEntitlements: vi.fn(async () => ({})),
  updateTeamEntitlements: vi.fn(async () => ({})),
  getTeamBillingAccountForSeats: mocks.getTeamBillingAccountForSeats,
  isTeamSeatStateInSync: mocks.isTeamSeatStateInSync,
}));
vi.mock('../../db/team.db', () => ({
  upsertTeamWithBillingAccount: mocks.upsertTeamWithBillingAccount,
  createBillingAccountIfNotExists: vi.fn(async () => ({})),
  findEntitlements: mocks.findTeamEntitlements,
  findSubscriptions: mocks.findTeamSubscriptions,
}));
vi.mock('../../db/user.db', () => ({
  findById: mocks.findUserById,
  upsertBillingAccount: vi.fn(async () => ({})),
  findBillingAccountByCustomerId: vi.fn(),
}));

const PERIOD_START = 1_760_000_000;
const PERIOD_END = 1_762_592_000;

const subscriptionWithPrice = (
  lookupKey: string,
  { quantity = 1, billingScheme = 'per_unit', schedule = null as string | null, itemId = 'si_1' } = {},
) => ({
  id: 'sub_1',
  status: 'active',
  cancel_at: null,
  cancel_at_period_end: false,
  discounts: [],
  schedule,
  items: {
    object: 'list',
    data: [
      {
        id: itemId,
        quantity,
        current_period_start: PERIOD_START,
        current_period_end: PERIOD_END,
        price: {
          id: `price_${lookupKey}`,
          lookup_key: lookupKey,
          billing_scheme: billingScheme,
          recurring: { interval: 'month', interval_count: 1 },
        },
      },
    ],
  },
});

const customerWithPlan = (lookupKey: string, subscriptionOptions?: Parameters<typeof subscriptionWithPrice>[1]) =>
  ({
    id: 'cus_1',
    deleted: undefined,
    discount: null,
    metadata: { userId: 'user_1', type: 'USER' },
    subscriptions: { object: 'list', data: [subscriptionWithPrice(lookupKey, subscriptionOptions)] },
  }) as unknown as StripeCustomer;

const asSubscriptions = (...subscriptions: ReturnType<typeof subscriptionWithPrice>[]) => subscriptions as unknown as StripeSubscription[];

const VOLUME_TIERS = [
  { up_to: 10, unit_amount: 2500, flat_amount: null },
  { up_to: null, unit_amount: 2000, flat_amount: null },
];
const LEGACY_GRADUATED_TIERS = [
  { up_to: 5, flat_amount: 110000, unit_amount: null },
  { up_to: null, flat_amount: null, unit_amount: 22000 },
];

// A far-future second phase: the decrease is still pending
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const seatDecreaseSchedule = ({
  phaseTwoStart = NOW_SECONDS + 30 * 24 * 3600,
  metadata = { type: 'SEAT_DECREASE', teamId: 'team_1', seats: '3' } as Record<string, string>,
  status = 'active',
} = {}) => ({
  id: 'sub_sched_1',
  status,
  metadata,
  phases: [
    {
      start_date: phaseTwoStart - 30 * 24 * 3600,
      end_date: phaseTwoStart,
      items: [{ price: 'price_TEAM_MONTHLY', quantity: 5 }],
      discounts: [],
    },
    {
      start_date: phaseTwoStart,
      end_date: phaseTwoStart + 30 * 24 * 3600,
      items: [{ price: 'price_TEAM_MONTHLY', quantity: 3 }],
      discounts: [],
    },
  ],
});

let stripeService: typeof StripeService;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.isTeamSeatStateInSync.mockReturnValue(true);
  mocks.customersRetrieve.mockResolvedValue(customerWithPlan('TEAM_MONTHLY'));
  mocks.getTeamBillingAccountForSeats.mockResolvedValue({
    id: 'team_new',
    billingStatus: 'ACTIVE',
    billingAccount: { customerId: 'cus_1', manualBilling: false, licenseCountLimit: 1 },
  });
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

describe('personal -> team plan upgrade', () => {
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
    // The team subscription must be recorded against the team, not the personal account
    expect(mocks.updateTeamSubscriptionStateForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team_new', customerId: 'cus_1' }),
    );
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

describe('createCheckoutSession', () => {
  const user = { id: 'user_1', name: 'Ada', email: 'ada@example.com' };

  it('sends the purchased seat count with quantity adjustment disabled and the team name in metadata', async () => {
    await stripeService.createCheckoutSession({
      user,
      priceId: 'price_TEAM_MONTHLY',
      mode: 'subscription',
      customerId: 'cus_1',
      type: 'TEAM',
      quantity: 7,
      teamName: 'Acme Corp',
    });

    expect(mocks.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_TEAM_MONTHLY', quantity: 7, adjustable_quantity: { enabled: false } }],
        customer: 'cus_1',
        metadata: { userId: 'user_1', teamId: null, type: 'TEAM', teamName: 'Acme Corp' },
      }),
    );
  });

  it('defaults personal plans to a single unit with no team name', async () => {
    await stripeService.createCheckoutSession({
      user,
      priceId: 'price_PRO_MONTHLY',
      mode: 'subscription',
      customerId: 'cus_1',
      type: 'USER',
    });

    expect(mocks.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_PRO_MONTHLY', quantity: 1, adjustable_quantity: { enabled: false } }],
        metadata: { userId: 'user_1', teamId: null, type: 'USER', teamName: null },
      }),
    );
  });
});

describe('fetchPrices', () => {
  it('expands product and tiers so the checkout seat picker can price seats from Stripe data', async () => {
    mocks.pricesList.mockResolvedValue({
      data: STRIPE_PRICE_KEYS.map((key) => ({
        id: `price_${key}`,
        lookup_key: key,
        billing_scheme: 'tiered',
        recurring: { interval: key.endsWith('ANNUAL') ? 'year' : 'month' },
        unit_amount: null,
        tiers_mode: 'volume',
        tiers: VOLUME_TIERS,
        product: { id: 'prod_1', name: 'Team', description: null, images: [] },
      })),
    });

    const prices = await stripeService.fetchPrices({ lookupKeys: STRIPE_PRICE_KEYS });

    expect(mocks.pricesList).toHaveBeenCalledWith(expect.objectContaining({ expand: ['data.product', 'data.tiers'] }));
    expect(prices.TEAM_MONTHLY.tiers).toEqual([
      { upTo: 10, unitAmount: 25, flatAmount: null },
      { upTo: null, unitAmount: 20, flatAmount: null },
    ]);
  });
});

describe('resolveTeamSeatState', () => {
  it('returns null when the customer has no team item', async () => {
    expect(await stripeService.resolveTeamSeatState(asSubscriptions(subscriptionWithPrice('PRO_MONTHLY')))).toBeNull();
    expect(mocks.pricesRetrieve).not.toHaveBeenCalled();
  });

  it('resolves a current volume price: no included seats, quantity is the seat count', async () => {
    mocks.pricesRetrieve.mockResolvedValue({ id: 'price_TEAM_MONTHLY', tiers: VOLUME_TIERS });

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 6, billingScheme: 'tiered' })),
    );

    expect(mocks.pricesRetrieve).toHaveBeenCalledWith('price_TEAM_MONTHLY', { expand: ['tiers'] });
    expect(state).toEqual({
      subscriptionItemId: 'si_1',
      quantity: 6,
      includedSeats: 0,
      periodEnd: fromUnixTime(PERIOD_END),
      pending: null,
      foreignScheduleId: null,
    });
  });

  it('resolves a legacy graduated price whose flat first tier includes five seats', async () => {
    mocks.pricesRetrieve.mockResolvedValue({ id: 'price_TEAM_MONTHLY', tiers: LEGACY_GRADUATED_TIERS });

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 1, billingScheme: 'tiered' })),
    );

    expect(state).toEqual(expect.objectContaining({ quantity: 1, includedSeats: 5 }));
  });

  it('skips the tier lookup for per-unit prices', async () => {
    const state = await stripeService.resolveTeamSeatState(asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 3 })));

    expect(mocks.pricesRetrieve).not.toHaveBeenCalled();
    expect(state).toEqual(expect.objectContaining({ quantity: 3, includedSeats: 0 }));
  });

  it('reads a pending decrease from the second phase of a Jetstream seat schedule', async () => {
    const phaseTwoStart = NOW_SECONDS + 10 * 24 * 3600;
    mocks.schedulesRetrieve.mockResolvedValue(seatDecreaseSchedule({ phaseTwoStart }));

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 5, schedule: 'sub_sched_1' })),
    );

    expect(mocks.schedulesRetrieve).toHaveBeenCalledWith('sub_sched_1');
    expect(state?.pending).toEqual({ quantity: 3, effectiveAt: fromUnixTime(phaseTwoStart), scheduleId: 'sub_sched_1' });
    expect(state?.foreignScheduleId).toBeNull();
    expect(mocks.schedulesRelease).not.toHaveBeenCalled();
  });

  it('releases a Jetstream seat schedule whose second phase has already started and reports no pending decrease', async () => {
    mocks.schedulesRetrieve.mockResolvedValue(seatDecreaseSchedule({ phaseTwoStart: NOW_SECONDS - 60 }));

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 3, schedule: 'sub_sched_1' })),
    );

    expect(mocks.schedulesRelease).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.schedulesCancel).not.toHaveBeenCalled();
    expect(state).toEqual(expect.objectContaining({ quantity: 3, pending: null, foreignScheduleId: null }));
  });

  it('still resolves the state when releasing an applied schedule fails', async () => {
    mocks.schedulesRetrieve.mockResolvedValue(seatDecreaseSchedule({ phaseTwoStart: NOW_SECONDS - 60 }));
    mocks.schedulesRelease.mockRejectedValueOnce(new Error('stripe down'));

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 3, schedule: 'sub_sched_1' })),
    );

    expect(state?.pending).toBeNull();
  });

  it('flags a schedule Jetstream did not create as foreign without touching it', async () => {
    mocks.schedulesRetrieve.mockResolvedValue(seatDecreaseSchedule({ metadata: { source: 'dashboard' } }));

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 5, schedule: 'sub_sched_other' })),
    );

    expect(state).toEqual(expect.objectContaining({ pending: null, foreignScheduleId: 'sub_sched_1' }));
    expect(mocks.schedulesRelease).not.toHaveBeenCalled();
  });

  it('ignores a Jetstream seat schedule that is no longer active', async () => {
    mocks.schedulesRetrieve.mockResolvedValue(seatDecreaseSchedule({ status: 'released' }));

    const state = await stripeService.resolveTeamSeatState(
      asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 5, schedule: 'sub_sched_1' })),
    );

    expect(state).toEqual(expect.objectContaining({ pending: null, foreignScheduleId: null }));
    expect(mocks.schedulesRelease).not.toHaveBeenCalled();
  });
});

describe('previewTeamSeatChange', () => {
  it('previews the recurring total without prorations and the amount due now with them', async () => {
    mocks.invoicesCreatePreview.mockResolvedValueOnce({ amount_due: 20000, lines: { data: [] } }).mockResolvedValueOnce({
      amount_due: 99999,
      lines: {
        data: [
          { amount: -4000, parent: { subscription_item_details: { proration: true } } },
          { amount: 9000, parent: { subscription_item_details: { proration: true } } },
          { amount: 20000, parent: { subscription_item_details: { proration: false } } },
        ],
      },
    });

    const result = await stripeService.previewTeamSeatChange({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      subscriptionItemId: 'si_1',
      quantity: 8,
      prorationDate: 1_760_500_000,
    });

    expect(mocks.invoicesCreatePreview).toHaveBeenNthCalledWith(1, {
      customer: 'cus_1',
      subscription: 'sub_1',
      subscription_details: { items: [{ id: 'si_1', quantity: 8 }], proration_behavior: 'none' },
    });
    expect(mocks.invoicesCreatePreview).toHaveBeenNthCalledWith(2, {
      customer: 'cus_1',
      subscription: 'sub_1',
      subscription_details: { items: [{ id: 'si_1', quantity: 8 }], proration_behavior: 'always_invoice', proration_date: 1_760_500_000 },
    });
    expect(result).toEqual({ nextInvoiceAmount: 200, amountDueNow: 50 });
  });

  it('only previews the recurring total when there is no proration date (decreases and cancellations)', async () => {
    mocks.invoicesCreatePreview.mockResolvedValue({ amount_due: 7500, lines: { data: [] } });

    const result = await stripeService.previewTeamSeatChange({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      subscriptionItemId: 'si_1',
      quantity: 3,
      prorationDate: null,
    });

    expect(mocks.invoicesCreatePreview).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ nextInvoiceAmount: 75, amountDueNow: 0 });
  });
});

describe('commitTeamSeatIncrease', () => {
  it('updates the item with an immediate prorated invoice that fails atomically on declined payment', async () => {
    await stripeService.commitTeamSeatIncrease({ subscriptionItemId: 'si_1', quantity: 8, prorationDate: 1_760_500_000 });

    expect(mocks.subscriptionItemsUpdate).toHaveBeenCalledWith('si_1', {
      quantity: 8,
      proration_behavior: 'always_invoice',
      proration_date: 1_760_500_000,
      payment_behavior: 'error_if_incomplete',
    });
  });
});

describe('scheduleTeamSeatDecrease', () => {
  it('migrates the subscription onto a schedule and sends the exact two-phase update', async () => {
    mocks.schedulesCreate.mockResolvedValue({
      id: 'sub_sched_new',
      phases: [
        {
          start_date: PERIOD_START,
          end_date: PERIOD_END,
          items: [{ price: { id: 'price_TEAM_MONTHLY' }, quantity: 5 }],
          discounts: [{ coupon: 'coupon_1', discount: 'di_1', promotion_code: null }],
        },
      ],
    });
    mocks.schedulesUpdate.mockResolvedValue({ id: 'sub_sched_new' });
    const [subscription] = asSubscriptions(subscriptionWithPrice('TEAM_MONTHLY', { quantity: 5 }));

    const schedule = await stripeService.scheduleTeamSeatDecrease({
      teamId: 'team_1',
      subscription,
      item: subscription.items.data[0],
      quantity: 3,
    });

    expect(mocks.schedulesCreate).toHaveBeenCalledWith({ from_subscription: 'sub_1' });
    expect(mocks.schedulesUpdate).toHaveBeenCalledWith('sub_sched_new', {
      end_behavior: 'release',
      metadata: { type: 'SEAT_DECREASE', teamId: 'team_1', seats: '3' },
      phases: [
        {
          start_date: PERIOD_START,
          end_date: PERIOD_END,
          items: [{ price: 'price_TEAM_MONTHLY', quantity: 5 }],
          discounts: [{ discount: 'di_1' }],
        },
        {
          items: [{ price: 'price_TEAM_MONTHLY', quantity: 3 }],
          duration: { interval: 'month', interval_count: 1 },
          proration_behavior: 'none',
          discounts: [{ discount: 'di_1' }],
        },
      ],
    });
    expect(mocks.schedulesCancel).not.toHaveBeenCalled();
    expect(schedule.id).toBe('sub_sched_new');
  });
});

describe('releaseTeamSeatSchedule', () => {
  it('releases the schedule', async () => {
    await stripeService.releaseTeamSeatSchedule('sub_sched_1');

    expect(mocks.schedulesRelease).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.schedulesCancel).not.toHaveBeenCalled();
  });

  it('treats an already-released schedule (invalid request) as done', async () => {
    mocks.schedulesRelease.mockRejectedValueOnce({ type: 'StripeInvalidRequestError', message: 'not active' });

    await expect(stripeService.releaseTeamSeatSchedule('sub_sched_1')).resolves.toBeUndefined();
  });

  it('rethrows other failures', async () => {
    mocks.schedulesRelease.mockRejectedValueOnce(new Error('network'));

    await expect(stripeService.releaseTeamSeatSchedule('sub_sched_1')).rejects.toThrow('network');
  });
});

describe('fetchLatestInvoiceForSubscription', () => {
  it('returns the newest invoice on the subscription in dollars', async () => {
    mocks.invoicesList.mockResolvedValue({
      data: [{ id: 'in_1', status: 'paid', amount_due: 5000, hosted_invoice_url: 'https://invoice.stripe.com/in_1' }],
    });

    const invoice = await stripeService.fetchLatestInvoiceForSubscription('sub_1');

    expect(mocks.invoicesList).toHaveBeenCalledWith({ subscription: 'sub_1', limit: 1 });
    expect(invoice).toEqual({ id: 'in_1', status: 'paid', amountDue: 50, hostedInvoiceUrl: 'https://invoice.stripe.com/in_1' });
  });

  it('returns null when the subscription has no invoice yet', async () => {
    mocks.invoicesList.mockResolvedValue({ data: [] });

    expect(await stripeService.fetchLatestInvoiceForSubscription('sub_1')).toBeNull();
  });
});

describe('seat state synchronization', () => {
  it('passes the resolved seat state to the team subscription writer from the webhook path', async () => {
    await stripeService.saveOrUpdateSubscription({ customer: customerWithPlan('TEAM_MONTHLY', { quantity: 4 }), sendWelcomeEmail: false });

    expect(mocks.updateTeamSubscriptionStateForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team_new',
        seatState: {
          subscriptionItemId: 'si_1',
          quantity: 4,
          includedSeats: 0,
          periodEnd: fromUnixTime(PERIOD_END),
          pending: null,
          foreignScheduleId: null,
        },
      }),
    );
  });

  it('re-synchronizes the team when only the seat mirror has drifted', async () => {
    mocks.findTeamSubscriptions.mockResolvedValue([{ status: 'ACTIVE' }]);
    mocks.findTeamEntitlements.mockResolvedValue({ chromeExtension: true, googleDrive: true, desktop: true, recordSync: true });
    mocks.isTeamSeatStateInSync.mockReturnValue(false);

    const result = await stripeService.synchronizeStripeWithJetstreamTeamIfRequired({ teamId: 'team_new' });

    expect(mocks.isTeamSeatStateInSync).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_1' }),
      expect.objectContaining({ subscriptionItemId: 'si_1', quantity: 1 }),
    );
    expect(result).toEqual(expect.objectContaining({ success: true, didUpdate: true }));
    expect(mocks.updateTeamSubscriptionStateForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team_new', seatState: expect.objectContaining({ subscriptionItemId: 'si_1' }) }),
    );
  });

  it('reports nothing to do when items, entitlements and seat state all match', async () => {
    mocks.findTeamSubscriptions.mockResolvedValue([{ status: 'ACTIVE' }]);
    mocks.findTeamEntitlements.mockResolvedValue({ chromeExtension: true, googleDrive: true, desktop: true, recordSync: true });

    const result = await stripeService.synchronizeStripeWithJetstreamTeamIfRequired({ teamId: 'team_new' });

    expect(result).toEqual(expect.objectContaining({ success: true, didUpdate: false }));
    expect(mocks.updateTeamSubscriptionStateForCustomer).not.toHaveBeenCalled();
  });

  it('skips the seat comparison for manual-billing teams through the db helper contract', async () => {
    mocks.getTeamBillingAccountForSeats.mockResolvedValue({
      id: 'team_new',
      billingStatus: 'MANUAL',
      billingAccount: { customerId: 'cus_1', manualBilling: true, licenseCountLimit: 50 },
    });
    mocks.findTeamSubscriptions.mockResolvedValue([{ status: 'ACTIVE' }]);
    mocks.findTeamEntitlements.mockResolvedValue({ chromeExtension: true, googleDrive: true, desktop: true, recordSync: true });

    await stripeService.synchronizeStripeWithJetstreamTeamIfRequired({ teamId: 'team_new' });

    expect(mocks.isTeamSeatStateInSync).toHaveBeenCalledWith(expect.objectContaining({ manualBilling: true }), expect.anything());
  });
});

describe('handleStripeWebhook', () => {
  it.each([
    'subscription_schedule.updated',
    'subscription_schedule.released',
    'subscription_schedule.completed',
    'subscription_schedule.canceled',
    'subscription_schedule.aborted',
  ])('re-fetches the customer and synchronizes on %s', async (eventType) => {
    mocks.webhooksConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: eventType,
      data: { object: { id: 'sub_sched_1', customer: 'cus_1' } },
    });

    await stripeService.handleStripeWebhook({ signature: 'sig', payload: '{}' });

    expect(mocks.customersRetrieve).toHaveBeenCalledWith('cus_1', { expand: ['subscriptions'] });
    expect(mocks.updateTeamSubscriptionStateForCustomer).toHaveBeenCalled();
  });

  it('resolves an expanded customer object on schedule events', async () => {
    mocks.webhooksConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'subscription_schedule.released',
      data: { object: { id: 'sub_sched_1', customer: { id: 'cus_1' } } },
    });

    await stripeService.handleStripeWebhook({ signature: 'sig', payload: '{}' });

    expect(mocks.customersRetrieve).toHaveBeenCalledWith('cus_1', { expand: ['subscriptions'] });
  });
});

import { formatISO, fromUnixTime } from 'date-fns';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSeatDecreaseScheduleParams,
  convertCustomerWithSubscriptionsToUserFacing,
  findTeamSeatItem,
  getStripeErrorDetails,
  isProrationDateError,
  isStripeCardError,
  isStripeInvalidRequestError,
  sumProrationAmount,
} from '../stripe.service';

// stripe.service instantiates a Stripe client and pulls in db/email modules at import — stub the config
// (no STRIPE_API_KEY → the client becomes an empty object) and email so the module loads in isolation.
vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));

vi.mock('@jetstream/email', () => ({
  sendWelcomeToProEmail: vi.fn(),
}));

// The db modules pull in the full data layer (and controllers that instantiate caches at import). Stub
// them — the pure functions under test never touch them — so the module loads without that graph.
vi.mock('../../db/subscription.db', () => ({}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../db/user.db', () => ({}));

const entitlement = (lookup_key: string) => ({ lookup_key }) as Stripe.Entitlements.ActiveEntitlement;

const NONE = {
  googleDrive: false,
  chromeExtension: false,
  recordSync: false,
  desktop: false,
  analysisTools: false,
  salesforceCanvas: false,
};

describe('resolveEntitlementAccessFromStripe', () => {
  let resolveEntitlementAccessFromStripe: typeof import('../stripe.service').resolveEntitlementAccessFromStripe;

  beforeEach(async () => {
    vi.resetModules();
    ({ resolveEntitlementAccessFromStripe } = await import('../stripe.service'));
  });

  it('grants analysisTools to paid (chromeExtension) customers even without a Stripe analysisTools key', () => {
    // This is the regression: the reducer seeds analysisTools:false and Stripe has no analysisTools
    // lookup_key, so without the derivation a paid customer's backfilled grant would be reset to false.
    const result = resolveEntitlementAccessFromStripe([entitlement('chromeExtension')]);
    expect(result.chromeExtension).toBe(true);
    expect(result.analysisTools).toBe(true);
  });

  it('does not grant analysisTools to customers with no paid entitlement', () => {
    expect(resolveEntitlementAccessFromStripe([])).toEqual(NONE);
  });

  it('keeps analysisTools true when Stripe returns it directly', () => {
    expect(resolveEntitlementAccessFromStripe([entitlement('analysisTools')]).analysisTools).toBe(true);
  });

  it('ignores unknown lookup_keys', () => {
    expect(resolveEntitlementAccessFromStripe([entitlement('somethingElse')])).toEqual(NONE);
  });

  it('preserves other entitlements alongside the derived analysisTools grant', () => {
    const result = resolveEntitlementAccessFromStripe([entitlement('chromeExtension'), entitlement('googleDrive')]);
    expect(result).toEqual({ ...NONE, chromeExtension: true, googleDrive: true, analysisTools: true });
  });
});

// `stripe` v22 ships its types inline per module format, so `import type Stripe from 'stripe'` resolves
// to the ESM declarations here while the service (compiled as CommonJS) sees the CJS ones. The two are
// not assignable to each other, so derive the customer type from the function under test instead.
type StripeCustomer = Parameters<typeof convertCustomerWithSubscriptionsToUserFacing>[0];

const START_DATE = 1_717_200_000;
const BILLING_CYCLE_ANCHOR = 1_718_000_000;
const CURRENT_PERIOD_START = BILLING_CYCLE_ANCHOR;
const CURRENT_PERIOD_END = 1_749_536_000;

function buildCustomer({
  balance = 0,
  customerDiscount = null as { id: string } | null,
  subscriptionOverrides = {},
  priceOverrides = {},
  quantity = 1 as number | null,
} = {}): StripeCustomer {
  return {
    id: 'cus_123',
    balance,
    delinquent: false,
    discount: customerDiscount,
    subscriptions: {
      data: [
        {
          id: 'sub_123',
          billing_cycle_anchor: BILLING_CYCLE_ANCHOR,
          cancel_at: null,
          cancel_at_period_end: false,
          canceled_at: null,
          discounts: [],
          ended_at: null,
          start_date: START_DATE,
          status: 'active',
          items: {
            data: [
              {
                id: 'si_123',
                quantity,
                current_period_start: CURRENT_PERIOD_START,
                current_period_end: CURRENT_PERIOD_END,
                price: {
                  id: 'price_pro_annual',
                  active: true,
                  product: 'prod_pro',
                  lookup_key: 'PRO_ANNUAL',
                  unit_amount: 25000,
                  billing_scheme: 'per_unit',
                  recurring: { interval: 'year', interval_count: 1 },
                  ...priceOverrides,
                },
              },
            ],
          },
          ...subscriptionOverrides,
        },
      ],
    },
  } as unknown as StripeCustomer;
}

/**
 * convertCustomerWithSubscriptionsToUserFacing is the boundary where raw Stripe API objects become
 * the user-facing billing shapes rendered by the web app. The contracts locked in here:
 * - Monetary amounts (balance, unitAmount) are converted from Stripe's cents to dollars HERE,
 *   and only here — the client must not divide again (a double-conversion previously shipped
 *   a "$2.50/year" display bug).
 * - Tiered prices (e.g. TEAM volume pricing) have no top-level unit_amount, which maps to
 *   unitAmount 0; the client derives what the customer pays from billingScheme + tiers instead.
 *   Stripe omits `tiers` from the price embedded in a subscription item, so this pure converter
 *   passes through whatever is present and getUserFacingStripeCustomer fills the rest in.
 * - hasDiscount is true for either discount source: a customer-level discount, or entries in the
 *   subscription discounts array (which are unexpanded id strings by default). Stripe v22 removed
 *   the singular subscription-level discount, so it is no longer a source.
 */
describe('convertCustomerWithSubscriptionsToUserFacing', () => {
  it('converts cents to dollars, uppercases status, and converts unix dates to ISO strings', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ balance: -5000 }));

    expect(result).toEqual({
      id: 'cus_123',
      balance: -50,
      delinquent: false,
      subscriptions: [
        {
          id: 'sub_123',
          billingCycleAnchor: formatISO(fromUnixTime(BILLING_CYCLE_ANCHOR)),
          cancelAt: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          endedAt: null,
          startDate: formatISO(fromUnixTime(START_DATE)),
          status: 'ACTIVE',
          hasDiscount: false,
          items: [
            {
              id: 'si_123',
              priceId: 'price_pro_annual',
              active: true,
              currentPeriodStart: formatISO(fromUnixTime(CURRENT_PERIOD_START)),
              currentPeriodEnd: formatISO(fromUnixTime(CURRENT_PERIOD_END)),
              product: 'prod_pro',
              lookupKey: 'PRO_ANNUAL',
              unitAmount: 250,
              billingScheme: 'per_unit',
              tiersMode: null,
              tiers: null,
              recurringInterval: 'YEAR',
              recurringIntervalCount: 1,
              quantity: 1,
            },
          ],
        },
      ],
    });
  });

  it('maps tiered prices (no top-level unit_amount) to unitAmount 0 and carries the billing scheme so the client knows to use tiers', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(
      buildCustomer({
        priceOverrides: {
          lookup_key: 'TEAM_MONTHLY',
          unit_amount: null,
          billing_scheme: 'tiered',
          tiers_mode: 'volume',
          recurring: { interval: 'month', interval_count: 1 },
        },
        quantity: 6,
      }),
    );

    expect(result.subscriptions[0].items[0]).toEqual(
      expect.objectContaining({
        lookupKey: 'TEAM_MONTHLY',
        unitAmount: 0,
        billingScheme: 'tiered',
        tiersMode: 'volume',
        tiers: null,
        recurringInterval: 'MONTH',
        quantity: 6,
      }),
    );
  });

  it('converts embedded price tiers from cents to dollars, keeping flat and per-unit amounts distinct', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(
      buildCustomer({
        priceOverrides: {
          unit_amount: null,
          billing_scheme: 'tiered',
          tiers_mode: 'graduated',
          tiers: [
            { up_to: 5, flat_amount: 110000, unit_amount: null },
            { up_to: null, flat_amount: null, unit_amount: 22000 },
          ],
        },
      }),
    );

    expect(result.subscriptions[0].items[0].tiers).toEqual([
      { upTo: 5, flatAmount: 1100, unitAmount: null },
      { upTo: null, flatAmount: null, unitAmount: 220 },
    ]);
  });

  it('defaults a missing item quantity to 1', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ quantity: null }));

    expect(result.subscriptions[0].items[0].quantity).toBe(1);
  });

  it('sets hasDiscount when the customer has a customer-level discount', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ customerDiscount: { id: 'di_customer' } }));

    expect(result.subscriptions[0].hasDiscount).toBe(true);
  });

  it('sets hasDiscount when the subscription discounts array contains unexpanded ids', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ subscriptionOverrides: { discounts: ['di_abc'] } }));

    expect(result.subscriptions[0].hasDiscount).toBe(true);
  });

  it('does not set hasDiscount when no discount source is present', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer());

    expect(result.subscriptions[0].hasDiscount).toBe(false);
  });
});

type StripeSubscription = Parameters<typeof findTeamSeatItem>[0][number];
type StripeSchedule = Parameters<typeof buildSeatDecreaseScheduleParams>[0]['schedule'];
type StripeSubscriptionItem = Parameters<typeof buildSeatDecreaseScheduleParams>[0]['item'];
type StripeInvoiceForProration = Parameters<typeof sumProrationAmount>[0];

function buildSubscription(id: string, items: { id: string; lookupKey: string | null }[]): StripeSubscription {
  return {
    id,
    status: 'active',
    items: { data: items.map(({ id: itemId, lookupKey }) => ({ id: itemId, price: { id: `price_${lookupKey}`, lookup_key: lookupKey } })) },
  } as unknown as StripeSubscription;
}

describe('findTeamSeatItem', () => {
  it('returns the single TEAM_ item with its subscription', () => {
    const subscription = buildSubscription('sub_1', [{ id: 'si_team', lookupKey: 'TEAM_MONTHLY' }]);

    const result = findTeamSeatItem([buildSubscription('sub_0', [{ id: 'si_pro', lookupKey: 'PRO_MONTHLY' }]), subscription]);

    expect(result?.subscription.id).toBe('sub_1');
    expect(result?.item.id).toBe('si_team');
  });

  it('returns null when no item is a team price', () => {
    expect(findTeamSeatItem([buildSubscription('sub_1', [{ id: 'si_pro', lookupKey: 'PRO_ANNUAL' }])])).toBeNull();
    expect(findTeamSeatItem([buildSubscription('sub_1', [{ id: 'si_x', lookupKey: null }])])).toBeNull();
    expect(findTeamSeatItem([])).toBeNull();
  });

  it('returns null when more than one TEAM_ item exists, because the seat state is ambiguous', () => {
    const result = findTeamSeatItem([
      buildSubscription('sub_1', [{ id: 'si_a', lookupKey: 'TEAM_MONTHLY' }]),
      buildSubscription('sub_2', [{ id: 'si_b', lookupKey: 'TEAM_ANNUAL' }]),
    ]);

    expect(result).toBeNull();
  });
});

describe('sumProrationAmount', () => {
  const invoice = (amountDue: number, lines: { amount: number; proration?: boolean }[]): StripeInvoiceForProration =>
    ({
      amount_due: amountDue,
      lines: {
        data: lines.map(({ amount, proration }) => ({
          amount,
          parent: proration === undefined ? null : { subscription_item_details: { proration } },
        })),
      },
    }) as unknown as StripeInvoiceForProration;

  it('sums only the lines Stripe flags as prorations and converts to dollars', () => {
    // Unused time credit, new quantity debit, and the next period's recurring line which must be excluded
    const result = sumProrationAmount(
      invoice(30000, [
        { amount: -5000, proration: true },
        { amount: 12500, proration: true },
        { amount: 22500, proration: false },
      ]),
    );

    expect(result).toBe(75);
  });

  it('falls back to amount_due when no line is flagged as a proration', () => {
    expect(sumProrationAmount(invoice(4250, [{ amount: 4250 }]))).toBe(42.5);
    expect(sumProrationAmount(invoice(0, []))).toBe(0);
  });
});

describe('buildSeatDecreaseScheduleParams', () => {
  const item = {
    id: 'si_team',
    price: { id: 'price_team_monthly', recurring: { interval: 'month', interval_count: 1 } },
  } as unknown as StripeSubscriptionItem;

  const schedule = (discounts: unknown[] = []): StripeSchedule =>
    ({
      id: 'sub_sched_1',
      phases: [
        {
          start_date: 1_760_000_000,
          end_date: 1_762_592_000,
          discounts,
          items: [{ price: { id: 'price_team_monthly' }, quantity: 5 }],
        },
      ],
    }) as unknown as StripeSchedule;

  it('copies the current phase verbatim and adds one interval at the lower quantity that then releases', () => {
    const params = buildSeatDecreaseScheduleParams({ teamId: 'team_1', schedule: schedule(), item, quantity: 3 });

    expect(params).toEqual({
      end_behavior: 'release',
      metadata: { type: 'SEAT_DECREASE', teamId: 'team_1', seats: '3' },
      phases: [
        { start_date: 1_760_000_000, end_date: 1_762_592_000, items: [{ price: 'price_team_monthly', quantity: 5 }] },
        {
          items: [{ price: 'price_team_monthly', quantity: 3 }],
          duration: { interval: 'month', interval_count: 1 },
          proration_behavior: 'none',
        },
      ],
    });
  });

  it('re-sends subscription discounts on both phases, reusing the existing discount id', () => {
    const params = buildSeatDecreaseScheduleParams({
      teamId: 'team_1',
      schedule: schedule([
        { coupon: 'coupon_1', discount: 'di_1', promotion_code: null },
        { coupon: { id: 'coupon_2' }, discount: null, promotion_code: null },
        { coupon: null, discount: null, promotion_code: { id: 'promo_3' } },
      ]),
      item,
      quantity: 3,
    });

    const expectedDiscounts = [{ discount: 'di_1' }, { coupon: 'coupon_2' }, { promotion_code: 'promo_3' }];
    expect(params.phases?.[0].discounts).toEqual(expectedDiscounts);
    expect(params.phases?.[1].discounts).toEqual(expectedDiscounts);
  });

  it('accepts price ids given as strings on the current phase', () => {
    const stringPriceSchedule = {
      ...schedule(),
      phases: [{ start_date: 1, end_date: 2, discounts: [], items: [{ price: 'price_team_monthly', quantity: 5 }] }],
    } as unknown as StripeSchedule;

    const params = buildSeatDecreaseScheduleParams({ teamId: 'team_1', schedule: stringPriceSchedule, item, quantity: 3 });

    expect(params.phases?.[0].items).toEqual([{ price: 'price_team_monthly', quantity: 5 }]);
  });
});

describe('Stripe error duck-typing', () => {
  it('recognizes card errors by SDK class name or raw type', () => {
    expect(isStripeCardError({ type: 'StripeCardError' })).toBe(true);
    expect(isStripeCardError({ rawType: 'card_error' })).toBe(true);
    expect(isStripeCardError({ type: 'StripeInvalidRequestError' })).toBe(false);
    expect(isStripeCardError(new Error('boom'))).toBe(false);
    expect(isStripeCardError(null)).toBe(false);
  });

  it('recognizes invalid proration dates from the param or the message', () => {
    expect(isProrationDateError({ type: 'StripeInvalidRequestError', param: 'proration_date' })).toBe(true);
    expect(
      isProrationDateError({ rawType: 'invalid_request_error', message: 'Invalid proration_date: must be within the current period' }),
    ).toBe(true);
    expect(isProrationDateError({ type: 'StripeInvalidRequestError', param: 'quantity' })).toBe(false);
    expect(isProrationDateError({ type: 'StripeCardError', message: 'proration_date' })).toBe(false);
    expect(isStripeInvalidRequestError({ type: 'StripeInvalidRequestError' })).toBe(true);
  });

  it('extracts the message and decline code for the user-facing payment error', () => {
    expect(
      getStripeErrorDetails({ type: 'StripeCardError', message: 'Your card was declined.', decline_code: 'insufficient_funds' }),
    ).toEqual({
      message: 'Your card was declined.',
      declineCode: 'insufficient_funds',
    });
    expect(getStripeErrorDetails(new Error('network down'))).toEqual({ message: 'network down', declineCode: null });
  });
});

/**
 * Focused unit tests for convertCustomerWithSubscriptionsToUserFacing — the boundary where raw
 * Stripe API objects become the user-facing billing shapes rendered by the web app.
 *
 * The contracts locked in here:
 * - Monetary amounts (balance, unitAmount) are converted from Stripe's cents to dollars HERE,
 *   and only here — the client must not divide again (a double-conversion previously shipped
 *   a "$2.50/year" display bug).
 * - Tiered prices (e.g. TEAM volume pricing) have no top-level unit_amount, which maps to
 *   unitAmount 0; the client relies on that sentinel to suppress the price breakdown.
 * - hasDiscount is true for any of the three discount sources: a customer-level discount, the
 *   deprecated subscription-level discount, or entries in the subscription discounts array
 *   (which are unexpanded id strings by default).
 */
import { formatISO, fromUnixTime } from 'date-fns';
import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { convertCustomerWithSubscriptionsToUserFacing } from '../stripe.service';

// Mock the transitive import chain down to the minimum needed to load the module — the
// conversion under test is a pure function and never touches the DB, email, or Stripe client
// (the module-level `new Stripe()` is skipped because the mocked ENV has no STRIPE_API_KEY).
vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@jetstream/email', () => ({ sendWelcomeToProEmail: vi.fn() }));
vi.mock('../../db/subscription.db', () => ({}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../db/user.db', () => ({}));

const START_DATE = 1_717_200_000;
const BILLING_CYCLE_ANCHOR = 1_718_000_000;

function buildCustomer({
  balance = 0,
  customerDiscount = null,
  subscriptionOverrides = {},
  priceOverrides = {},
  quantity = 1 as number | null,
} = {}): Stripe.Customer {
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
          discount: null,
          discounts: [],
          ended_at: null,
          start_date: START_DATE,
          status: 'active',
          items: {
            data: [
              {
                id: 'si_123',
                quantity,
                price: {
                  id: 'price_pro_annual',
                  active: true,
                  product: 'prod_pro',
                  lookup_key: 'PRO_ANNUAL',
                  unit_amount: 25000,
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
  } as unknown as Stripe.Customer;
}

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
              product: 'prod_pro',
              lookupKey: 'PRO_ANNUAL',
              unitAmount: 250,
              recurringInterval: 'YEAR',
              recurringIntervalCount: 1,
              quantity: 1,
            },
          ],
        },
      ],
    });
  });

  it('maps tiered prices (no top-level unit_amount) to unitAmount 0 so the client can suppress the price display', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(
      buildCustomer({
        priceOverrides: { lookup_key: 'TEAM_MONTHLY', unit_amount: null, recurring: { interval: 'month', interval_count: 1 } },
        quantity: 6,
      }),
    );

    expect(result.subscriptions[0].items[0]).toEqual(
      expect.objectContaining({
        lookupKey: 'TEAM_MONTHLY',
        unitAmount: 0,
        recurringInterval: 'MONTH',
        quantity: 6,
      }),
    );
  });

  it('defaults a missing item quantity to 1', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ quantity: null }));

    expect(result.subscriptions[0].items[0].quantity).toBe(1);
  });

  it('sets hasDiscount when the customer has a customer-level discount', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(buildCustomer({ customerDiscount: { id: 'di_customer' } }));

    expect(result.subscriptions[0].hasDiscount).toBe(true);
  });

  it('sets hasDiscount when the subscription has a legacy singular discount', () => {
    const result = convertCustomerWithSubscriptionsToUserFacing(
      buildCustomer({ subscriptionOverrides: { discount: { id: 'di_legacy' } } }),
    );

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

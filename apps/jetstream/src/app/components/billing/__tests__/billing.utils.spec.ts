import { JetstreamPrice, JetstreamPriceTier, StripeUserFacingSubscriptionItem } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  calculateTieredTotal,
  describePriceForQuantity,
  describeQuantityPricing,
  describeSubscriptionItemPricing,
  formatUsd,
  getDefaultTeamName,
  getIntervalLabel,
  getNextVolumeTier,
} from '../billing.utils';

// Current Team pricing: volume tiers, every seat billed at the rate of the tier the total lands in
const VOLUME_TIERS: JetstreamPriceTier[] = [
  { upTo: 5, flatAmount: null, unitAmount: 30 },
  { upTo: null, flatAmount: null, unitAmount: 25 },
];

// Legacy Team pricing: a flat amount covering the first 5 seats, then a per-seat rate beyond that
const LEGACY_TIERS: JetstreamPriceTier[] = [
  { upTo: 5, flatAmount: 1100, unitAmount: null },
  { upTo: null, flatAmount: null, unitAmount: 220 },
];

function buildItem(overrides: Partial<StripeUserFacingSubscriptionItem> = {}): StripeUserFacingSubscriptionItem {
  return {
    id: 'si_123',
    priceId: 'price_123',
    active: true,
    currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: '2026-02-01T00:00:00Z',
    product: 'prod_123',
    lookupKey: null,
    unitAmount: 0,
    billingScheme: 'tiered',
    tiersMode: 'volume',
    tiers: VOLUME_TIERS,
    recurringInterval: 'MONTH',
    recurringIntervalCount: 1,
    quantity: 1,
    ...overrides,
  };
}

function buildPrice(overrides: Partial<JetstreamPrice> = {}): JetstreamPrice {
  return {
    id: 'price_team_monthly',
    billingScheme: 'tiered',
    lookupKey: 'TEAM_MONTHLY',
    interval: 'MONTHLY',
    amount: null,
    product: { id: 'prod_team', name: 'Team', description: null, images: [] },
    tiersMode: 'volume',
    tiers: VOLUME_TIERS,
    ...overrides,
  };
}

describe('formatUsd', () => {
  it('adds thousands separators and drops zero cents', () => {
    expect(formatUsd(1100)).toBe('$1,100');
    expect(formatUsd(25)).toBe('$25');
  });

  it('keeps non-zero cents', () => {
    expect(formatUsd(20.83)).toBe('$20.83');
  });
});

describe('getIntervalLabel', () => {
  it('maps both the subscription-item and price-list interval names', () => {
    expect(getIntervalLabel('MONTH')).toBe('month');
    expect(getIntervalLabel('MONTHLY')).toBe('month');
    expect(getIntervalLabel('YEAR')).toBe('year');
    expect(getIntervalLabel('ANNUAL')).toBe('year');
    expect(getIntervalLabel(null)).toBe('period');
  });
});

describe('calculateTieredTotal', () => {
  it('bills every seat at the rate of the tier the quantity lands in for volume pricing', () => {
    expect(calculateTieredTotal(VOLUME_TIERS, 'volume', 3)).toBe(90);
    expect(calculateTieredTotal(VOLUME_TIERS, 'volume', 5)).toBe(150);
    expect(calculateTieredTotal(VOLUME_TIERS, 'volume', 6)).toBe(150);
  });

  it('charges the flat first tier once and per-seat overage beyond it for graduated legacy pricing', () => {
    expect(calculateTieredTotal(LEGACY_TIERS, 'graduated', 1)).toBe(1100);
    expect(calculateTieredTotal(LEGACY_TIERS, 'graduated', 5)).toBe(1100);
    expect(calculateTieredTotal(LEGACY_TIERS, 'graduated', 7)).toBe(1540);
  });

  it('sums per-unit graduated tiers across the ranges the quantity spans', () => {
    expect(calculateTieredTotal(VOLUME_TIERS, 'graduated', 7)).toBe(5 * 30 + 2 * 25);
  });
});

describe('describeQuantityPricing', () => {
  it('cannot derive a total when tiers are missing', () => {
    expect(describeQuantityPricing(null, 'volume', 4)).toEqual({ total: null, includedSeats: null, perSeatRate: null });
    expect(describeQuantityPricing([], 'volume', 4)).toEqual({ total: null, includedSeats: null, perSeatRate: null });
  });

  it('prices every seat at the active volume tier', () => {
    expect(describeQuantityPricing(VOLUME_TIERS, 'volume', 1)).toEqual({ total: 30, includedSeats: null, perSeatRate: 30 });
    expect(describeQuantityPricing(VOLUME_TIERS, 'volume', 5)).toEqual({ total: 150, includedSeats: null, perSeatRate: 30 });
    expect(describeQuantityPricing(VOLUME_TIERS, 'volume', 6)).toEqual({ total: 150, includedSeats: null, perSeatRate: 25 });
    expect(describeQuantityPricing(VOLUME_TIERS, 'volume', 20)).toEqual({ total: 500, includedSeats: null, perSeatRate: 25 });
  });

  it('reports included seats and no per-seat rate for a legacy flat first tier', () => {
    expect(describeQuantityPricing(LEGACY_TIERS, 'graduated', 1)).toEqual({ total: 1100, includedSeats: 5, perSeatRate: null });
    expect(describeQuantityPricing(LEGACY_TIERS, 'graduated', 7)).toEqual({ total: 1540, includedSeats: 5, perSeatRate: null });
  });

  it('withholds a per-seat rate when graduated pricing blends tiers', () => {
    expect(describeQuantityPricing(VOLUME_TIERS, 'graduated', 7)).toEqual({ total: 200, includedSeats: null, perSeatRate: null });
  });
});

describe('describeSubscriptionItemPricing', () => {
  it('multiplies unit amount by quantity for per-unit prices', () => {
    const item = buildItem({ billingScheme: 'per_unit', tiersMode: null, tiers: null, unitAmount: 25, quantity: 1 });

    expect(describeSubscriptionItemPricing(item)).toEqual({ total: 25, includedSeats: null, perSeatRate: 25 });
  });

  it('cannot derive a total for a tiered price whose tiers were not loaded', () => {
    const item = buildItem({ tiers: null, quantity: 4 });

    expect(describeSubscriptionItemPricing(item)).toEqual({ total: null, includedSeats: null, perSeatRate: null });
  });

  it('exposes the per-seat rate in effect for volume pricing', () => {
    expect(describeSubscriptionItemPricing(buildItem({ quantity: 3 }))).toEqual({ total: 90, includedSeats: null, perSeatRate: 30 });
    expect(describeSubscriptionItemPricing(buildItem({ quantity: 8 }))).toEqual({ total: 200, includedSeats: null, perSeatRate: 25 });
  });

  it('reports included seats and no per-seat rate for a legacy flat first tier', () => {
    const item = buildItem({ tiersMode: 'graduated', tiers: LEGACY_TIERS, recurringInterval: 'YEAR', quantity: 1 });

    expect(describeSubscriptionItemPricing(item)).toEqual({ total: 1100, includedSeats: 5, perSeatRate: null });
  });

  it('withholds a per-seat rate when graduated pricing blends tiers', () => {
    const item = buildItem({ tiersMode: 'graduated', quantity: 7 });

    expect(describeSubscriptionItemPricing(item)).toEqual({ total: 200, includedSeats: null, perSeatRate: null });
  });
});

describe('describePriceForQuantity', () => {
  it('has nothing to show until the price loads', () => {
    expect(describePriceForQuantity(null, 3)).toEqual({ total: null, includedSeats: null, perSeatRate: null });
  });

  it('uses the tier table of a tiered price', () => {
    expect(describePriceForQuantity(buildPrice(), 3)).toEqual({ total: 90, includedSeats: null, perSeatRate: 30 });
    expect(describePriceForQuantity(buildPrice(), 10)).toEqual({ total: 250, includedSeats: null, perSeatRate: 25 });
  });

  it('multiplies the flat amount of a per-unit price', () => {
    const price = buildPrice({ billingScheme: 'per_unit', tiersMode: null, tiers: null, amount: 25 });

    expect(describePriceForQuantity(price, 4)).toEqual({ total: 100, includedSeats: null, perSeatRate: 25 });
    expect(describePriceForQuantity({ ...price, amount: null }, 4)).toEqual({ total: null, includedSeats: null, perSeatRate: null });
  });
});

describe('getNextVolumeTier', () => {
  it('points at the cheaper tier a larger quantity would unlock', () => {
    expect(getNextVolumeTier(VOLUME_TIERS, 'volume', 3)).toEqual({ startsAt: 6, unitAmount: 25 });
    expect(getNextVolumeTier(VOLUME_TIERS, 'volume', 5)).toEqual({ startsAt: 6, unitAmount: 25 });
  });

  it('is null once the quantity is in the last tier', () => {
    expect(getNextVolumeTier(VOLUME_TIERS, 'volume', 6)).toBeNull();
    expect(getNextVolumeTier(VOLUME_TIERS, 'volume', 50)).toBeNull();
  });

  it('is null for graduated pricing, flat tiers or missing tiers', () => {
    expect(getNextVolumeTier(VOLUME_TIERS, 'graduated', 3)).toBeNull();
    expect(getNextVolumeTier(LEGACY_TIERS, 'volume', 3)).toBeNull();
    expect(getNextVolumeTier(null, 'volume', 3)).toBeNull();
  });

  it('ignores a next tier that is not cheaper', () => {
    const risingTiers: JetstreamPriceTier[] = [
      { upTo: 5, flatAmount: null, unitAmount: 20 },
      { upTo: null, flatAmount: null, unitAmount: 25 },
    ];
    expect(getNextVolumeTier(risingTiers, 'volume', 3)).toBeNull();
  });
});

describe('getDefaultTeamName', () => {
  it('capitalizes the organization part of the email domain', () => {
    expect(getDefaultTeamName('jane@acme.com')).toBe('Acme');
    expect(getDefaultTeamName('jane@mail.example.co.uk')).toBe('Mail');
  });

  it('falls back to an empty name when there is no usable domain', () => {
    expect(getDefaultTeamName('not-an-email')).toBe('');
    expect(getDefaultTeamName(null)).toBe('');
  });
});

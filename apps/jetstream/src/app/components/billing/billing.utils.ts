import { JetstreamPriceTier, StripeUserFacingSubscriptionItem } from '@jetstream/types';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Amounts arrive from the API already in dollars (stripe.service.ts converts from cents). */
export function formatUsd(amountInDollars: number): string {
  return usdFormatter.format(amountInDollars);
}

export function getIntervalLabel(interval: StripeUserFacingSubscriptionItem['recurringInterval']): string {
  switch (interval) {
    case 'MONTH':
      return 'month';
    case 'YEAR':
      return 'year';
    case 'WEEK':
      return 'week';
    case 'DAY':
      return 'day';
    default:
      return 'period';
  }
}

/** The tier a quantity falls in: the first tier whose upper bound covers it, else the unbounded final tier. */
function findTierForQuantity(tiers: JetstreamPriceTier[], quantity: number): JetstreamPriceTier {
  return tiers.find(({ upTo }) => upTo === null || quantity <= upTo) ?? tiers[tiers.length - 1];
}

/**
 * Mirrors how Stripe bills a tiered price for a given quantity.
 * - volume: every unit is billed at the single tier the total quantity lands in.
 * - graduated: each tier bills only the units that fall inside its range, plus its flat amount if any do.
 */
export function calculateTieredTotal(
  tiers: JetstreamPriceTier[],
  tiersMode: StripeUserFacingSubscriptionItem['tiersMode'],
  quantity: number,
): number {
  if (tiersMode === 'volume') {
    const tier = findTierForQuantity(tiers, quantity);
    return (tier.flatAmount ?? 0) + (tier.unitAmount ?? 0) * quantity;
  }

  let total = 0;
  let lowerBound = 0;
  for (const { flatAmount, unitAmount, upTo } of tiers) {
    const unitsInTier = Math.min(quantity, upTo ?? Infinity) - lowerBound;
    if (unitsInTier <= 0) {
      break;
    }
    total += (flatAmount ?? 0) + (unitAmount ?? 0) * unitsInTier;
    if (upTo === null) {
      break;
    }
    lowerBound = upTo;
  }
  return total;
}

export interface SubscriptionItemPricing {
  /** List price per billing interval for the current quantity, or null when it cannot be derived (tiered price whose tiers are unavailable). */
  total: number | null;
  /** Seats covered by a flat-amount first tier (legacy "includes 5 users" plans), else null. */
  includedSeats: number | null;
  /** The single per-seat rate in effect at the current quantity, or null when the price is flat or blended across tiers. */
  perSeatRate: number | null;
}

/**
 * Works out what a subscription item costs from the raw price data, covering the three shapes we sell:
 * per-unit (Professional), volume tiers (current Team) and a flat first tier with per-seat overage (legacy Team).
 */
export function describeSubscriptionItemPricing(item: StripeUserFacingSubscriptionItem): SubscriptionItemPricing {
  const { billingScheme, tiers, tiersMode, unitAmount, quantity } = item;

  if (billingScheme !== 'tiered') {
    return { total: unitAmount * quantity, includedSeats: null, perSeatRate: unitAmount };
  }

  if (!tiers || tiers.length === 0) {
    return { total: null, includedSeats: null, perSeatRate: null };
  }

  const [firstTier] = tiers;
  const includedSeats = firstTier.flatAmount && firstTier.upTo !== null ? firstTier.upTo : null;
  const activeTier = findTierForQuantity(tiers, quantity);
  // Graduated pricing beyond the first tier blends rates, so only volume pricing (or a quantity still
  // inside the first tier) has a single per-seat rate worth showing
  const hasSingleRate = tiersMode === 'volume' || activeTier === firstTier;
  const perSeatRate = includedSeats === null && !activeTier.flatAmount && hasSingleRate ? activeTier.unitAmount : null;

  return { total: calculateTieredTotal(tiers, tiersMode, quantity), includedSeats, perSeatRate };
}

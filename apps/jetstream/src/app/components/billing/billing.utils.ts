import { getIncludedSeatsFromPriceTiers } from '@jetstream/shared/utils';
import { JetstreamPrice, JetstreamPriceTier, StripeUserFacingSubscriptionItem } from '@jetstream/types';
import capitalize from 'lodash/capitalize';

// Relocated to the shared ui-utils lib so the teams feature can format the same amounts; re-exported
// here so existing imports keep working
export { formatUsd, getIntervalLabel } from '@jetstream/shared/ui-utils';

type TiersMode = StripeUserFacingSubscriptionItem['tiersMode'];

/** The tier a quantity falls in: the first tier whose upper bound covers it, else the unbounded final tier. */
function findTierForQuantity(tiers: JetstreamPriceTier[], quantity: number): JetstreamPriceTier {
  return tiers.find(({ upTo }) => upTo === null || quantity <= upTo) ?? tiers[tiers.length - 1];
}

/**
 * Mirrors how Stripe bills a tiered price for a given quantity.
 * - volume: every unit is billed at the single tier the total quantity lands in.
 * - graduated: each tier bills only the units that fall inside its range, plus its flat amount if any do.
 */
export function calculateTieredTotal(tiers: JetstreamPriceTier[], tiersMode: TiersMode, quantity: number): number {
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
  /** List price per billing interval for the quantity, or null when it cannot be derived (tiered price whose tiers are unavailable). */
  total: number | null;
  /** Seats covered by a flat-amount first tier (legacy "includes 5 users" plans), else null. */
  includedSeats: number | null;
  /** The single per-seat rate in effect at the quantity, or null when the price is flat or blended across tiers. */
  perSeatRate: number | null;
}

const UNKNOWN_PRICING: SubscriptionItemPricing = { total: null, includedSeats: null, perSeatRate: null };

/**
 * Works out what a tiered price costs at a given quantity, covering both shapes we sell:
 * volume tiers (current Team) and a flat first tier with per-seat overage (legacy Team).
 */
export function describeQuantityPricing(
  tiers: JetstreamPriceTier[] | null | undefined,
  tiersMode: TiersMode,
  quantity: number,
): SubscriptionItemPricing {
  if (!tiers || tiers.length === 0) {
    return UNKNOWN_PRICING;
  }

  const [firstTier] = tiers;
  const includedSeats = getIncludedSeatsFromPriceTiers(tiers) || null;
  const activeTier = findTierForQuantity(tiers, quantity);
  // Graduated pricing beyond the first tier blends rates, so only volume pricing (or a quantity still
  // inside the first tier) has a single per-seat rate worth showing
  const hasSingleRate = tiersMode === 'volume' || activeTier === firstTier;
  const perSeatRate = includedSeats === null && !activeTier.flatAmount && hasSingleRate ? activeTier.unitAmount : null;

  return { total: calculateTieredTotal(tiers, tiersMode, quantity), includedSeats, perSeatRate };
}

/** Pricing for a subscription item, which is per-unit (Professional) or tiered (Team). */
export function describeSubscriptionItemPricing(item: StripeUserFacingSubscriptionItem): SubscriptionItemPricing {
  const { billingScheme, tiers, tiersMode, unitAmount, quantity } = item;

  if (billingScheme !== 'tiered') {
    return { total: unitAmount * quantity, includedSeats: null, perSeatRate: unitAmount };
  }

  return describeQuantityPricing(tiers, tiersMode, quantity);
}

/** Pricing a customer would pay for `quantity` units of a list price, before checkout. */
export function describePriceForQuantity(price: JetstreamPrice | null | undefined, quantity: number): SubscriptionItemPricing {
  if (!price) {
    return UNKNOWN_PRICING;
  }

  if (price.billingScheme !== 'tiered') {
    if (price.amount === null) {
      return UNKNOWN_PRICING;
    }
    return { total: price.amount * quantity, includedSeats: null, perSeatRate: price.amount };
  }

  return describeQuantityPricing(price.tiers, price.tiersMode, quantity);
}

export interface NextVolumeTier {
  /** First quantity billed at the cheaper rate */
  startsAt: number;
  unitAmount: number;
}

/**
 * For volume pricing, the next tier a larger quantity would move every seat into, when it is cheaper
 * than the current rate. Null for graduated pricing, flat tiers, or when already in the last tier.
 */
export function getNextVolumeTier(
  tiers: JetstreamPriceTier[] | null | undefined,
  tiersMode: TiersMode,
  quantity: number,
): NextVolumeTier | null {
  if (tiersMode !== 'volume' || !tiers || tiers.length === 0) {
    return null;
  }

  const activeTier = findTierForQuantity(tiers, quantity);
  const nextTier = tiers[tiers.indexOf(activeTier) + 1];
  if (!nextTier || activeTier.upTo === null || nextTier.unitAmount === null || activeTier.unitAmount === null) {
    return null;
  }
  if (nextTier.flatAmount || nextTier.unitAmount >= activeTier.unitAmount) {
    return null;
  }

  return { startsAt: activeTier.upTo + 1, unitAmount: nextTier.unitAmount };
}

/** A starting point for a new team's name, taken from the organization part of the user's email domain. */
export function getDefaultTeamName(email: string | null | undefined): string {
  const domain = email?.split('@')[1];
  if (!domain) {
    return '';
  }
  return capitalize(domain.split('.')[0]);
}

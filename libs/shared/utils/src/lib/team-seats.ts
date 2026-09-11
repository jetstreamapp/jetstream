import { JetstreamPriceTier, TeamSeatChangeType } from '@jetstream/types';

/**
 * Seat arithmetic shared by the API, the seat backfill and the client, so the enforced cap and the
 * meaning of a requested seat count are defined exactly once.
 */

/** Stripe amounts are in cents; every amount leaves Stripe-facing code in dollars. */
export function centsToDollars(cents: number | null | undefined): number | null {
  return typeof cents === 'number' ? cents / 100 : null;
}

/**
 * The fields of a Stripe `Price.Tier` this module reads. Declared structurally so server code can pass
 * the SDK's type from either of its module formats and this browser-safe lib never imports the SDK.
 */
export interface StripePriceTierLike {
  flat_amount: number | null;
  unit_amount: number | null;
  up_to: number | null;
}

/** Stripe's tier table in dollars, or null when the price carries no tiers. */
export function convertStripePriceTiers(tiers: readonly StripePriceTierLike[] | null | undefined): JetstreamPriceTier[] | null {
  if (!tiers) {
    return null;
  }
  return tiers.map((tier) => ({
    flatAmount: centsToDollars(tier.flat_amount),
    unitAmount: centsToDollars(tier.unit_amount),
    upTo: tier.up_to,
  }));
}

/**
 * Seats covered by a price's flat first tier. Legacy Team prices charge a flat amount for the first
 * five seats and per-seat beyond that, so a subscription with quantity 1 still entitles the team to
 * five seats. Per-seat prices (no flat amount at all) include nothing.
 */
export function getIncludedSeatsFromPriceTiers(tiers: readonly JetstreamPriceTier[] | null | undefined): number {
  const [firstTier] = tiers ?? [];
  // Explicit null check rather than a falsy one: a first tier priced at $0 covers its seats for free,
  // and reading that as "no flat amount" would shrink the team's cap to the raw item quantity
  if (!firstTier || firstTier.flatAmount === null || firstTier.upTo === null) {
    return 0;
  }
  return firstTier.upTo;
}

/** The seat count a plan grants: legacy flat-tier prices include seats beyond the item quantity. */
export function getPurchasedSeatCount({ quantity, includedSeats }: { quantity: number; includedSeats: number }): number {
  return Math.max(quantity, includedSeats);
}

/**
 * What a requested seat count means for a team. A pending decrease is the count already in force, so
 * requesting it again is not a change, while requesting the purchased count cancels the decrease.
 * Any other count is compared against what the team has purchased today.
 */
export function classifySeatChange({
  requested,
  purchased,
  pending,
}: {
  requested: number;
  purchased: number;
  /** Target of a scheduled end-of-period decrease, or null when nothing is pending */
  pending: number | null;
}): TeamSeatChangeType {
  if (requested === (pending ?? purchased)) {
    return 'NONE';
  }
  if (requested === purchased && pending !== null) {
    return 'CANCEL_PENDING_DECREASE';
  }
  return requested > purchased ? 'INCREASE' : 'DECREASE';
}

/**
 * The lowest count a team can move to: every seat already in use or reserved by a pending invitation,
 * whatever the plan includes for free, and never below one. Shared so the seat modal's stepper and the
 * server's validation cannot disagree about the floor.
 *
 * Checkout is deliberately not a caller: a team buying its first subscription has no included seats
 * yet, so its floor is usage alone.
 */
export function getMinimumSeats({
  used,
  reserved,
  includedSeats,
}: {
  used: number;
  reserved: number;
  includedSeats: number | null;
}): number {
  return Math.max(1, used + reserved, includedSeats ?? 0);
}

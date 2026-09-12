import { JetstreamPriceTier } from '@jetstream/types';

/**
 * Seats covered by a price's flat first tier. Legacy Team prices charge a flat amount for the first
 * five seats and per-seat beyond that, so a subscription with quantity 1 still entitles the team to
 * five seats. Per-seat prices (no flat amount) include nothing.
 */
export function getIncludedSeatsFromPriceTiers(tiers: readonly JetstreamPriceTier[] | null | undefined): number {
  const [firstTier] = tiers ?? [];
  if (!firstTier || !firstTier.flatAmount || firstTier.upTo === null) {
    return 0;
  }
  return firstTier.upTo;
}

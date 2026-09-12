import { Maybe } from '@jetstream/types';

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

/**
 * Human label for a billing interval. Accepts the subscription-item form (`MONTH`/`YEAR`, as Stripe
 * names recurring intervals) and the price-list form (`MONTHLY`/`ANNUAL`) so both surfaces share one helper.
 */
export function getIntervalLabel(interval: Maybe<string>): string {
  switch (interval) {
    case 'MONTH':
    case 'MONTHLY':
      return 'month';
    case 'YEAR':
    case 'ANNUAL':
      return 'year';
    case 'WEEK':
      return 'week';
    case 'DAY':
      return 'day';
    default:
      return 'period';
  }
}

import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

export const EMPTY_VALUE = '—';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }
  return format(parseISO(value), 'MMM d, yyyy h:mm a');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }
  return format(parseISO(value), 'MMM d, yyyy');
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }
  return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

export function isDateInPast(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return isPast(parseISO(value));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }
  return value.toLocaleString();
}

/**
 * Stripe's own lists (https://docs.stripe.com/currencies#zero-decimal), not ISO 4217: Stripe keeps ISK
 * and UGX at two decimals for backwards compatibility (see "Special cases"), so Intl's digit counts would
 * mis-scale them and UGX is left out here even though Stripe's zero-decimal table lists it
 */
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const STRIPE_THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

function getStripeMinorUnitDivisor(currencyCode: string) {
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
    return 1;
  }
  if (STRIPE_THREE_DECIMAL_CURRENCIES.has(currencyCode)) {
    return 1000;
  }
  return 100;
}

/** Formats a Stripe amount, which is an integer in the currency's smallest unit */
export function formatCurrency(amountInMinorUnits: number | null, currency: string | null): string {
  if (amountInMinorUnits === null || !currency) {
    return EMPTY_VALUE;
  }
  const currencyCode = currency.toUpperCase();
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(
    amountInMinorUnits / getStripeMinorUnitDivisor(currencyCode),
  );
}

export function getStripeDashboardUrl(objectId: string): string {
  if (objectId.startsWith('cus_')) {
    return `https://dashboard.stripe.com/customers/${objectId}`;
  }
  if (objectId.startsWith('qt_')) {
    return `https://dashboard.stripe.com/quotes/${objectId}`;
  }
  if (objectId.startsWith('sub_')) {
    return `https://dashboard.stripe.com/subscriptions/${objectId}`;
  }
  if (objectId.startsWith('price_')) {
    return `https://dashboard.stripe.com/prices/${objectId}`;
  }
  return `https://dashboard.stripe.com/search?query=${encodeURIComponent(objectId)}`;
}

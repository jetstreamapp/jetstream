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

export function formatCurrency(amountInMinorUnits: number | null, currency: string | null): string {
  if (amountInMinorUnits === null || !currency) {
    return EMPTY_VALUE;
  }
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amountInMinorUnits / 100);
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

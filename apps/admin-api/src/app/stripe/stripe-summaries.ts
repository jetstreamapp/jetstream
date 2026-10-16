import {
  STRIPE_TEAM_LOOKUP_KEY_PREFIX,
  StripeCustomerSummary,
  StripeLineItemSummary,
  StripeQuoteSummary,
  StripeSubscriptionSummary,
} from '@jetstream/admin/types';
import type Stripe from 'stripe';

/** Statuses after which a subscription no longer holds the customer's plan (mirrors the main API) */
const ENDED_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired']);

export function isCurrentSubscription(subscription: Stripe.Subscription) {
  return !ENDED_SUBSCRIPTION_STATUSES.has(subscription.status);
}

function toIsoDate(epochSeconds: number | null | undefined) {
  return epochSeconds ? new Date(epochSeconds * 1000).toISOString() : null;
}

export function summarizeLineItem(price: Stripe.Price | null, quantity: number | null | undefined, description?: string | null) {
  const lookupKey = price?.lookup_key ?? null;
  const summary: StripeLineItemSummary = {
    description: description ?? price?.nickname ?? null,
    priceId: price?.id ?? null,
    lookupKey,
    quantity: quantity ?? null,
    isTeamPrice: !!lookupKey?.startsWith(STRIPE_TEAM_LOOKUP_KEY_PREFIX),
  };
  return summary;
}

export function summarizeCustomer(customer: Stripe.Customer): StripeCustomerSummary {
  return {
    id: customer.id,
    name: customer.name ?? null,
    email: customer.email ?? null,
    createdAt: new Date(customer.created * 1000).toISOString(),
    metadata: customer.metadata ?? {},
    productionOrgId: customer.metadata?.productionOrgId || null,
    livemode: customer.livemode,
  };
}

export function summarizeQuote(quote: Stripe.Quote, lineItems: Stripe.LineItem[]): StripeQuoteSummary {
  const lineItemSummaries = lineItems.map(({ price, quantity, description }) => summarizeLineItem(price, quantity, description));
  const teamLineItems = lineItemSummaries.filter(({ isTeamPrice }) => isTeamPrice);
  return {
    id: quote.id,
    number: quote.number ?? null,
    status: quote.status,
    customerId: typeof quote.customer === 'string' ? quote.customer : (quote.customer?.id ?? null),
    amountTotal: quote.amount_total ?? null,
    currency: quote.currency ?? null,
    expiresAt: toIsoDate(quote.expires_at),
    lineItems: lineItemSummaries,
    teamSeatQuantity: teamLineItems.length === 1 ? teamLineItems[0].quantity : null,
  };
}

export function summarizeSubscription(subscription: Stripe.Subscription): StripeSubscriptionSummary {
  return {
    id: subscription.id,
    status: subscription.status,
    items: subscription.items.data.map(({ price, quantity }) => summarizeLineItem(price, quantity)),
  };
}

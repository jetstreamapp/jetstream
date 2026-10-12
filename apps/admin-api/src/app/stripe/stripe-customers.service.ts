import { STRIPE_CUSTOMER_ID_PATTERN, STRIPE_QUOTE_ID_PATTERN, StripeCustomerSummary } from '@jetstream/admin/types';
import Stripe from 'stripe';
import { isCurrentSubscription, summarizeCustomer, summarizeQuote } from './stripe-summaries';
import { getStripe } from './stripe.client';

const QUOTE_LOOKUP_LIMIT = 10;

function isMissingResourceError(ex: unknown) {
  return ex instanceof Stripe.errors.StripeInvalidRequestError && ex.code === 'resource_missing';
}

/** Stripe search query strings quote values with single quotes, escaped with a backslash */
function escapeSearchValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Finds customers by `cus_` id, by the customer on a `qt_` quote, or by Stripe search on email
 * and name. Deleted customers are left out.
 */
export async function searchStripeCustomers(query: string): Promise<StripeCustomerSummary[]> {
  try {
    if (STRIPE_CUSTOMER_ID_PATTERN.test(query)) {
      const customer = await getStripe().customers.retrieve(query);
      return customer.deleted ? [] : [summarizeCustomer(customer)];
    }
    if (STRIPE_QUOTE_ID_PATTERN.test(query)) {
      const quote = await getStripe().quotes.retrieve(query, { expand: ['customer'] });
      const customer = quote.customer;
      return customer && typeof customer !== 'string' && !customer.deleted ? [summarizeCustomer(customer)] : [];
    }
  } catch (ex) {
    if (isMissingResourceError(ex)) {
      return [];
    }
    throw ex;
  }

  const searchValue = escapeSearchValue(query);
  const { data } = await getStripe().customers.search({ query: `email~'${searchValue}' OR name~'${searchValue}'`, limit: 25 });
  return data.map(summarizeCustomer);
}

/** Everything provisioning needs to know about a customer: the customer, its recent quotes and current subscriptions */
export async function getStripeCustomerContext(customerId: string, quoteId?: string) {
  const [customer, quoteList, subscriptionList] = await Promise.all([
    getStripe().customers.retrieve(customerId),
    getStripe().quotes.list({ customer: customerId, limit: QUOTE_LOOKUP_LIMIT }),
    getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 }),
  ]);

  const quotesToSummarize = quoteList.data.filter(({ status, id }) => status !== 'canceled' || id === quoteId);
  // A quote that belongs to a different customer still has to be loaded so the mismatch can be reported
  if (quoteId && !quotesToSummarize.some(({ id }) => id === quoteId)) {
    quotesToSummarize.unshift(await getStripe().quotes.retrieve(quoteId));
  }

  const quotes = await Promise.all(
    quotesToSummarize.map(async (quote) => {
      const lineItems = await getStripe().quotes.listLineItems(quote.id, { limit: 100 });
      return summarizeQuote(quote, lineItems.data);
    }),
  );

  return {
    customer,
    quotes,
    subscriptions: subscriptionList.data.filter(isCurrentSubscription),
  };
}

export async function listCurrentSubscriptions(customerId: string) {
  const { data } = await getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return data.filter(isCurrentSubscription);
}

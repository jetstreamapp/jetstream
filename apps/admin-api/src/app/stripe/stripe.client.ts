import { ENV } from '@jetstream/api-config';
import { STRIPE_API_VERSION } from '@jetstream/types';
import Stripe from 'stripe';
import { AdminHttpError } from '../utils/route.utils';

let stripeClient: Stripe | undefined;

/**
 * Use a restricted key in production: Customers write, Subscriptions write, Quotes read, Prices read.
 * Created on first use so the app still boots without a key; Stripe-backed routes then return 503.
 */
export function getStripe(): Stripe {
  if (!ENV.STRIPE_API_KEY) {
    throw new AdminHttpError(503, 'Stripe is not configured. Set STRIPE_API_KEY.');
  }
  stripeClient ??= new Stripe(ENV.STRIPE_API_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

import { ENV } from '@jetstream/api-config';
import { STRIPE_API_VERSION } from '@jetstream/types';
import Stripe from 'stripe';

/** The one Stripe client; an empty object when no key is configured so importing never throws. */
export const stripe: Stripe = ENV.STRIPE_API_KEY ? new Stripe(ENV.STRIPE_API_KEY, { apiVersion: STRIPE_API_VERSION }) : ({} as Stripe);

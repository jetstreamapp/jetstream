import type Stripe from 'stripe';
import { z } from 'zod';

export const EntitlementsAccessSchema = z.object({
  googleDrive: z.boolean().optional().prefault(false),
  desktop: z.boolean().optional().prefault(false),
  recordSync: z.boolean().optional().prefault(false),
  chromeExtension: z.boolean().optional().prefault(false),
});
export type EntitlementsAccess = z.infer<typeof EntitlementsAccessSchema>;
export type Entitlements = keyof EntitlementsAccess;

export interface StripeUserFacingCustomer {
  id: string;
  balance: number;
  delinquent: boolean;
  subscriptions: StripeUserFacingSubscription[];
}

export interface StripeUserFacingSubscription {
  id: string;
  billingCycleAnchor: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  startDate: string;
  status: Uppercase<Stripe.Subscription.Status>;
  items: StripeUserFacingSubscriptionItem[];
}

export interface StripeUserFacingSubscriptionItem {
  id: string;
  priceId: string;
  active: boolean;
  // TODO: if we want these we can add in after stripe v18 upgrade
  // currentPeriodStart: string;
  // currentPeriodEnd: string;
  product: string;
  lookupKey: string | null;
  unitAmount: number;
  recurringInterval: 'DAY' | 'MONTH' | 'WEEK' | 'YEAR' | null;
  recurringIntervalCount: number | null;
  quantity: number;
}

export interface JetstreamPrice {
  id: string;
  billingScheme: Stripe.Price.BillingScheme;
  lookupKey: string;
  interval: string;
  amount: number | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    images: string[];
  };
  tiersMode: Stripe.Price.TiersMode | null;
  tiers: JetstreamPriceTier[] | null;
}

export type JetstreamPriceTier =
  | {
      flatAmount: number;
      unitAmount: null;
      upTo: number | null;
    }
  | {
      flatAmount: null;
      unitAmount: number;
      upTo: number | null;
    };

export interface JetstreamPriceByKey {
  TEAM_ANNUAL: JetstreamPrice;
  TEAM_MONTHLY: JetstreamPrice;
  PRO_ANNUAL_250: JetstreamPrice;
  PRO_MONTHLY_25: JetstreamPrice;
}

export const STRIPE_PRICE_KEYS = ['TEAM_ANNUAL', 'TEAM_MONTHLY', 'PRO_ANNUAL', 'PRO_MONTHLY'] as const;
export type StripePriceKey = (typeof STRIPE_PRICE_KEYS)[number];

export type JetstreamPricesByLookupKey = { [key in StripePriceKey]: JetstreamPrice };

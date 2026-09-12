import type Stripe from 'stripe';
import { z } from 'zod';
import { MAX_TEAM_SEATS } from './team.types';

export const EntitlementsAccessSchema = z.object({
  googleDrive: z.boolean().optional().default(false),
  desktop: z.boolean().optional().default(false),
  recordSync: z.boolean().optional().default(false),
  chromeExtension: z.boolean().optional().default(false),
  analysisTools: z.boolean().optional().default(false),
  salesforceCanvas: z.boolean().optional().default(false),
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
  /** True when a coupon/promotion is active on the subscription or customer — displayed amounts are pre-discount list prices */
  hasDiscount: boolean;
  items: StripeUserFacingSubscriptionItem[];
}

export interface StripeUserFacingSubscriptionItem {
  id: string;
  priceId: string;
  active: boolean;
  /**
   * Mirrors Stripe's item-level `current_period_start` / `current_period_end`. Stripe moved the billing
   * period off the subscription and onto each subscription item, so a subscription with items on
   * different schedules reports a period per item rather than one for the whole subscription.
   */
  currentPeriodStart: string;
  currentPeriodEnd: string;
  product: string;
  lookupKey: string | null;
  /** In dollars — already converted from Stripe's cents. Always 0 for tiered prices, which carry their amounts in `tiers`. */
  unitAmount: number;
  billingScheme: Stripe.Price.BillingScheme;
  tiersMode: Stripe.Price.TiersMode | null;
  /**
   * Tier table for tiered prices, in dollars. Stripe omits `tiers` from the price embedded in a
   * subscription item, so the API fetches it separately. Null for per-unit prices, or when that
   * fetch failed, in which case the client cannot derive what the customer pays.
   */
  tiers: JetstreamPriceTier[] | null;
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

/**
 * A Stripe price tier in dollars. Stripe allows a tier to carry a flat amount, a per-unit amount,
 * or both (e.g. legacy Team pricing: a flat amount that includes the first N seats).
 */
export interface JetstreamPriceTier {
  flatAmount: number | null;
  unitAmount: number | null;
  /** Inclusive upper bound of the tier; null for the final, unbounded tier */
  upTo: number | null;
}

export interface JetstreamPriceByKey {
  TEAM_ANNUAL: JetstreamPrice;
  TEAM_MONTHLY: JetstreamPrice;
  PRO_ANNUAL_250: JetstreamPrice;
  PRO_MONTHLY_25: JetstreamPrice;
}

export const STRIPE_PRICE_KEYS = ['TEAM_ANNUAL', 'TEAM_MONTHLY', 'PRO_ANNUAL', 'PRO_MONTHLY'] as const;
export type StripePriceKey = (typeof STRIPE_PRICE_KEYS)[number];

export const CheckoutSessionRequestSchema = z.object({
  priceLookupKey: z.enum(STRIPE_PRICE_KEYS),
  /** Required for team prices; ignored for individual plans */
  seats: z.number().int().min(1).max(MAX_TEAM_SEATS).optional(),
  /** Only applied when the checkout creates a new team */
  teamName: z.string().trim().min(1).max(255).optional(),
});
export type CheckoutSessionRequest = z.infer<typeof CheckoutSessionRequestSchema>;

export type JetstreamPricesByLookupKey = { [key in StripePriceKey]: JetstreamPrice };

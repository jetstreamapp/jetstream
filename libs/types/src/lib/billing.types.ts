import type Stripe from 'stripe';
import { z } from 'zod';

export const EntitlementsAccessSchema = z.object({
  googleDrive: z.boolean().optional().default(false),
  desktop: z.boolean().optional().default(false),
  recordSync: z.boolean().optional().default(false),
  chromeExtension: z.boolean().optional().default(false),
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
  currentPeriodEnd: string;
  currentPeriodStart: string;
  endedAt: string | null;
  startDate: string;
  status: Uppercase<Stripe.Subscription.Status>;
  items: StripeUserFacingSubscriptionItem[];
}

export interface StripeUserFacingSubscriptionItem {
  id: string;
  priceId: string;
  active: boolean;
  product: string;
  lookupKey: string | null;
  unitAmount: number;
  recurringInterval: 'DAY' | 'MONTH' | 'WEEK' | 'YEAR' | null;
  recurringIntervalCount: number | null;
  quantity: number;
}

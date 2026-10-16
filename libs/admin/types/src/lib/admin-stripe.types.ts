import { SALESFORCE_ORG_ID_REGEX } from '@jetstream/types';
import { z } from 'zod';

export const STRIPE_CUSTOMER_ID_PATTERN = /^cus_[A-Za-z0-9]+$/;
export const STRIPE_QUOTE_ID_PATTERN = /^qt_[A-Za-z0-9]+$/;

/** Team prices are identified by lookup key, the same way the main API recognizes them */
export const STRIPE_TEAM_LOOKUP_KEY_PREFIX = 'TEAM_';

export const StripeCustomerSearchQuerySchema = z.object({
  /** An email, a name fragment, a `cus_` id or a `qt_` id */
  query: z.string().trim().min(2).max(255),
});

export const StripeCustomerParamsSchema = z.object({
  customerId: z.string().regex(STRIPE_CUSTOMER_ID_PATTERN),
});

export const ProvisioningLookupParamsSchema = StripeCustomerParamsSchema;

export const UpdateStripeCustomerProductionOrgIdRequestSchema = z.object({
  /** The customer's Salesforce production org id; null or blank clears it */
  productionOrgId: z
    .string()
    .trim()
    .nullable()
    .transform((value) => value || null)
    .pipe(z.string().regex(SALESFORCE_ORG_ID_REGEX, 'Enter a Salesforce org id: 15 or 18 characters starting with 00D').nullable()),
});
export type UpdateStripeCustomerProductionOrgIdRequest = z.infer<typeof UpdateStripeCustomerProductionOrgIdRequestSchema>;

export const ProvisioningLookupQuerySchema = z.object({
  quoteId: z.string().regex(STRIPE_QUOTE_ID_PATTERN).optional(),
});

export interface StripeCustomerSummary {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  metadata: Record<string, string>;
  /** `metadata.productionOrgId`, collected at Checkout or set from the admin app */
  productionOrgId: string | null;
  livemode: boolean;
}

export interface StripeLineItemSummary {
  description: string | null;
  priceId: string | null;
  lookupKey: string | null;
  quantity: number | null;
  isTeamPrice: boolean;
}

export interface StripeQuoteSummary {
  id: string;
  number: string | null;
  status: string;
  customerId: string | null;
  amountTotal: number | null;
  currency: string | null;
  expiresAt: string | null;
  lineItems: StripeLineItemSummary[];
  /** Quantity of the single TEAM_ line item, or null when there is not exactly one */
  teamSeatQuantity: number | null;
}

export interface StripeSubscriptionSummary {
  id: string;
  status: string;
  items: StripeLineItemSummary[];
}

export const ProvisioningCheckCodeSchema = z.enum([
  /** TeamBillingAccount.customerId already points at this customer */
  'CUSTOMER_LINKED_TO_TEAM',
  /** BillingAccount.customerId (a user's personal billing) already points at this customer */
  'CUSTOMER_LINKED_TO_USER',
  /** Customer metadata already names a team */
  'CUSTOMER_METADATA_HAS_TEAM',
  /** Customer metadata names a user; harmless once the team is linked but worth knowing */
  'CUSTOMER_METADATA_HAS_USER',
  /** Customer already has an active subscription with a TEAM_ price */
  'CUSTOMER_HAS_TEAM_SUBSCRIPTION',
  /** Seat sync requires exactly one TEAM_ line item */
  'QUOTE_TEAM_LINE_ITEM_COUNT',
  'QUOTE_NOT_FOR_CUSTOMER',
  'QUOTE_STATUS',
  'CUSTOMER_DELETED',
]);
export type ProvisioningCheckCode = z.infer<typeof ProvisioningCheckCodeSchema>;

export interface ProvisioningCheck {
  code: ProvisioningCheckCode;
  /** BLOCKER checks stop provisioning; WARNING checks are shown but allowed */
  severity: 'BLOCKER' | 'WARNING';
  message: string;
  teamId?: string;
  userId?: string;
}

export interface ProvisioningLookupResult {
  customer: StripeCustomerSummary;
  quotes: StripeQuoteSummary[];
  /** The quote the quote checks were evaluated against */
  selectedQuoteId: string | null;
  subscriptions: StripeSubscriptionSummary[];
  checks: ProvisioningCheck[];
  suggestedTeamName: string;
}

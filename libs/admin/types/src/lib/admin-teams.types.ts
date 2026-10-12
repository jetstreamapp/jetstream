import { TeamMemberRoleSchema } from '@jetstream/types';
import { z } from 'zod';
import { AuditLogItem, EntitlementFlags, EntitlementFlagsSchema, SubscriptionItem } from './admin-common.types';
import { STRIPE_CUSTOMER_ID_PATTERN, STRIPE_QUOTE_ID_PATTERN } from './admin-stripe.types';

export interface TeamListItem {
  id: string;
  name: string;
  status: string;
  billingStatus: string;
  createdAt: string;
  memberCount: number;
  customerId: string | null;
  manualBilling: boolean;
  licenseCountLimit: number | null;
}

export interface TeamSeatUsage {
  /** Active ADMIN and MEMBER rows */
  used: number;
  /** Unexpired invitations for billable roles */
  reserved: number;
  /** null means uncapped */
  limit: number | null;
}

export interface TeamMemberItem {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoggedIn: string | null;
  createdAt: string;
}

export interface TeamInvitationItem {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  lastSentAt: string;
  createdAt: string;
}

export interface TeamBillingAccountItem {
  customerId: string;
  manualBilling: boolean;
  licenseCountLimit: number | null;
  seatQuantity: number | null;
  includedSeats: number;
  seatPeriodEnd: string | null;
  pendingSeatQuantity: number | null;
  pendingSeatEffectiveAt: string | null;
}

export interface TeamLoginConfigItem {
  domains: string[];
  requireMfa: boolean;
  ssoProvider: string;
  ssoEnabled: boolean;
  autoAddToTeam: boolean;
}

export interface TeamDetail {
  id: string;
  name: string;
  status: string;
  billingStatus: string;
  createdAt: string;
  updatedAt: string;
  billingAccount: TeamBillingAccountItem | null;
  subscriptions: SubscriptionItem[];
  entitlements: EntitlementFlags | null;
  seats: TeamSeatUsage;
  members: TeamMemberItem[];
  invitations: TeamInvitationItem[];
  loginConfig: TeamLoginConfigItem | null;
  auditLogs: AuditLogItem[];
}

export const TeamBillingModeSchema = z.enum(['STRIPE', 'MANUAL']);
export type TeamBillingMode = z.infer<typeof TeamBillingModeSchema>;

export const ProvisionTeamRequestSchema = z
  .object({
    customerId: z.string().regex(STRIPE_CUSTOMER_ID_PATTERN),
    quoteId: z.string().regex(STRIPE_QUOTE_ID_PATTERN).nullish(),
    name: z.string().trim().min(1).max(255),
    billingMode: TeamBillingModeSchema,
    /** Seat cap. Optional for Stripe billing (sync overwrites it), required for manual billing */
    licenseCountLimit: z.number().int().min(1).max(100_000).nullish(),
    /** Only used for manual billing; Stripe-billed teams get entitlements from the subscription */
    entitlements: EntitlementFlagsSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.billingMode === 'MANUAL' && !value.licenseCountLimit) {
      ctx.addIssue({ code: 'custom', path: ['licenseCountLimit'], message: 'Manual billing requires a seat limit' });
    }
    if (value.billingMode === 'STRIPE' && value.entitlements) {
      ctx.addIssue({ code: 'custom', path: ['entitlements'], message: 'Stripe-billed teams get entitlements from their subscription' });
    }
  });
export type ProvisionTeamRequest = z.infer<typeof ProvisionTeamRequestSchema>;

export interface StripeLinkResult {
  customerMetadataUpdated: boolean;
  /** Subscriptions whose metadata was re-saved so Stripe sends `customer.subscription.updated` to the main API */
  subscriptionsNudged: string[];
  error: string | null;
}

export interface ProvisionTeamResponse {
  teamId: string;
  stripe: StripeLinkResult;
}

export const SendTeamInvitationRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).pipe(z.email()),
  role: TeamMemberRoleSchema.default('ADMIN'),
});
export type SendTeamInvitationRequest = z.infer<typeof SendTeamInvitationRequestSchema>;

export const TeamInvitationParamsSchema = z.object({
  id: z.guid(),
  invitationId: z.guid(),
});

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

export interface TeamDomainItem {
  id: string;
  domain: string;
  /** PENDING or VERIFIED */
  status: string;
  verifiedAt: string | null;
  createdAt: string;
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
  domains: TeamDomainItem[];
  auditLogs: AuditLogItem[];
}

/**
 * How the team's seat limit is managed. Both are invoiced through Stripe.
 * SUBSCRIPTION: the limit follows the Stripe subscription quantity and team admins can change seats.
 * FIXED: an agreed number of seats (TeamBillingAccount.manualBilling). The admin sets the limit, team admins
 * cannot change it, Stripe sync never touches it, and the team's billing status stays MANUAL.
 */
export const TeamSeatModeSchema = z.enum(['SUBSCRIPTION', 'FIXED']);
export type TeamSeatMode = z.infer<typeof TeamSeatModeSchema>;

export const TeamMemberToAddSchema = z.object({
  userId: z.guid(),
  role: TeamMemberRoleSchema,
});
export type TeamMemberToAdd = z.infer<typeof TeamMemberToAddSchema>;

export const ProvisionTeamRequestSchema = z
  .object({
    customerId: z.string().regex(STRIPE_CUSTOMER_ID_PATTERN),
    quoteId: z.string().regex(STRIPE_QUOTE_ID_PATTERN).nullish(),
    name: z.string().trim().min(1).max(255),
    seatMode: TeamSeatModeSchema,
    /** Seat cap. Optional for SUBSCRIPTION (sync replaces it), required for FIXED */
    licenseCountLimit: z.number().int().min(1).max(100_000).nullish(),
    /** FIXED only: access until the subscription starts, after which Stripe's entitlements replace these */
    entitlements: EntitlementFlagsSchema.nullish(),
    /** Existing users added straight to the team, without an invitation or email */
    members: z.array(TeamMemberToAddSchema).max(100).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.seatMode === 'FIXED' && !value.licenseCountLimit) {
      ctx.addIssue({ code: 'custom', path: ['licenseCountLimit'], message: 'Fixed seats need a seat limit' });
    }
    if (value.seatMode === 'SUBSCRIPTION' && value.entitlements) {
      ctx.addIssue({ code: 'custom', path: ['entitlements'], message: 'Subscription teams get entitlements from Stripe' });
    }
    const userIds = value.members.map(({ userId }) => userId);
    if (new Set(userIds).size !== userIds.length) {
      ctx.addIssue({ code: 'custom', path: ['members'], message: 'A user can only be added once' });
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

export const ApproveTeamDomainRequestSchema = z.object({
  domain: z.string().trim().toLowerCase().max(255).regex(z.regexes.domain, 'Enter a domain such as example.com'),
});
export type ApproveTeamDomainRequest = z.infer<typeof ApproveTeamDomainRequestSchema>;

export const TeamInvitationParamsSchema = z.object({
  id: z.guid(),
  invitationId: z.guid(),
});

import { z } from 'zod';
import { AuditLogItem, EntitlementFlags, PaginatedSearchQuerySchema, SortDirectionSchema, SubscriptionItem } from './admin-common.types';

/**
 * TEAM: an active member of an active team, whatever the team's billing status.
 * PRO: has an active or trialing personal subscription.
 * FREE: neither. A user can be both TEAM and PRO, so they show up under both filters.
 */
export const UserPlanFilterSchema = z.enum(['TEAM', 'PRO', 'FREE']);
export type UserPlanFilter = z.infer<typeof UserPlanFilterSchema>;

export const UserSortFieldSchema = z.enum(['createdAt', 'lastLoggedIn']);
export type UserSortField = z.infer<typeof UserSortFieldSchema>;

export const UserListQuerySchema = PaginatedSearchQuerySchema.extend({
  plan: UserPlanFilterSchema.optional(),
  sort: UserSortFieldSchema.default('createdAt'),
  direction: SortDirectionSchema.default('desc'),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoggedIn: string | null;
  lockedUntil: string | null;
  teamId: string | null;
  teamName: string | null;
  teamRole: string | null;
  /** Team plan access: the membership and the team are both active */
  isActiveTeamMember: boolean;
  /** ACTIVE, PAST_DUE or MANUAL; null without a team */
  teamBillingStatus: string | null;
  hasPersonalSubscription: boolean;
}

export interface UserIdentityItem {
  provider: string;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface UserTeamMembershipItem {
  teamId: string;
  teamName: string;
  role: string;
  status: string;
}

export interface UserWebSessionItem {
  createdAt: string | null;
  expiresAt: string;
  provider: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  loginTime: string | null;
}

export interface UserExternalSessionItem {
  id: string;
  source: string;
  platform: string | null;
  appVersion: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface UserLoginActivityItem {
  id: number;
  action: string;
  method: string | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoggedIn: string | null;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  forcePasswordReset: boolean;
  hasPasswordSet: boolean;
  identities: UserIdentityItem[];
  authFactors: { type: string; enabled: boolean }[];
  teamMembership: UserTeamMembershipItem | null;
  billingAccount: { customerId: string; manualBilling: boolean } | null;
  subscriptions: SubscriptionItem[];
  entitlements: EntitlementFlags | null;
  salesforceOrgCount: number;
  webSessions: UserWebSessionItem[];
  externalSessions: UserExternalSessionItem[];
  loginActivity: UserLoginActivityItem[];
  auditLogs: AuditLogItem[];
}

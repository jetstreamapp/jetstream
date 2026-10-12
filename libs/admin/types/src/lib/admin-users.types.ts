import { AuditLogItem, EntitlementFlags, SubscriptionItem } from './admin-common.types';

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
  hasActiveSubscription: boolean;
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

import { z } from 'zod';

export type TeamGlobalAction = 'view-auth-activity' | 'view-user-sessions' | 'team-member-invite';
export type TeamUserAction = 'deactivate' | 'reactivate' | 'edit';
export type TeamInvitationAction = 'cancel-invite' | 'resend-invite';

export interface TeamMemberTableAction {
  type: 'MEMBER';
  member: TeamUserFacing['members'][number];
  action: TeamUserAction;
}
export interface TeamInvitationTableAction {
  type: 'INVITATION';
  invitation: TeamUserFacing['invitations'][number];
  action: TeamInvitationAction;
}
export type TeamTableAction = TeamMemberTableAction | TeamInvitationTableAction;

export const FeatureSchema = z.enum([
  'ALL',
  'QUERY',
  'UPDATE_RECORDS',
  'AUTOMATION_CONTROL',
  'PERMISSION_MANAGER',
  'DEPLOYMENT',
  'DEVELOPER_TOOLS',
]);
export const TEAM_MEMBER_ROLE_ADMIN = 'ADMIN';
export const TEAM_MEMBER_ROLE_BILLING = 'BILLING';
export const TEAM_MEMBER_ROLE_MEMBER = 'MEMBER';
export const TeamMemberRoleSchema = z.enum([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING, TEAM_MEMBER_ROLE_MEMBER]);
export const BILLABLE_ROLES = new Set([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_MEMBER]);

export const TEAM_STATUS_ACTIVE = 'ACTIVE';
export const TEAM_STATUS_INACTIVE = 'INACTIVE';
export const TeamStatusSchema = z.enum([TEAM_STATUS_ACTIVE, TEAM_STATUS_INACTIVE]);

// has active subscriptions and none are past due
export const TEAM_BILLING_STATUS_ACTIVE = 'ACTIVE';
// has no active subscriptions or any are past due
export const TEAM_BILLING_STATUS_PAST_DUE = 'PAST_DUE';
// manual billing is enabled (subscription state is ignored)
export const TEAM_BILLING_STATUS_MANUAL = 'MANUAL';
export const TeamBillingStatusSchema = z.enum([TEAM_BILLING_STATUS_ACTIVE, TEAM_BILLING_STATUS_PAST_DUE, TEAM_BILLING_STATUS_MANUAL]);

export const TEAM_MEMBER_STATUS_ACTIVE = 'ACTIVE';
export const TEAM_MEMBER_STATUS_INACTIVE = 'INACTIVE';
export const TeamMemberStatusSchema = z.enum([TEAM_MEMBER_STATUS_ACTIVE, TEAM_MEMBER_STATUS_INACTIVE]);

const DateStringSchema = z.union([z.string(), z.date()]).transform((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
});

export const TeamUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  lastLoggedIn: DateStringSchema.nullable(),
  emailVerified: z.boolean(),
  passwordUpdatedAt: DateStringSchema.nullable(),
  hasPasswordSet: z.boolean(),
  authFactors: z
    .object({
      enabled: z.boolean(),
      type: z.string(),
    })
    .array(),
  identities: z
    .object({
      email: z.string(),
      username: z.string(),
      provider: z.string(),
      isPrimary: z.boolean(),
      type: z.string(),
    })
    .array(),
});

export const TeamOrgSchema = z.object({
  uniqueId: z.string(),
  displayName: z.string(),
  instanceUrl: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  username: z.string(),
  jetstreamUserId2: z.string(),
});

export const TeamMemberSchema = z.object({
  userId: z.string(),
  role: TeamMemberRoleSchema,
  status: TeamMemberStatusSchema,
  features: FeatureSchema.array(),
  user: TeamUserSchema,
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const TeamEntitlementSchema = z.object({
  chromeExtension: z.boolean().optional().prefault(false),
  googleDrive: z.boolean().optional().prefault(false),
  desktop: z.boolean().optional().prefault(false),
  recordSync: z.boolean().optional().prefault(false),
});

export const TeamLoginConfigSchema = z.object({
  allowedMfaMethods: z.enum(['otp', 'email']).array().optional().prefault(['email', 'otp']),
  allowedProviders: z.enum(['credentials', 'google', 'salesforce']).array().optional().prefault(['credentials', 'google', 'salesforce']),
  allowIdentityLinking: z.boolean().optional().prefault(true),
  domains: z.string().toLowerCase().array().optional().prefault([]),
  requireMfa: z.boolean().optional().prefault(false),
  autoAddToTeam: z.boolean().optional().prefault(false),
});
export const TeamLoginConfigRequestSchema = TeamLoginConfigSchema;

export const LoginConfigurationMdaDisplayNames: Record<TeamLoginConfigRequest['allowedMfaMethods'][number], string> = {
  otp: 'Authenticator App',
  email: 'Email',
};

export const LoginConfigurationIdentityDisplayNames: Record<TeamLoginConfigRequest['allowedProviders'][number], string> = {
  credentials: 'Username + Password',
  google: 'Google',
  salesforce: 'Salesforce',
};

export const TeamSubscriptionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  customerId: z.string(),
  productId: z.string().nullish(),
  subscriptionId: z.string(),
  priceId: z.string(),
  status: z.enum(['ACTIVE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'PAUSED', 'TRIALING', 'UNPAID']),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const TeamInviteUserFacingSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: TeamMemberRoleSchema,
  features: FeatureSchema.array(),
  expiresAt: DateStringSchema,
  lastSentAt: DateStringSchema,
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const TeamUserFacingSchema = z.object({
  id: z.string(),
  name: z.string().max(255).min(1),
  status: TeamStatusSchema,
  billingStatus: TeamBillingStatusSchema,
  loginConfigId: z.string().nullable(),
  sharedOrgs: TeamOrgSchema.array(),
  members: TeamMemberSchema.array(),
  invitations: TeamInviteUserFacingSchema.array(),
  loginConfig: TeamLoginConfigSchema.nullable(),
  billingAccount: z
    .object({
      customerId: z.string(),
      manualBilling: z.boolean(),
      licenseCountLimit: z.number().min(0).nullable().prefault(null),
    })
    .nullable(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const TeamInvitationRequestSchema = z.object({
  email: z.email().toLowerCase(),
  role: TeamMemberRoleSchema.optional().prefault('MEMBER'),
  features: FeatureSchema.array().optional().prefault(['ALL']),
});
export type TeamInvitationRequest = z.infer<typeof TeamInvitationRequestSchema>;

export const TeamInvitationUpdateRequestSchema = z.object({
  role: TeamMemberRoleSchema.optional(),
  features: FeatureSchema.array().optional(),
});
export type TeamInvitationUpdateRequest = z.infer<typeof TeamInvitationUpdateRequestSchema>;

export const TeamMemberUpdateRequestSchema = z.object({
  role: TeamMemberRoleSchema.optional(),
  features: FeatureSchema.array().optional(),
});
export type TeamMemberUpdateRequest = z.infer<typeof TeamMemberUpdateRequestSchema>;

export const TeamMemberStatusUpdateRequestSchema = z.object({
  role: TeamMemberRoleSchema.nullish(),
  status: z.enum([TEAM_MEMBER_STATUS_ACTIVE, TEAM_MEMBER_STATUS_INACTIVE]),
});
export type TeamMemberStatusUpdateRequest = z.infer<typeof TeamMemberStatusUpdateRequestSchema>;

export interface TeamInviteVerificationResponse {
  teamName: string;
  canEnroll: boolean;
  session: {
    expireOnAcceptance: boolean;
    action: string;
    message: string | null;
  };
  mfa: {
    isValid: boolean;
    action: string;
    message: string | null;
    allowedMethods: TeamLoginConfig['allowedMfaMethods'];
  };
  identityProvider: {
    isValid: boolean;
    action: string;
    message: string | null;
    allowedProviders: TeamLoginConfig['allowedProviders'];
  };
  linkedIdentities: {
    isValid: boolean;
    action: string;
    message: string | null;
  };
}

export type Feature = z.infer<typeof FeatureSchema>;
export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;
export type TeamStatus = z.infer<typeof TeamStatusSchema>;
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;
export type TeamBillingStatus = z.infer<typeof TeamBillingStatusSchema>;

export type TeamUser = z.infer<typeof TeamUserSchema>;
export type TeamOrg = z.infer<typeof TeamOrgSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamEntitlement = z.infer<typeof TeamEntitlementSchema>;
export type TeamLoginConfig = z.infer<typeof TeamLoginConfigSchema>;
export type TeamLoginConfigRequest = z.infer<typeof TeamLoginConfigRequestSchema>;
export type TeamUserFacing = z.infer<typeof TeamUserFacingSchema>;
export type TeamSubscription = z.infer<typeof TeamSubscriptionSchema>;
export type TeamInviteUserFacing = z.infer<typeof TeamInviteUserFacingSchema>;

export type VerifyInvitationResponse = { success: true; inviteVerification: TeamInviteVerificationResponse } | { success: false };

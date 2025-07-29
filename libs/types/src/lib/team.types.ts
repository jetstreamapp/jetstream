import { z } from 'zod';

export type TeamGlobalAction = 'view-auth-activity' | 'view-user-sessions' | 'team-member-invite';
export type TeamUserAction = 'deactivate' | 'reactivate';
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
export const TEAM_ROLE_ADMIN = 'ADMIN';
export const TEAM_ROLE_BILLING = 'BILLING';
export const TEAM_ROLE_MEMBER = 'MEMBER';
export const TeamMemberRoleSchema = z.enum([TEAM_ROLE_ADMIN, TEAM_ROLE_BILLING, TEAM_ROLE_MEMBER]);

export const TEAM_STATUS_ACTIVE = 'ACTIVE';
export const TEAM_STATUS_INACTIVE = 'INACTIVE';
export const TeamMemberStatusSchema = z.enum([TEAM_STATUS_ACTIVE, TEAM_STATUS_INACTIVE]);

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

export const TeamLoginConfigSchema = z.object({
  allowedMfaMethods: z.enum(['otp', 'email']).array().optional().default(['email', 'otp']),
  allowedProviders: z.enum(['credentials', 'google', 'salesforce']).array().optional().default(['credentials', 'google', 'salesforce']),
  allowIdentityLinking: z.boolean().optional().default(true),
  domains: z.string().toLowerCase().array().optional().default([]),
  requireMfa: z.boolean().optional().default(false),
  autoAddToTeam: z.boolean().optional().default(false),
});
export const TeamLoginConfigRequestSchema = TeamLoginConfigSchema;

export const TeamInviteUserFacingSchema = z.object({
  id: z.string(),
  email: z.string().email(),
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
  loginConfigId: z.string().nullable(),
  sharedOrgs: TeamOrgSchema.array(),
  members: TeamMemberSchema.array(),
  invitations: TeamInviteUserFacingSchema.array(),
  loginConfig: TeamLoginConfigSchema.nullable(),
  teamBillingAccount: z
    .object({
      customerId: z.string(),
    })
    .nullable(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const TeamInvitationRequestSchema = z.object({
  email: z.string().toLowerCase().email(),
  role: TeamMemberRoleSchema.optional().default('MEMBER'),
  features: FeatureSchema.array().optional().default(['ALL']),
});
export type TeamInvitationRequest = z.infer<typeof TeamInvitationRequestSchema>;

export const TeamInvitationUpdateRequestSchema = z.object({
  role: TeamMemberRoleSchema.optional(),
  features: FeatureSchema.array().optional(),
});
export type TeamInvitationUpdateRequest = z.infer<typeof TeamInvitationUpdateRequestSchema>;

export type Feature = z.infer<typeof FeatureSchema>;
export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;

export type TeamUser = z.infer<typeof TeamUserSchema>;
export type TeamOrg = z.infer<typeof TeamOrgSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamLoginConfig = z.infer<typeof TeamLoginConfigSchema>;
export type TeamLoginConfigRequest = z.infer<typeof TeamLoginConfigRequestSchema>;
export type TeamUserFacing = z.infer<typeof TeamUserFacingSchema>;
export type TeamInviteUserFacing = z.infer<typeof TeamInviteUserFacingSchema>;

export type VerifyInvitationResponse = { success: true; teamName: string } | { success: false };

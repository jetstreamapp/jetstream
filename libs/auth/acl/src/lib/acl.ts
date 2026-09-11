import { AbilityBuilder, createMongoAbility, type CreateAbility, type MongoAbility } from '@casl/ability';
import {
  TeamBillingStatusSchema,
  TeamMemberRole,
  TeamMemberRoleSchema,
  TeamMemberStatusSchema,
  TeamUserFacing,
  type UserProfileUi,
} from '@jetstream/types';

type Actions = 'read' | 'update';
// TODO: granular app access
type Subjects = 'Billing' | 'CoreFunctionality' | 'Profile' | 'Settings';

type EntitlementActions = 'access';
type EntitlementSubjects = 'GoogleDrive' | 'ChromeExtension' | 'Desktop' | 'RecordSync' | 'AnalysisTools';

type TeamActions = 'read' | 'update';
type TeamSubjects = 'Team' | 'TeamMember' | { type: 'TeamMember'; role: TeamMemberRole };

type TeamMemberActions = 'invite';
type TeamMemberSubjects = 'TeamMember' | { type: 'TeamMember'; billingStatus: TeamUserFacing['billingStatus'] };

// 'update' rather than 'manage': CASL reserves 'manage' to mean every action, which would make a
// cannot('manage', ...) rule also revoke read access
type TeamSeatsActions = 'read' | 'update';
type TeamSeatsSubjects = 'TeamSeats' | { type: 'TeamSeats'; manualBilling: boolean; billingStatus: TeamUserFacing['billingStatus'] };

type TeamMemberSessionActions = 'read' | 'delete';
type TeamMemberSessionSubjects = 'TeamMemberSession';

type TeamMemberAuthActivityActions = 'read';
type TeamMemberAuthActivitySubjects = 'TeamMemberAuthActivity';

type DomainConfigurationActions = 'read' | 'update' | 'delete';
type DomainConfigurationSubjects = 'DomainConfiguration';

type SsoConfigurationActions = 'read' | 'update' | 'delete';
type SsoConfigurationSubjects = 'SsoConfiguration';

type AuditLogActions = 'read';
type AuditLogSubjects = 'AuditLog';

export type AppAbility = MongoAbility<
  | [Actions, Subjects]
  | [EntitlementActions, EntitlementSubjects]
  | [TeamActions, TeamSubjects]
  | [TeamMemberActions, TeamMemberSubjects]
  | [TeamSeatsActions, TeamSeatsSubjects]
  | [TeamMemberSessionActions, TeamMemberSessionSubjects]
  | [TeamMemberAuthActivityActions, TeamMemberAuthActivitySubjects]
  | [DomainConfigurationActions, DomainConfigurationSubjects]
  | [SsoConfigurationActions, SsoConfigurationSubjects]
  | [AuditLogActions, AuditLogSubjects]
>;

const createAppAbility = createMongoAbility as CreateAbility<AppAbility>;

type GetAbilityOptions = {
  user?: Pick<UserProfileUi, 'teamMembership' | 'entitlements'>;
  isBrowserExtension?: boolean;
  isCanvasApp?: boolean;
  isDesktop?: boolean;
};

/**
 * serializable CASL rules object
 *
 * @see https://casl.js.org/v6/en/guide/define-rules
 * @param options
 */
function getAbilityRules({ isBrowserExtension, isDesktop, isCanvasApp, user }: GetAbilityOptions) {
  const { can, cannot, rules } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    return rules;
  }

  const isWebApp = !isBrowserExtension && !isDesktop && !isCanvasApp;
  const activeTeamMembership = user.teamMembership?.status === TeamMemberStatusSchema.enum.ACTIVE;
  const isBillingRole = user.teamMembership?.role === TeamMemberRoleSchema.enum.BILLING;
  const isAdminRole = user.teamMembership?.role === TeamMemberRoleSchema.enum.ADMIN;
  const isTeamsBillingOrAdmin = isBillingRole || isAdminRole;

  // core settings, may be removed later
  can('read', ['CoreFunctionality', 'Settings']);
  can('update', 'Settings');

  // Billing role is "read-only", revert standard permissions
  if (isBillingRole) {
    cannot('read', ['CoreFunctionality', 'Settings']);
    cannot('update', 'Settings');
  }

  if (isWebApp) {
    can('read', 'Profile');

    if (!user.teamMembership || (activeTeamMembership && isTeamsBillingOrAdmin)) {
      can(['read', 'update'], 'Billing');
    }

    if (activeTeamMembership) {
      if (isTeamsBillingOrAdmin) {
        can(['read'], ['Team', 'TeamMemberSession', 'TeamMemberAuthActivity', 'TeamMember', 'DomainConfiguration', 'SsoConfiguration']);
        can('update', ['Team', 'TeamMember']);

        // Seat availability is enforced by the server and explained in the modals, so the invite
        // action itself only depends on role and billing standing
        can('invite', 'TeamMember');
        cannot('invite', 'TeamMember', { billingStatus: TeamBillingStatusSchema.enum.PAST_DUE });

        // Both roles can buy seats: the Billing role exists so finance can act on money
        can(['read', 'update'], 'TeamSeats');
        cannot('update', 'TeamSeats', { manualBilling: true });
        cannot('update', 'TeamSeats', { billingStatus: TeamBillingStatusSchema.enum.PAST_DUE });
      }
      if (isBillingRole) {
        cannot('update', 'TeamMember', { role: TeamMemberRoleSchema.enum.ADMIN });
      }
      if (isAdminRole) {
        can(['read'], 'AuditLog');
        can(['update', 'delete'], 'DomainConfiguration');
        can(['update', 'delete'], 'SsoConfiguration');
        can('delete', 'TeamMemberSession');
      }
    }
  } else if (isDesktop && activeTeamMembership) {
    if (isTeamsBillingOrAdmin) {
      can(['read'], ['Team']);
    }
  }

  if (user.entitlements.chromeExtension) {
    can('access', 'ChromeExtension');
  }
  if (user.entitlements.desktop) {
    can('access', 'Desktop');
  }
  // Desktop, extension, and canvas require paid tier, so they always get access to Google Drive
  if (user.entitlements.googleDrive || isBrowserExtension || isDesktop || isCanvasApp) {
    can('access', 'GoogleDrive');
  }
  // Desktop and extension require paid tier, so they always get access to record sync
  if (user.entitlements.recordSync || isBrowserExtension || isDesktop) {
    can('access', 'RecordSync');
  }
  // Analysis Tools (Field Usage + Permission Analysis) are paid-only; desktop/extension/canvas are paid tiers.
  if (user.entitlements.analysisTools || isBrowserExtension || isDesktop || isCanvasApp) {
    can('access', 'AnalysisTools');
  }

  return rules;
}

/**
 * "compiled" ability generated from a bag of options passed in where the options determine what
 * `can` be performed as an ability
 *
 * any asynchronous logic should be handled in the construction of the options
 *
 * @see https://casl.js.org/v6/en/guide/intro
 * @param options
 */
export function getUserAbility(options: GetAbilityOptions) {
  return createAppAbility(getAbilityRules(options), {
    detectSubjectType: (item) => {
      if (typeof item === 'object' && 'type' in item) {
        return item.type;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return item as any;
    },
  });
}

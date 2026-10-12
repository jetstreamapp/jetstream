import { AbilityBuilder, createMongoAbility, type CreateAbility, type MongoAbility } from '@casl/ability';
import {
  AccessProfileOperationKey,
  AccessProfilePolicy,
  AccessProfileToolKey,
  Maybe,
  TeamBillingStatusSchema,
  TeamMemberRole,
  TeamMemberRoleSchema,
  TeamMemberStatusSchema,
  TeamUserFacing,
  type UserProfileUi,
} from '@jetstream/types';

type Actions = 'read' | 'update';
type Subjects = 'Billing' | 'CoreFunctionality' | 'Profile' | 'Settings';

// Granular app access from the member's team access profile. These are UI guards, not a security boundary.
type ToolActions = 'access';
type ToolSubjects = 'Tool' | { type: 'Tool'; key: AccessProfileToolKey };

type OperationActions = 'perform';
type OperationSubjects = 'Operation' | { type: 'Operation'; key: AccessProfileOperationKey };

type EntitlementActions = 'access';
type EntitlementSubjects = 'GoogleDrive' | 'ChromeExtension' | 'Desktop' | 'RecordSync' | 'AnalysisTools';

type TeamActions = 'read' | 'update';
type TeamSubjects = 'Team' | 'TeamMember' | { type: 'TeamMember'; role: TeamMemberRole };

type TeamMemberActions = 'invite';
type TeamMemberSubjects = 'TeamMember' | { type: 'TeamMember'; billingStatus: TeamUserFacing['billingStatus'] };

// 'update' rather than 'manage': CASL reserves 'manage' to mean every action, which would make a
// cannot('manage', ...) rule also revoke read access
type TeamSeatsActions = 'read' | 'update';
type TeamSeatsSubjects = 'TeamSeats';

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

type TeamAccessProfileActions = 'read' | 'update';
type TeamAccessProfileSubjects = 'TeamAccessProfile';

export type AppAbility = MongoAbility<
  | [Actions, Subjects]
  | [ToolActions, ToolSubjects]
  | [OperationActions, OperationSubjects]
  | [EntitlementActions, EntitlementSubjects]
  | [TeamActions, TeamSubjects]
  | [TeamMemberActions, TeamMemberSubjects]
  | [TeamSeatsActions, TeamSeatsSubjects]
  | [TeamMemberSessionActions, TeamMemberSessionSubjects]
  | [TeamMemberAuthActivityActions, TeamMemberAuthActivitySubjects]
  | [DomainConfigurationActions, DomainConfigurationSubjects]
  | [SsoConfigurationActions, SsoConfigurationSubjects]
  | [AuditLogActions, AuditLogSubjects]
  | [TeamAccessProfileActions, TeamAccessProfileSubjects]
>;

const createAppAbility = createMongoAbility as CreateAbility<AppAbility>;

type GetAbilityOptions = {
  user?: Pick<UserProfileUi, 'teamMembership' | 'entitlements'>;
  isBrowserExtension?: boolean;
  isCanvasApp?: boolean;
  /**
   * The canvas app has no Jetstream team, so Salesforce custom permissions supply its policy instead.
   * Only read when `isCanvasApp` is set, omitted or null means full access.
   */
  canvasAccessPolicy?: Maybe<Pick<AccessProfilePolicy, 'tools' | 'operations'>>;
  isDesktop?: boolean;
};

/**
 * serializable CASL rules object
 *
 * @see https://casl.js.org/v6/en/guide/define-rules
 * @param options
 */
function getAbilityRules({ isBrowserExtension, isDesktop, isCanvasApp, canvasAccessPolicy, user }: GetAbilityOptions) {
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

  // No profile means full access, so members are unaffected until an admin assigns one. Team Dashboard
  // abilities above never depend on the profile, so an admin who restricts themselves cannot get locked out.
  // Billing has no core functionality, so it gets no tools or operations either.
  const accessPolicy = isCanvasApp ? canvasAccessPolicy : user.teamMembership?.accessProfile?.policy;
  if (!isBillingRole && !accessPolicy) {
    can('access', 'Tool');
    can('perform', 'Operation');
  } else if (!isBillingRole && accessPolicy) {
    can('access', 'Tool', { key: { $in: accessPolicy.tools } });
    can('perform', 'Operation', { key: { $in: accessPolicy.operations } });
  }

  if (isWebApp) {
    can('read', 'Profile');

    if (!user.teamMembership || (activeTeamMembership && isTeamsBillingOrAdmin)) {
      can(['read', 'update'], 'Billing');
    }

    if (activeTeamMembership) {
      if (isTeamsBillingOrAdmin) {
        can(
          ['read'],
          [
            'Team',
            'TeamMemberSession',
            'TeamMemberAuthActivity',
            'TeamMember',
            'DomainConfiguration',
            'SsoConfiguration',
            'TeamAccessProfile',
          ],
        );
        can('update', ['Team', 'TeamMember']);

        // Seat availability is enforced by the server and explained in the modals, so the invite
        // action itself only depends on role and billing standing
        can('invite', 'TeamMember');
        cannot('invite', 'TeamMember', { billingStatus: TeamBillingStatusSchema.enum.PAST_DUE });

        // Both roles can buy seats: the Billing role exists so finance can act on money. Manual
        // billing and past-due standing are applied by the dashboard rather than here, because they
        // change how the action is presented (hidden vs. disabled in place) rather than who holds it.
        can(['read', 'update'], 'TeamSeats');
      }
      if (isBillingRole) {
        cannot('update', 'TeamMember', { role: TeamMemberRoleSchema.enum.ADMIN });
      }
      if (isAdminRole) {
        can(['read'], 'AuditLog');
        // Creating, editing and assigning access profiles is limited to admins
        can('update', 'TeamAccessProfile');
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

export function canAccessTool(ability: AppAbility, key: AccessProfileToolKey) {
  return ability.can('access', { type: 'Tool', key });
}

export function canPerformOperation(ability: AppAbility, key: AccessProfileOperationKey) {
  return ability.can('perform', { type: 'Operation', key });
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

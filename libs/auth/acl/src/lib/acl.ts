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
type EntitlementSubjects = 'GoogleDrive' | 'ChromeExtension' | 'Desktop' | 'RecordSync';

type TeamActions = 'read' | 'update';
type TeamSubjects = 'Team' | 'TeamMember' | { type: 'TeamMember'; role: TeamMemberRole };

type TeamMemberActions = 'invite';
type TeamMemberSubjects = 'TeamMember' | { type: 'TeamMember'; billingStatus: TeamUserFacing['billingStatus']; availableLicenses: number };

type TeamMemberSessionActions = 'read' | 'delete';
type TeamMemberSessionSubjects = 'TeamMemberSession';

type TeamMemberAuthActivityActions = 'read';
type TeamMemberAuthActivitySubjects = 'TeamMemberAuthActivity';

export type AppAbility = MongoAbility<
  | [Actions, Subjects]
  | [EntitlementActions, EntitlementSubjects]
  | [TeamActions, TeamSubjects]
  | [TeamMemberActions, TeamMemberSubjects]
  | [TeamMemberSessionActions, TeamMemberSessionSubjects]
  | [TeamMemberAuthActivityActions, TeamMemberAuthActivitySubjects]
>;

const createAppAbility = createMongoAbility as CreateAbility<AppAbility>;

type GetAbilityOptions = {
  user?: Pick<UserProfileUi, 'teamMembership' | 'entitlements'>;
  isBrowserExtension?: boolean;
  isDesktop?: boolean;
};

/**
 * serializable CASL rules object
 *
 * @see https://casl.js.org/v6/en/guide/define-rules
 * @param options
 */
function getAbilityRules({ isBrowserExtension, isDesktop, user }: GetAbilityOptions) {
  const { can, cannot, rules } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    return rules;
  }

  const isWebApp = !isBrowserExtension && !isDesktop;
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
        can(['read'], ['Team', 'TeamMemberSession', 'TeamMemberAuthActivity', 'TeamMember']);
        can('update', ['Team', 'TeamMember']);

        can('invite', 'TeamMember');
        cannot('invite', 'TeamMember', { billingStatus: TeamBillingStatusSchema.enum.PAST_DUE });
        cannot('invite', 'TeamMember', { availableLicenses: { $lte: 0 } });
      }
      if (isBillingRole) {
        cannot('update', 'TeamMember', { role: TeamMemberRoleSchema.enum.ADMIN });
      }
      if (isAdminRole) {
        can('delete', 'TeamMemberSession');
      }
    }
  }

  if (user.entitlements.chromeExtension) {
    can('access', 'ChromeExtension');
  }
  if (user.entitlements.desktop) {
    can('access', 'Desktop');
  }
  if (user.entitlements.googleDrive) {
    can('access', 'GoogleDrive');
  }
  if (user.entitlements.recordSync) {
    can('access', 'RecordSync');
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

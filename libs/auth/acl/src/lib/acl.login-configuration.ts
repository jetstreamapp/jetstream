import { AbilityBuilder, createMongoAbility, type CreateAbility, type MongoAbility } from '@casl/ability';
import type { LoginConfigurationUI } from '@jetstream/auth/types';
import { Maybe, type UserProfileUi } from '@jetstream/types';

type IdentityActions = 'link' | 'unlink';
type IdentitySubjects = 'Identity' | { type: 'Identity'; provider: 'google' | 'salesforce' | 'credentials' };

type MfaActions = 'update' | 'remove' | 'remove_all';
type MfaSubjects = 'MFA' | { type: 'MFA'; method: 'email' | 'otp' };

type PasswordActions = 'read' | 'update' | 'remove';
type PasswordSubjects = 'Password';

export type LoginConfigAbility = MongoAbility<
  [IdentityActions, IdentitySubjects] | [MfaActions, MfaSubjects] | [PasswordActions, PasswordSubjects]
>;

const createLoginConfigurationAbility = createMongoAbility as CreateAbility<LoginConfigAbility>;

type GetAbilityOptions = {
  user?: Pick<UserProfileUi, 'teamMembership' | 'entitlements'>;
  loginConfiguration?: Maybe<LoginConfigurationUI>;
  isBrowserExtension?: boolean;
  isDesktop?: boolean;
};

/**
 * serializable CASL rules object
 *
 * @see https://casl.js.org/v6/en/guide/define-rules
 * @param options
 */
function getAbilityRules({ isBrowserExtension, isDesktop, user, loginConfiguration }: GetAbilityOptions) {
  const { can, cannot, rules, build } = new AbilityBuilder<LoginConfigAbility>(createMongoAbility);

  if (!user) {
    return rules;
  }

  const activeTeamMembership = user.teamMembership?.status === 'ACTIVE';

  // Default configuration if not login configuration
  if (!loginConfiguration) {
    // can link and unlink from anywhere
    can(['link', 'unlink'], 'Identity');

    // can set password and MFA
    can(['read', 'update', 'remove'], 'Password');
    can(['update', 'remove'], 'MFA');

    return rules;
  }

  const { allowIdentityLinking, allowedMfaMethods, isGoogleAllowed, isPasswordAllowed, isSalesforceAllowed, requireMfa } =
    loginConfiguration;

  // Password management
  if (isPasswordAllowed) {
    can(['read', 'update', 'remove'], 'Password');
  } else {
    can(['remove'], 'Password');
  }

  // Identity provider management - provider-specific permissions
  if (allowIdentityLinking) {
    if (isGoogleAllowed) {
      can(['link', 'unlink'], 'Identity', { provider: 'google' });
    }
    if (isSalesforceAllowed) {
      can(['link', 'unlink'], 'Identity', { provider: 'salesforce' });
    }
  }

  // MFA management - method-specific permissions
  if (!requireMfa) {
    can('remove', 'MFA');
    can('remove_all', 'MFA');
  }
  if (allowedMfaMethods?.email) {
    can(['update', 'remove'], 'MFA', { method: 'email' });
  }
  if (allowedMfaMethods?.otp) {
    can(['update', 'remove'], 'MFA', { method: 'otp' });
  }

  return rules;
}

export function getLoginConfigurationAbility(options: GetAbilityOptions) {
  return createLoginConfigurationAbility(getAbilityRules(options), {
    detectSubjectType: (item) => {
      if (typeof item === 'object' && 'type' in item) {
        return item.type;
      }
      return item as any;
    },
  });
}

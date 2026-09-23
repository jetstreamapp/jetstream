import type { Maybe } from '@jetstream/types';

export interface SsoRequirementConfig {
  ssoEnabled: boolean;
  ssoProvider: string;
  ssoBypassEnabled: boolean;
  ssoBypassEnabledRoles: readonly string[];
}

/**
 * Whether someone holding `role` on the team has to sign in with SSO, which is when SSO is turned on and the
 * team does not let that role sign in another way.
 *
 * Shared by sign in, the in-app invitation acceptance and the invite modal so all three agree on who can
 * skip SSO. A missing role is always held to SSO, since there is nothing to check it against.
 */
export function isSsoRequiredForRole(loginConfiguration: SsoRequirementConfig, role: Maybe<string>): boolean {
  if (!loginConfiguration.ssoEnabled || loginConfiguration.ssoProvider === 'NONE') {
    return false;
  }
  if (!role || !loginConfiguration.ssoBypassEnabled) {
    return true;
  }
  return !loginConfiguration.ssoBypassEnabledRoles.includes(role);
}

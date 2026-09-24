import { isSsoRequiredForRole, SsoRequirementConfig } from '@jetstream/shared/utils';
import { Maybe, TeamMemberRole } from '@jetstream/types';

/**
 * An invitee whose role has to use SSO can only join by signing in with SSO, and SSO only accepts email addresses
 * on the team's verified domains. Inviting anyone else to that role creates an invitation that can never be
 * accepted, so the admin is warned before sending it.
 */
export function getSsoInviteWarning({
  email,
  role,
  ssoConfig,
  verifiedDomains,
}: {
  email: string;
  role: TeamMemberRole;
  ssoConfig: Maybe<SsoRequirementConfig>;
  verifiedDomains: string[];
}): string | null {
  const emailDomain = email.split('@')[1]?.trim().toLowerCase();
  if (!ssoConfig || !emailDomain || !isSsoRequiredForRole(ssoConfig, role) || verifiedDomains.includes(emailDomain)) {
    return null;
  }
  return `This person will not be able to join. Your team requires single sign-on (SSO) for this role, and ${emailDomain} is not one of your verified domains, so they cannot sign in with SSO. Verify the domain, let this role sign in without SSO, or invite an address on a verified domain.`;
}

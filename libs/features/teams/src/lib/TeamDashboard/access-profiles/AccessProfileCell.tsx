import { TEAM_MEMBER_ROLE_BILLING, TeamAccessProfile, TeamMemberRole } from '@jetstream/types';
import { getAccessProfileName } from './access-profile.utils';

export function AccessProfileCell({
  role,
  accessProfileId,
  accessProfiles,
}: {
  role: TeamMemberRole;
  accessProfileId: string | null | undefined;
  accessProfiles: TeamAccessProfile[];
}) {
  // The billing role never has access to tools, so a profile would not change anything
  if (role === TEAM_MEMBER_ROLE_BILLING) {
    return (
      <span>
        <span aria-hidden="true" title="Billing users do not have access to Jetstream tools">
          —
        </span>
        <span className="slds-assistive-text">None, billing users do not have access to Jetstream tools</span>
      </span>
    );
  }
  return <span>{getAccessProfileName(accessProfiles, accessProfileId)}</span>;
}

import { css } from '@emotion/react';
import { LoginConfigurationWithCallbacks } from '@jetstream/auth/types';
import { TeamGlobalAction, TeamSeatSummary, TeamTableAction, TeamUserFacing, UserProfileUi } from '@jetstream/types';
import { ButtonGroupContainer, Card } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { getSeatFooterMessage } from '../team-seats/team-seats.utils';
import { TeamInviteTable } from './TeamInviteTable';
import { TeamMemberRow } from './TeamMemberRow';

export interface TeamMembersTableProps {
  loginConfiguration: TeamUserFacing['loginConfig'];
  billingStatus: TeamUserFacing['billingStatus'];
  seats: TeamSeatSummary | null;
  hasManualBilling: boolean;
  teamMembers: TeamUserFacing['members'];
  invitations: TeamUserFacing['invitations'];
  userProfile: UserProfileUi;
  configuredSsoProvider?: LoginConfigurationWithCallbacks['ssoProvider'] | null;
  onGlobalAction: (action: TeamGlobalAction) => Promise<void>;
  onUserAction: (payload: TeamTableAction) => Promise<unknown>;
}

export function TeamMembersTable({
  loginConfiguration,
  billingStatus,
  teamMembers,
  seats,
  hasManualBilling,
  invitations,
  userProfile,
  configuredSsoProvider,
  onGlobalAction,
  onUserAction,
}: TeamMembersTableProps) {
  const ability = useAtomValue(abilityState);

  const canReadAuthActivity = ability.can('read', 'TeamMemberAuthActivity');
  const canReadSession = ability.can('read', 'TeamMemberSession');
  const canUpdate = ability.can('update', 'TeamMember');
  // Seat availability is enforced by the server and explained in the invite modal, so the button
  // stays visible even when every seat is taken
  const canInvite = ability.can('invite', { type: 'TeamMember', billingStatus });

  if (ability.cannot('read', 'TeamMember')) {
    return null;
  }

  const seatMessage = getSeatFooterMessage(seats, hasManualBilling);

  const allowedMfaMethods = new Set(loginConfiguration?.allowedMfaMethods);
  const allowedProviders = new Set(loginConfiguration?.allowedProviders);
  const requireMfa = !!loginConfiguration?.requireMfa;
  const allowIdentityLinking = !!loginConfiguration?.allowIdentityLinking;

  return (
    <Card
      title="Team Members"
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'people' }}
      footer={seatMessage && <span data-testid="team-members-seat-footer">{seatMessage}</span>}
      actions={
        <ButtonGroupContainer>
          {canReadAuthActivity && (
            <button className="slds-button slds-button_neutral" onClick={() => onGlobalAction('view-auth-activity')}>
              View Auth Activity
            </button>
          )}
          {canReadSession && (
            <button className="slds-button slds-button_neutral" onClick={() => onGlobalAction('view-user-sessions')}>
              View User Sessions
            </button>
          )}
          {canInvite && (
            <button className="slds-button slds-button_brand" onClick={() => onGlobalAction('team-member-invite')}>
              Add Team Member
            </button>
          )}
        </ButtonGroupContainer>
      }
    >
      <table
        data-testid="team-member-table"
        aria-describedby="team-members-heading"
        className="slds-table slds-table_cell-buffer slds-table_bordered"
      >
        <thead>
          <tr className="slds-line-height_reset">
            <th
              scope="col"
              css={css`
                width: 2.25rem;
              `}
            >
              <div className="slds-truncate slds-assistive-text" title="Actions">
                Actions
              </div>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="User">
                User
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Authentication Identities">
                Authentication Identities
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Multi-Factor Authentication">
                Multi-Factor Authentication
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Role">
                Role
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Status">
                Status
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Last Logged In">
                Last Logged In
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member) => (
            <TeamMemberRow
              key={member.userId}
              allowedMfaMethods={allowedMfaMethods}
              allowedProviders={allowedProviders}
              requireMfa={requireMfa}
              allowIdentityLinking={allowIdentityLinking}
              member={member}
              isCurrentUser={userProfile.id === member.userId}
              configuredSsoProvider={configuredSsoProvider}
              onUserAction={onUserAction}
            />
          ))}
        </tbody>
      </table>
      {invitations.length > 0 && (
        <>
          <h4 className="slds-text-align_center slds-text-heading_small slds-m-around_small">Team Member Invitations</h4>
          <TeamInviteTable invitations={invitations} canUpdate={canUpdate} onUserAction={onUserAction} />
        </>
      )}
    </Card>
  );
}

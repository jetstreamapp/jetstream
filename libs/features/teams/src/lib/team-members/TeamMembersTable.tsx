import { css } from '@emotion/react';
import { TeamGlobalAction, TeamTableAction, TeamUserFacing, UserProfileUi } from '@jetstream/types';
import { ButtonGroupContainer, Card } from '@jetstream/ui';
import { TeamInviteRow } from './InvitationRow';
import { TeamMemberRow } from './TeamMemberRow';

export interface TeamMembersTableProps {
  teamMembers: TeamUserFacing['members'];
  invitations: TeamUserFacing['invitations'];
  userProfile: UserProfileUi;
  onGlobalAction: (action: TeamGlobalAction) => Promise<void>;
  onUserAction: (payload: TeamTableAction) => Promise<void>;
}

export function TeamMembersTable({ teamMembers, invitations, userProfile, onGlobalAction, onUserAction }: TeamMembersTableProps) {
  return (
    <Card
      title="Team Members"
      bodyClassName=""
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'people' }}
      actions={
        <ButtonGroupContainer>
          <button className="slds-button slds-button_neutral" onClick={() => onGlobalAction('view-auth-activity')}>
            View Auth Activity
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => onGlobalAction('view-user-sessions')}>
            View User Sessions
          </button>
          <button className="slds-button slds-button_brand" onClick={() => onGlobalAction('team-member-invite')}>
            Add Team Member
          </button>
        </ButtonGroupContainer>
      }
    >
      <div className="slds-scrollable_x slds-scrollable_y slds-p-bottom_xx-large">
        <table aria-describedby="team-members-heading" className="slds-table slds-table_cell-buffer slds-table_bordered">
          <thead>
            <tr className="slds-line-height_reset">
              <th
                scope="col"
                css={css`
                  width: 3.25rem;
                `}
              >
                <div className="slds-truncate slds-assistive-text" title="Actions">
                  Actions
                </div>
              </th>
              <th scope="col">
                <span className="slds-truncate" title="Name">
                  User
                </span>
              </th>
              <th scope="col">
                <span className="slds-truncate" title="Email">
                  Authentication Identities
                </span>
              </th>
              <th scope="col">
                <span className="slds-truncate" title="Email">
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
                member={member}
                isCurrentUser={userProfile.id === member.userId}
                onUserAction={onUserAction}
              />
            ))}
            {invitations.length > 0 && (
              <tr>
                <td
                  css={css`
                    background-color: #f3f3f3;
                    color: #444444;
                    font-weight: 700;
                    text-align: center;
                  `}
                  colSpan={100}
                >
                  Invitations
                </td>
              </tr>
            )}
            {invitations.map((invitation) => (
              <TeamInviteRow key={invitation.id} invitation={invitation} onUserAction={onUserAction} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

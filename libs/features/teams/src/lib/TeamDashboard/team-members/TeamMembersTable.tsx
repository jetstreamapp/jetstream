import { css } from '@emotion/react';
import { TeamGlobalAction, TeamTableAction, TeamUserFacing, UserProfileUi } from '@jetstream/types';
import { ButtonGroupContainer, Card } from '@jetstream/ui';
import { TeamInviteTable } from './TeamInviteTable';
import { TeamMemberRow } from './TeamMemberRow';

export interface TeamMembersTableProps {
  teamMembers: TeamUserFacing['members'];
  invitations: TeamUserFacing['invitations'];
  userProfile: UserProfileUi;
  onGlobalAction: (action: TeamGlobalAction) => Promise<void>;
  onUserAction: (payload: TeamTableAction) => Promise<unknown>;
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
      <table aria-describedby="team-members-heading" className="slds-table slds-table_cell-buffer slds-table_bordered">
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
              member={member}
              isCurrentUser={userProfile.id === member.userId}
              onUserAction={onUserAction}
            />
          ))}
        </tbody>
      </table>
      {invitations.length > 0 && (
        <>
          <h4 className="slds-text-align_center slds-text-heading_small slds-m-around_small">Team Member Invitations</h4>
          <TeamInviteTable invitations={invitations} onUserAction={onUserAction} />
        </>
      )}
    </Card>
  );
}

import { css } from '@emotion/react';
import { TeamTableAction, TeamUserFacing } from '@jetstream/types';
import { TeamInviteRow } from './InvitationRow';

export interface TeamInviteTableProps {
  invitations: TeamUserFacing['invitations'];
  canUpdate: boolean;
  onUserAction: (payload: TeamTableAction) => Promise<unknown>;
}

export function TeamInviteTable({ invitations, canUpdate, onUserAction }: TeamInviteTableProps) {
  if (!invitations.length) {
    return null;
  }

  return (
    <table
      data-testid="team-invite-table"
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
            <span className="slds-truncate" title="Email">
              Email
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
            <span className="slds-truncate" title="Last Sent">
              Last Sent
            </span>
          </th>
          <th scope="col">
            <span className="slds-truncate" title="Expires At">
              Expires At
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {invitations.map((invitation) => (
          <TeamInviteRow key={invitation.id} invitation={invitation} canUpdate={canUpdate} onUserAction={onUserAction} />
        ))}
      </tbody>
    </table>
  );
}

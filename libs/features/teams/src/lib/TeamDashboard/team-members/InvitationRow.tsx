import { css } from '@emotion/react';
import { TeamInvitationAction, TeamUserFacing } from '@jetstream/types';
import { Badge, DropDown, Tooltip } from '@jetstream/ui';
import { isBefore } from 'date-fns/isBefore';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { TeamMembersTableProps } from './TeamMembersTable';

export const TeamInviteRow = ({
  invitation,
  canUpdate,
  onUserAction,
}: {
  invitation: TeamUserFacing['invitations'][number];
  canUpdate: boolean;
  onUserAction: TeamMembersTableProps['onUserAction'];
}) => {
  return (
    <tr data-testid={`team-member-row-invite-${invitation.email}`}>
      <td
        role="gridcell"
        css={css`
          padding-left: 0.5rem !important;
        `}
      >
        {canUpdate && <ActionCell invitation={invitation} onUserAction={onUserAction} />}
      </td>
      <th scope="row" className="slds-cell-wrap">
        <div title={invitation.email}>
          <div
            css={css`
              white-space: break-spaces;
              text-wrap: auto;
            `}
          >
            {invitation.email}
          </div>
        </div>
      </th>
      <td role="gridcell" className="slds-cell-wrap">
        <RoleCell role={invitation.role} />
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        <StatusCell expiresAt={invitation.expiresAt} />
      </td>
      <td role="gridcell">
        <DateCell value={invitation.lastSentAt} />
      </td>
      <td role="gridcell">
        <DateCell value={invitation.expiresAt} />
      </td>
    </tr>
  );
};

const RoleCell = ({ role }: { role: TeamUserFacing['invitations'][number]['role'] }) => {
  if (role === 'ADMIN') {
    return <Badge type="inverse">Admin</Badge>;
  }
  if (role === 'BILLING') {
    return <Badge type="default">Billing</Badge>;
  }
  return <Badge type="light">Member</Badge>;
};

const StatusCell = ({ expiresAt }: { expiresAt: TeamUserFacing['invitations'][number]['expiresAt'] }) => {
  const expires = parseISO(expiresAt);
  const isActive = isBefore(new Date(), expires);
  if (isActive) {
    return (
      <Tooltip content={`This invitation expires on ${expires.toLocaleString()}`}>
        <Badge type="success">Pending</Badge>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={`This invitation expired on ${expires.toLocaleString()}`}>
      <Badge type="warning">Expired</Badge>
    </Tooltip>
  );
};

const ActionCell = ({
  invitation,
  onUserAction,
}: {
  invitation: TeamUserFacing['invitations'][number];
  onUserAction: TeamMembersTableProps['onUserAction'];
}) => {
  return (
    <DropDown
      testId="user-row-actions"
      dropDownClassName="slds-dropdown_actions"
      buttonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
      position="left"
      items={[
        {
          id: 'resend-invite',
          value: 'Resend Invite',
          icon: { type: 'utility', icon: 'send', description: 'Resend Invite' },
          trailingDivider: true,
        },
        {
          id: 'cancel-invite',
          value: 'Cancel Invite',
          icon: { type: 'utility', icon: 'delete', description: 'Deactivate' },
        },
      ]}
      onSelected={(id) =>
        onUserAction({
          type: 'INVITATION',
          invitation,
          action: id as TeamInvitationAction,
        })
      }
    />
  );
};

const DateCell = ({ value }: { value: string }) => {
  try {
    const date = parseISO(value);
    if (!isValid(date)) {
      return value;
    }
    return date.toLocaleString();
  } catch {
    return value;
  }
};

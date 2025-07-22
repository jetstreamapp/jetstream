import { TwoFactorTypeWithoutEmail } from '@jetstream/auth/types';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { DropDownItem, TeamUserAction, TeamUserFacing } from '@jetstream/types';
import { Badge, DropDown, Grid, GridCol } from '@jetstream/ui';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { useMemo } from 'react';
import { TeamMembersTableProps } from './TeamMembersTable';

export const TeamMemberRow = ({
  member,
  isCurrentUser,
  onUserAction,
}: {
  member: TeamUserFacing['members'][number];
  isCurrentUser: boolean;

  onUserAction: TeamMembersTableProps['onUserAction'];
}) => {
  return (
    <tr data-testid={`user-row-${member.userId}`}>
      <td role="gridcell">
        <ActionCell isCurrentUser={isCurrentUser} member={member} onUserAction={onUserAction} />
      </td>
      <th scope="row">
        <div title={member.user.name}>
          <div>{member.user.name}</div>
          <div>
            {member.user.email}
            {member.user.emailVerified ? null : ' (Unverified)'}
          </div>
        </div>
      </th>
      <td role="gridcell">
        <Identities identities={member.user.identities} hasPasswordSet={member.user.hasPasswordSet} />
      </td>
      <td role="gridcell">
        <MfaTypes authFactors={member.user.authFactors} />
      </td>
      <td role="gridcell">
        <RoleCell role={member.role} />
      </td>
      <td role="gridcell">
        <StatusCell status={member.status} />
      </td>
      <td role="gridcell">
        <LastLoggedInCell lastLoggedIn={member.user.lastLoggedIn} />
      </td>
    </tr>
  );
};

const Identities = ({
  identities,
  hasPasswordSet,
}: {
  identities: TeamUserFacing['members'][number]['user']['identities'];
  hasPasswordSet: boolean;
}) => {
  const sortedIdentities = orderObjectsBy(identities, ['isPrimary', 'provider', 'email', 'username'], ['desc', 'asc', 'asc', 'asc']);
  return (
    <div>
      {sortedIdentities.map((identity) => (
        <p key={`${identity.provider}-${identity.email}`}>
          {identity.provider} ({identity.username || identity.email})
        </p>
      ))}
      {hasPasswordSet && 'Username/Password'}
    </div>
  );
};

const MfaTypes = ({ authFactors }: { authFactors: TeamUserFacing['members'][number]['user']['authFactors'] }) => {
  const enabled2faTypes = authFactors.filter(({ enabled }) => enabled).map(({ type }) => type as TwoFactorTypeWithoutEmail);

  return (
    <Grid vertical>
      {enabled2faTypes.map((type) => (
        <GridCol className="slds-p-bottom_xx-small" key={type}>
          <Badge type="light">{type === '2fa-otp' ? 'Authenticator App' : type === '2fa-email' ? 'Email' : type}</Badge>
        </GridCol>
      ))}
    </Grid>
  );
};

const RoleCell = ({ role }: { role: TeamUserFacing['members'][number]['role'] }) => {
  if (role === 'ADMIN') {
    return <Badge type="inverse">Admin</Badge>;
  }
  if (role === 'BILLING') {
    return <Badge type="default">Billing</Badge>;
  }
  return <Badge type="light">Member</Badge>;
};

const StatusCell = ({ status }: { status: TeamUserFacing['members'][number]['status'] }) => {
  if (status === 'ACTIVE') {
    return <Badge type="light">Active</Badge>;
  }
  return <Badge type="default">Inactive</Badge>;
};

const LastLoggedInCell = ({ lastLoggedIn }: { lastLoggedIn: TeamUserFacing['members'][number]['user']['lastLoggedIn'] }) => {
  if (!lastLoggedIn) {
    return 'Never';
  }
  try {
    const date = parseISO(lastLoggedIn);
    if (!isValid(date)) {
      return lastLoggedIn;
    }
    return date.toLocaleString();
  } catch {
    return lastLoggedIn;
  }
};

const ActionCell = ({
  isCurrentUser,
  member,
  onUserAction,
}: {
  isCurrentUser: boolean;
  member: TeamUserFacing['members'][number];
  onUserAction: TeamMembersTableProps['onUserAction'];
}) => {
  const { status } = member;
  const menuItems = useMemo(() => {
    const items: DropDownItem[] = [];
    if (status === 'ACTIVE') {
      items.push({
        id: 'deactivate',
        value: 'Deactivate',
        icon: { type: 'utility', icon: 'toggle_off', description: 'Deactivate' },
      });
    } else if (status === 'INACTIVE') {
      items.push(
        {
          id: 'cancel-invite',
          value: 'Cancel Invite',
          icon: { type: 'utility', icon: 'toggle_off', description: 'Cancel Invite' },
        },
        {
          id: 'resend-invite',
          value: 'Resend Invite',
          icon: { type: 'utility', icon: 'toggle_off', description: 'Resend Invite' },
        }
      );
    } else {
      items.push({
        id: 'enable',
        value: 'Reactivate User',
        icon: { type: 'utility', icon: 'toggle_on', description: 'Reactivate User' },
      });
    }
    return items;
  }, [status]);

  if (isCurrentUser) {
    return null;
  }

  return (
    <DropDown
      testId="user-row-actions"
      dropDownClassName="slds-dropdown_actions"
      buttonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
      position="left"
      items={menuItems}
      usePortal
      onSelected={(id) =>
        onUserAction({
          type: 'MEMBER',
          member,
          action: id as TeamUserAction,
        })
      }
    />
  );
};

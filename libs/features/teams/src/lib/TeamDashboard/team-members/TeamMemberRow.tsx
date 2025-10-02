import { css } from '@emotion/react';
import { TwoFactorTypeWithoutEmail } from '@jetstream/auth/types';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { DropDownItem, TeamLoginConfig, TeamUserAction, TeamUserFacing } from '@jetstream/types';
import { Badge, DropDown, Grid, GridCol, Icon, Tooltip } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { TeamMembersTableProps } from './TeamMembersTable';

export const TeamMemberRow = ({
  allowedMfaMethods,
  allowedProviders,
  requireMfa,
  allowIdentityLinking,
  member,
  isCurrentUser,
  onUserAction,
}: {
  allowedMfaMethods: Set<TeamLoginConfig['allowedMfaMethods'][number]>;
  allowedProviders: Set<TeamLoginConfig['allowedProviders'][number]>;
  requireMfa: TeamLoginConfig['requireMfa'];
  allowIdentityLinking: TeamLoginConfig['allowIdentityLinking'];
  member: TeamUserFacing['members'][number];
  isCurrentUser: boolean;
  onUserAction: TeamMembersTableProps['onUserAction'];
}) => {
  const ability = useAtomValue(abilityState);
  const canUpdate = ability.can('update', { type: 'TeamMember', role: member.role });
  return (
    <tr data-testid={`team-member-row-${member.user.email}`}>
      <td
        role="gridcell"
        css={css`
          padding-left: 0.5rem !important;
        `}
      >
        {canUpdate && <ActionCell isCurrentUser={isCurrentUser} member={member} onUserAction={onUserAction} />}
      </td>
      <th scope="row" className="slds-cell-wrap">
        <div title={member.user.name}>
          <div>{member.user.name}</div>
          <div
            css={css`
              white-space: break-spaces;
              text-wrap: auto;
            `}
          >
            {member.user.email}
            {member.user.emailVerified ? null : ' (Unverified)'}
          </div>
        </div>
      </th>
      <td role="gridcell" className="slds-cell-wrap">
        <Identities
          allowedProviders={allowedProviders}
          allowIdentityLinking={allowIdentityLinking}
          identities={member.user.identities}
          hasPasswordSet={member.user.hasPasswordSet}
        />
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        <MfaTypes requireMfa={requireMfa} allowedMfaMethods={allowedMfaMethods} authFactors={member.user.authFactors} />
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        <RoleCell role={member.role} />
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        <StatusCell status={member.status} />
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        <LastLoggedInCell lastLoggedIn={member.user.lastLoggedIn} />
      </td>
    </tr>
  );
};

const Identities = ({
  allowedProviders,
  allowIdentityLinking,
  identities,
  hasPasswordSet,
}: {
  allowedProviders: Set<TeamLoginConfig['allowedProviders'][number]>;
  allowIdentityLinking: TeamLoginConfig['allowIdentityLinking'];
  identities: TeamUserFacing['members'][number]['user']['identities'];
  hasPasswordSet: boolean;
}) => {
  const sortedIdentities = orderObjectsBy(identities, ['isPrimary', 'provider', 'email', 'username'], ['desc', 'asc', 'asc', 'asc']);
  const doesNotHaveValidProvider =
    sortedIdentities.every(({ provider }) => !allowedProviders.has(provider as any)) &&
    (!allowedProviders.has('credentials') || !hasPasswordSet);
  return (
    <div>
      {sortedIdentities.map((identity) => (
        <p
          key={`${identity.provider}-${identity.email}`}
          css={css`
            white-space: break-spaces;
            text-wrap: auto;
          `}
        >
          {identity.provider} ({identity.username || identity.email})
          {!allowedProviders.has(identity.provider as any) && (
            <Tooltip content="This login method is not allowed and will not be available for use even though is it set up.">
              <Icon
                type="utility"
                icon="warning"
                className="slds-icon slds-icon-text-warning slds-m-left_x-small slds-m-bottom_xx-small slds-icon_x-small"
                containerClassname="slds-icon_container slds-icon-utility-warning"
              />
            </Tooltip>
          )}
        </p>
      ))}
      {hasPasswordSet && 'Username/Password'}
      {hasPasswordSet && !allowedProviders.has('credentials') && (
        <Tooltip content="This login method is not allowed and will not be available for use even though is it set up.">
          <Icon
            type="utility"
            icon="warning"
            className="slds-icon slds-icon-text-warning slds-m-left_x-small slds-m-bottom_xx-small slds-icon_x-small"
            containerClassname="slds-icon_container slds-icon-utility-warning"
          />
        </Tooltip>
      )}
      {doesNotHaveValidProvider && (
        <Tooltip
          content={
            allowIdentityLinking
              ? 'This user does not have a valid login provider and they will not be able to login. Temporarily allow identity linking, remove the user and re-invite them, or contact support for assistance.'
              : 'This user does not have a valid login provider and they will not be able to login. Temporarily allow identity linking or contact support for assistance.'
          }
        >
          <Icon
            type="utility"
            icon="error"
            className="slds-icon slds-icon-text-error slds-m-left_x-small slds-m-bottom_xx-small slds-icon_x-small"
            containerClassname="slds-icon_container slds-icon-utility-error"
          />
        </Tooltip>
      )}
    </div>
  );
};

const MfaTypes = ({
  allowedMfaMethods,
  authFactors,
  requireMfa,
}: {
  allowedMfaMethods: Set<TeamLoginConfig['allowedMfaMethods'][number]>;
  requireMfa: boolean;
  authFactors: TeamUserFacing['members'][number]['user']['authFactors'];
}) => {
  const enabled2faTypes = authFactors.filter(({ enabled }) => enabled).map(({ type }) => type as TwoFactorTypeWithoutEmail);

  return (
    <Grid vertical>
      {requireMfa && enabled2faTypes.length === 0 && (
        <Tooltip content="This user will be forced to enroll in a valid MFA method.">
          <Icon
            type="utility"
            icon="warning"
            className="slds-icon slds-icon-text-warning slds-m-left_x-small slds-m-bottom_xx-small slds-icon_x-small"
            containerClassname="slds-icon_container slds-icon-utility-warning"
          />
        </Tooltip>
      )}
      {enabled2faTypes.map((type) => (
        <GridCol data-testid={`mfa-type-${type}`} className="slds-p-bottom_xx-small" key={type}>
          <Badge type="light">{type === '2fa-otp' ? 'Authenticator App' : type === '2fa-email' ? 'Email' : type}</Badge>
          {requireMfa && !allowedMfaMethods.has(type.split('-')[1] as TeamLoginConfig['allowedMfaMethods'][number]) && (
            <Tooltip content="This MFA method is not allowed, the user will be asked to enroll if they don't have another allowed MFA type.">
              <Icon
                type="utility"
                icon="warning"
                className="slds-icon slds-icon-text-warning slds-m-left_x-small slds-m-bottom_xx-small slds-icon_x-small"
                containerClassname="slds-icon_container slds-icon-utility-warning"
              />
            </Tooltip>
          )}
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
    return <Badge type="light">Billing</Badge>;
  }
  return <Badge type="light">Member</Badge>;
};

const StatusCell = ({ status }: { status: TeamUserFacing['members'][number]['status'] }) => {
  if (status === 'ACTIVE') {
    return <Badge type="inverse">Active</Badge>;
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
      items.push(
        {
          id: 'edit',
          value: 'Edit',
          icon: { type: 'utility', icon: 'settings', description: 'Edit' },
          trailingDivider: true,
        },
        {
          id: 'deactivate',
          value: 'Deactivate',
          icon: { type: 'utility', icon: 'toggle_off', description: 'Deactivate' },
        },
      );
    } else {
      items.push({
        id: 'reactivate',
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

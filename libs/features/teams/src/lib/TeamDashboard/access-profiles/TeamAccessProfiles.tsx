import { css } from '@emotion/react';
import { ACCESS_PROFILE_SURFACES, getAccessProfilePolicySummary, TeamAccessProfile } from '@jetstream/types';
import { Badge, Card, EmptyState, Icon, Tooltip } from '@jetstream/ui';

interface TeamAccessProfilesProps {
  accessProfiles: TeamAccessProfile[];
  canUpdate: boolean;
  /** Members with no profile, which means full access */
  fullAccessMemberCount: number;
  onCreate: () => void;
  onEdit: (accessProfile: TeamAccessProfile) => void;
  onDelete: (accessProfile: TeamAccessProfile) => void;
}

export function TeamAccessProfiles({
  accessProfiles,
  canUpdate,
  fullAccessMemberCount,
  onCreate,
  onEdit,
  onDelete,
}: TeamAccessProfilesProps) {
  const hasDefaultProfile = accessProfiles.some(({ isDefault }) => isDefault);

  return (
    <Card
      testId="team-access-profiles"
      title="Access Profiles"
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'portal_roles_and_subordinates' }}
      actions={
        canUpdate && (
          <button className="slds-button slds-button_neutral" onClick={onCreate}>
            New Access Profile
          </button>
        )
      }
    >
      <p className="slds-m-bottom_small">
        Access profiles choose which Jetstream tools and actions a member can use, and whether they can sign in to the desktop app or
        browser extension. Members without a profile have full access. Profiles do not change anyone's Salesforce permissions.
      </p>
      {accessProfiles.length === 0 ? (
        <EmptyState
          omitIllustration
          headline="No access profiles yet"
          subHeading={canUpdate ? 'Create a profile to give some members access to only the tools they need.' : undefined}
        />
      ) : (
        <table data-testid="team-access-profile-table" className="slds-table slds-table_cell-buffer slds-table_bordered">
          <thead>
            <tr className="slds-line-height_reset">
              <th scope="col">Profile</th>
              <th scope="col">Tools</th>
              <th scope="col">Actions</th>
              <th scope="col">Sign in to</th>
              <th scope="col">Members</th>
              {canUpdate && (
                <th
                  scope="col"
                  css={css`
                    width: 8rem;
                  `}
                >
                  <span className="slds-assistive-text">Manage</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="slds-cell-wrap">
                <div>Full access</div>
                <div className="slds-text-body_small slds-text-color_weak">
                  Members without a profile{!hasDefaultProfile && ', including new members'}
                </div>
              </th>
              <td>All</td>
              <td>All</td>
              <td>Web, desktop and extension</td>
              <td>{fullAccessMemberCount}</td>
              {canUpdate && <td />}
            </tr>
            {accessProfiles.map((accessProfile) => (
              <AccessProfileRow
                key={accessProfile.id}
                accessProfile={accessProfile}
                canUpdate={canUpdate}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AccessProfileRow({
  accessProfile,
  canUpdate,
  onEdit,
  onDelete,
}: {
  accessProfile: TeamAccessProfile;
  canUpdate: boolean;
  onEdit: (accessProfile: TeamAccessProfile) => void;
  onDelete: (accessProfile: TeamAccessProfile) => void;
}) {
  const { name, description, isDefault, policy, memberCount, invitationCount } = accessProfile;
  const summary = getAccessProfilePolicySummary(policy);
  const surfaceLabels = ['Web', ...ACCESS_PROFILE_SURFACES.filter(({ key }) => policy.surfaces.includes(key)).map(({ label }) => label)];

  return (
    <tr data-testid={`team-access-profile-row-${name}`}>
      <th scope="row" className="slds-cell-wrap">
        <div>
          {name}
          {isDefault && (
            <Badge type="inverse" className="slds-m-left_x-small">
              Default
            </Badge>
          )}
        </div>
        {description && <div className="slds-text-body_small slds-text-color_weak">{description}</div>}
      </th>
      <td>
        {summary.tools.enabled} of {summary.tools.total}
      </td>
      <td>
        {summary.operations.enabled} of {summary.operations.total}
      </td>
      <td className="slds-cell-wrap">{surfaceLabels.join(', ')}</td>
      <td>
        {memberCount}
        {invitationCount > 0 && (
          <Tooltip content={`${invitationCount} pending ${invitationCount === 1 ? 'invitation uses' : 'invitations use'} this profile`}>
            <span className="slds-m-left_xx-small slds-text-color_weak">(+{invitationCount} invited)</span>
          </Tooltip>
        )}
      </td>
      {canUpdate && (
        <td>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled"
            title="Edit"
            onClick={() => onEdit(accessProfile)}
          >
            <Icon type="utility" icon="edit" className="slds-button__icon" omitContainer description={`Edit ${name}`} />
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_xx-small"
            title="Delete"
            onClick={() => onDelete(accessProfile)}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer description={`Delete ${name}`} />
          </button>
        </td>
      )}
    </tr>
  );
}

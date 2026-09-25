import { css } from '@emotion/react';
import {
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TEAM_MEMBER_ROLE_MEMBER,
  TeamMemberStatusSchema,
  UserProfileUi,
} from '@jetstream/types';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { ReactNode } from 'react';
import { SettingsGroup } from './layout/SettingsSection';

const TEAM_ROLE_LABELS: Record<string, string> = {
  [TEAM_MEMBER_ROLE_ADMIN]: 'Admin',
  [TEAM_MEMBER_ROLE_BILLING]: 'Billing',
  [TEAM_MEMBER_ROLE_MEMBER]: 'Member',
};

const summaryCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.25rem;
  padding: 1rem 1.25rem;
`;

const identityCss = css`
  flex: 1 1 16rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
`;

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

export interface AccountSummaryProps {
  userProfile: UserProfileUi;
  /** Account links shown beside the identity, e.g. edit profile or the team dashboard */
  actions?: ReactNode;
}

/** Who is signed in - the one place the desktop app shows the account, since it has no profile page */
export const AccountSummary = ({ userProfile, actions }: AccountSummaryProps) => {
  const { name, email, picture, teamMembership } = userProfile;
  const activeTeam = teamMembership?.status === TeamMemberStatusSchema.enum.ACTIVE ? teamMembership : null;

  return (
    <SettingsGroup testId="account-summary">
      <div css={summaryCss}>
        <div css={identityCss}>
          <span className="slds-avatar slds-avatar_circle slds-avatar_large">
            <img
              alt=""
              src={picture || Avatar}
              onError={(event) => {
                // Stored pictures can point at hosts that are no longer reachable or allowed by the CSP
                event.currentTarget.onerror = null;
                event.currentTarget.src = Avatar;
              }}
            />
          </span>
          <div className="slds-truncate">
            <p className="slds-text-heading_small slds-truncate" title={name} data-testid="account-summary-name">
              {name}
            </p>
            <p className="slds-truncate" title={email} data-testid="account-summary-email">
              {email}
            </p>
            {activeTeam && (
              <p className="slds-text-color_weak slds-truncate" title={activeTeam.team.name}>
                {`${activeTeam.team.name} · ${TEAM_ROLE_LABELS[activeTeam.role] ?? activeTeam.role}`}
              </p>
            )}
          </div>
        </div>
        {actions && <div css={actionsCss}>{actions}</div>}
      </div>
    </SettingsGroup>
  );
};

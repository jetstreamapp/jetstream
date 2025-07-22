import { TITLES } from '@jetstream/shared/constants';
import { getTeam, updateTeamLoginConfiguration } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import {
  TeamGlobalAction,
  TeamLoginConfig,
  TeamLoginConfigRequest,
  TeamLoginConfigSchema,
  TeamTableAction,
  TeamUserFacing,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { TeamLoginConfiguration } from './TeamLoginConfiguration';
import { TeamMemberAuthActivityModal } from './TeamMemberAuthActivityModal';
import { TeamMemberInviteModal } from './TeamMemberInviteModal';
import { TeamMemberSessionModal } from './TeamMemberSessionModal';
import { TeamMembersTable } from './team-members/TeamMembersTable';

const HEIGHT_BUFFER = 170;

export function TeamDashboard() {
  useTitle(TITLES.TEAM);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamUserFacing>();
  const [loginConfiguration, setLoginConfiguration] = useState<TeamLoginConfig>();
  const [loginConfigurationKey, setLoginConfigurationKey] = useState(new Date().getTime());
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const userProfile = useRecoilValue(fromAppState.userProfileState);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [teamSessionModalOpen, setTeamSessionModalOpen] = useState(false);
  const [teamAuthActivityModalOpen, setTeamAuthActivityModalOpen] = useState(false);

  useEffect(() => {
    getTeam()
      .then((team) => {
        setTeam(team);
        setLoginConfiguration(team.loginConfig || TeamLoginConfigSchema.parse({}));
      })
      .catch((error) => {
        setLoadingError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleLoginConfigurationUpdate(loginConfiguration: TeamLoginConfigRequest) {
    if (!team?.id) {
      throw new Error('Team Id is required.');
    }

    // TODO: based on configuration, show warning (e.g. linked identities may be removed etc..);

    const updatedTeam = await updateTeamLoginConfiguration(team.id, loginConfiguration);
    setTeam(updatedTeam);
    const loginConfig = TeamLoginConfigSchema.parse(updatedTeam.loginConfig || {});
    setLoginConfiguration(loginConfig);
    setLoginConfigurationKey(new Date().getTime());
  }

  async function handleTeamGlobalAction(action: TeamGlobalAction) {
    switch (action) {
      case 'team-member-invite': {
        setInviteModalOpen(true);
        break;
      }
      case 'view-auth-activity': {
        setTeamAuthActivityModalOpen(true);
        break;
      }
      case 'view-user-sessions': {
        setTeamSessionModalOpen(true);
        break;
      }
    }
  }

  async function handleUserAction(payload: TeamTableAction) {
    // todo: implement user actions
  }

  return (
    <>
      {team && inviteModalOpen && (
        <TeamMemberInviteModal
          teamId={team.id}
          onClose={(invitations) => {
            // TODO: invitations
            setInviteModalOpen(false);
          }}
        />
      )}
      {team && teamSessionModalOpen && <TeamMemberSessionModal teamId={team.id} onClose={() => setTeamSessionModalOpen(false)} />}
      {team && teamAuthActivityModalOpen && (
        <TeamMemberAuthActivityModal teamId={team.id} onClose={() => setTeamAuthActivityModalOpen(false)} />
      )}

      <Page testId="billing-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={{ type: 'standard', icon: 'team_member' }}
              label="Team Dashboard"
              docsPath={APP_ROUTES.TEAM_DASHBOARD.DOCS}
            />
            <PageHeaderActions colType="actions" buttonType="separate">
              <form method="POST" action="/api/billing/portal" target="_blank">
                <button className="slds-button slds-button_neutral">
                  Go to Billing Portal
                  <Icon type="utility" icon="new_window" className="slds-button__icon slds-m-left_x-small" omitContainer />
                </button>
              </form>
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
          {loading && <Spinner />}
          {loadingError && (
            <ScopedNotification theme="error" className="slds-m-vertical_medium">
              There was a problem loading your team. Try again or file a support ticket for assistance.
            </ScopedNotification>
          )}

          <div className="slds-m-bottom_medium">
            {loginConfiguration && (
              <TeamLoginConfiguration
                key={loginConfigurationKey}
                loginConfiguration={loginConfiguration}
                onUpdate={handleLoginConfigurationUpdate}
              />
            )}
          </div>

          <div className="slds-m-bottom_medium">
            {team && (
              <TeamMembersTable
                teamMembers={team.members}
                invitations={team.invitations}
                userProfile={userProfile}
                onGlobalAction={handleTeamGlobalAction}
                onUserAction={handleUserAction}
              />
            )}
          </div>
        </AutoFullHeightContainer>
      </Page>
    </>
  );
}

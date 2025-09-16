import { TITLES } from '@jetstream/shared/constants';
import { cancelInvitation, getTeam, resendInvitation, updateTeamLoginConfiguration, updateTeamMemberStatus } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamBillingStatusSchema,
  TeamGlobalAction,
  TeamLoginConfig,
  TeamLoginConfigRequest,
  TeamLoginConfigSchema,
  TeamMemberRoleSchema,
  TeamTableAction,
  TeamUserFacing,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConfirmationModalPromise,
  fireToast,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { abilityState, fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamMembersTable } from './team-members/TeamMembersTable';
import { TeamLoginConfiguration } from './TeamLoginConfiguration';
import { TeamMemberAuthActivityModal } from './TeamMemberAuthActivityModal';
import { TeamMemberInviteModal } from './TeamMemberInviteModal';
import { TeamMemberSessionModal } from './TeamMemberSessionModal';
import { TeamMemberUpdateModal } from './TeamMemberUpdateModal';
import { TeamName } from './TeamName';

type TeamMemberEditModalState = { open: false } | { open: true; teamMember: TeamUserFacing['members'][number] };

const HEIGHT_BUFFER = 170;

export function TeamDashboard() {
  useTitle(TITLES.TEAM);
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamUserFacing>();
  const [loginConfiguration, setLoginConfiguration] = useState<TeamLoginConfig>();
  const [loginConfigurationKey, setLoginConfigurationKey] = useState(new Date().getTime());
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const userProfile = useAtomValue(fromAppState.userProfileState);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [teamSessionModalOpen, setTeamSessionModalOpen] = useState(false);
  const [teamAuthActivityModalOpen, setTeamAuthActivityModalOpen] = useState(false);
  const [teamMemberUpdateState, setTeamMemberUpdateState] = useState<TeamMemberEditModalState>({ open: false });

  const canReadAuthActivity = ability.can('read', 'TeamMemberAuthActivity');
  const canReadSession = ability.can('read', 'TeamMemberSession');

  const hasManualBilling = !!team?.billingAccount?.manualBilling;

  const availableLicenses = useMemo(() => {
    const licenseCountLimit = team?.billingAccount?.licenseCountLimit ?? Infinity;
    const billableUserCount = team?.members.filter(
      ({ status, role }) => status === TEAM_MEMBER_STATUS_ACTIVE && role !== TeamMemberRoleSchema.Enum.BILLING,
    ).length;
    const billableInviteCount = team?.invitations.filter(({ role }) => role !== TeamMemberRoleSchema.Enum.BILLING).length;
    const billableUserCountWithInvites = (billableUserCount || 0) + (billableInviteCount || 0);
    const availableLicenses = licenseCountLimit - billableUserCountWithInvites;
    return availableLicenses;
  }, [team]);

  const fetchTeam = useCallback(async () => {
    try {
      if (!userProfile.teamMembership?.team?.id) {
        return null;
      }
      const teamData = await getTeam(userProfile.teamMembership.team.id);
      setTeam(teamData);
      setLoginConfiguration(teamData.loginConfig || TeamLoginConfigSchema.parse({}));
    } catch (error) {
      setLoadingError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

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

  async function handleUserAction(action: TeamTableAction) {
    try {
      if (!team) {
        return null;
      }
      // todo: implement user actions
      switch (action.type) {
        case 'MEMBER': {
          switch (action.action) {
            case 'deactivate': {
              if (
                await ConfirmationModalPromise({
                  content: (
                    <>
                      {!hasManualBilling && action.member.role !== 'BILLING' && (
                        <ScopedNotification theme="info">
                          Once deactivated, this user will not count towards your overall user limit. Depending on your plan, a credit may
                          be generated which will apply to future invoices.
                        </ScopedNotification>
                      )}
                      <p className="slds-m-top_x-small">
                        Are you sure you want to deactivate <strong>{action.member.user.name}</strong>?
                      </p>
                      <p>After deactivating, all sessions will be revoked and this user will no longer be able to login to Jetstream.</p>
                    </>
                  ),
                })
              ) {
                await updateTeamMemberStatus(team.id, action.member.userId, { status: 'INACTIVE' }).then((teamData) => setTeam(teamData));
                fireToast({
                  message: `Successfully deactivated member`,
                  type: 'success',
                });
              }
              break;
            }
            case 'reactivate': {
              if (
                await ConfirmationModalPromise({
                  content: (
                    <>
                      {!hasManualBilling && action.member.role !== 'BILLING' && (
                        <ScopedNotification theme="info">
                          Once activated, billing will be restarted for this user and depending on your plan and user count, additional
                          charges may apply.
                        </ScopedNotification>
                      )}
                      <p className="slds-m-top_x-small">
                        Are you sure you want to reactivate <strong>{action.member.user.name}</strong>?
                      </p>
                    </>
                  ),
                })
              ) {
                await updateTeamMemberStatus(team.id, action.member.userId, { status: 'ACTIVE' }).then((teamData) => setTeam(teamData));
                fireToast({
                  message: `Successfully reactivated member`,
                  type: 'success',
                });
              }
              break;
            }
            case 'edit': {
              setTeamMemberUpdateState({ open: true, teamMember: action.member });
              break;
            }
          }
          break;
        }
        case 'INVITATION': {
          switch (action.action) {
            case 'resend-invite': {
              await resendInvitation(team.id, action.invitation.id);
              fetchTeam();
              fireToast({ message: 'Successfully resent invitation', type: 'success' });
              break;
            }
            case 'cancel-invite': {
              await cancelInvitation(team.id, action.invitation.id);
              fetchTeam();
              fireToast({ message: 'Successfully canceled invitation', type: 'success' });
              break;
            }
          }
          break;
        }
      }
    } catch (error) {
      // Handle error
      fireToast({
        message: `There was a problem performing the action: ${getErrorMessage(error)}`,
        type: 'error',
      });
    }
  }

  return (
    <>
      {team && inviteModalOpen && (
        <TeamMemberInviteModal
          teamId={team.id}
          hasManualBilling={hasManualBilling}
          onClose={(invitations) => {
            fetchTeam();
            setInviteModalOpen(false);
          }}
        />
      )}
      {canReadSession && team && teamSessionModalOpen && (
        <TeamMemberSessionModal teamId={team.id} onClose={() => setTeamSessionModalOpen(false)} />
      )}
      {canReadAuthActivity && team && teamAuthActivityModalOpen && (
        <TeamMemberAuthActivityModal teamId={team.id} onClose={() => setTeamAuthActivityModalOpen(false)} />
      )}
      {team && teamMemberUpdateState.open && (
        <TeamMemberUpdateModal
          teamId={team.id}
          hasManualBilling={hasManualBilling}
          teamMember={teamMemberUpdateState.teamMember}
          onClose={(teamData) => {
            if (teamData) {
              setTeam(teamData);
            }
            setTeamMemberUpdateState({ open: false });
          }}
        />
      )}

      <Page testId="team-dashboard-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={{ type: 'standard', icon: 'team_member' }}
              label="Team Dashboard"
              docsPath={APP_ROUTES.TEAM_DASHBOARD.DOCS}
            />
            <PageHeaderActions colType="actions" buttonType="separate">
              <Link to="/settings/billing" className="slds-button slds-button_neutral">
                Go to Billing
              </Link>
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

          {team && (
            <>
              {team.billingStatus === TeamBillingStatusSchema.Enum.PAST_DUE && (
                <ScopedNotification theme="warning" className="slds-m-bottom_medium">
                  You do not have any active subscriptions and may have a past-due invoice, your team will be cancelled if service is not
                  resumed.
                  <br />
                  Go to the billing page to resume service or contact support for assistance.
                </ScopedNotification>
              )}
              {!availableLicenses && (
                <ScopedNotification theme="light">
                  You have used all of your available licenses. To add additional users, deactivate existing users or contact support to
                  purchase more licenses.
                </ScopedNotification>
              )}
              <TeamName team={team} onSave={(updatedTeam) => setTeam(updatedTeam)} />
            </>
          )}

          <div data-testid="team-login-configuration-container" className="slds-m-bottom_medium">
            {loginConfiguration && (
              <TeamLoginConfiguration
                key={loginConfigurationKey}
                loginConfiguration={loginConfiguration}
                onUpdate={handleLoginConfigurationUpdate}
              />
            )}
          </div>

          <div data-testid="team-member-table-container" className="slds-m-bottom_medium">
            {team && (
              <TeamMembersTable
                loginConfiguration={team.loginConfig}
                billingStatus={team.billingStatus}
                availableLicenses={availableLicenses}
                hasManualBilling={!hasManualBilling}
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

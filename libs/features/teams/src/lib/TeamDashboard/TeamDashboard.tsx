import { LoginConfigurationWithCallbacks } from '@jetstream/auth/types';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  cancelInvitation,
  getDomainVerifications,
  getSsoConfiguration,
  getTeam,
  resendInvitation,
  updateTeamLoginConfiguration,
} from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  DomainVerification,
  TEAM_BILLING_STATUS_PAST_DUE,
  TeamBillingStatusSchema,
  TeamGlobalAction,
  TeamLoginConfig,
  TeamLoginConfigRequest,
  TeamLoginConfigSchema,
  TeamMemberRoleSchema,
  TeamTableAction,
  TeamUserAction,
  TeamUserFacing,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  fireToast,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { SalesforceCanvasOrgs, useAmplitude } from '@jetstream/ui-core';
import { abilityState, fromAppState, useFeatureFlag } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { TeamSSOConfiguration } from './sso-configuration/TeamSSOConfiguration';
import { TeamMembersTable } from './team-members/TeamMembersTable';
import { getSeatBannerState } from './team-seats/team-seats.utils';
import { PAST_DUE_SEATS_HINT, TeamSeats } from './team-seats/TeamSeats';
import { TeamSeatsManageModal } from './team-seats/TeamSeatsManageModal';
import { TeamAuditLogModal } from './TeamAuditLogModal';
import { TeamDomainConfiguration } from './TeamDomainConfiguration';
import { TeamLoginConfiguration } from './TeamLoginConfiguration';
import { TeamMemberAuthActivityModal } from './TeamMemberAuthActivityModal';
import { TeamMemberInviteModal } from './TeamMemberInviteModal';
import { TeamMemberSessionModal } from './TeamMemberSessionModal';
import { TeamMemberStatusUpdateModal } from './TeamMemberStatusUpdateModal';
import { TeamMemberUpdateModal } from './TeamMemberUpdateModal';
import { TeamName } from './TeamName';

type TeamMemberEditModalState = { open: false } | { open: true; teamMember: TeamUserFacing['members'][number] };
type TeamMemberEditStatusModalState =
  | { open: false }
  | { open: true; action: TeamUserAction; teamMember: TeamUserFacing['members'][number] };

const HEIGHT_BUFFER = 170;

export function TeamDashboard() {
  useTitle(TITLES.TEAM);
  const { trackEvent } = useAmplitude();
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamUserFacing>();
  const [loginConfiguration, setLoginConfiguration] = useState<TeamLoginConfig>();
  const [loginConfigurationKey, setLoginConfigurationKey] = useState(new Date().getTime());
  const [domains, setDomains] = useState<DomainVerification[] | null>([]);
  const [ssoConfig, setSsoConfig] = useState<LoginConfigurationWithCallbacks | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const userProfile = useAtomValue(fromAppState.userProfileState);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [teamSessionModalOpen, setTeamSessionModalOpen] = useState(false);
  const [teamAuthActivityModalOpen, setTeamAuthActivityModalOpen] = useState(false);
  const [teamAuditLogModalOpen, setTeamAuditLogModalOpen] = useState(false);
  const [manageSeatsModalOpen, setManageSeatsModalOpen] = useState(false);
  const [teamMemberUpdateState, setTeamMemberUpdateState] = useState<TeamMemberEditModalState>({ open: false });
  const [teamMemberStatusUpdateState, setTeamMemberStatusUpdateState] = useState<TeamMemberEditStatusModalState>({ open: false });

  const canvasEnabled = useFeatureFlag('salesforce-canvas');
  // Team members' Canvas access is gated by the team entitlement (resolved onto the profile), and only
  // team admins may manage the authorized-orgs list.
  const showCanvasOrgs = canvasEnabled && userProfile.entitlements.salesforceCanvas;
  const isTeamAdmin = userProfile.teamMembership?.role === TeamMemberRoleSchema.enum.ADMIN;

  const canReadDomainConfiguration = ability.can('read', 'DomainConfiguration');
  const canReadSsoConfiguration = ability.can('read', 'SsoConfiguration');
  const canReadAuthActivity = ability.can('read', 'TeamMemberAuthActivity');
  const canReadSession = ability.can('read', 'TeamMemberSession');
  const canReadAuditLog = ability.can('read', 'AuditLog');

  const hasManualBilling = !!team?.billingAccount?.manualBilling;
  // Manual-billing seat limits are set by agreement, so only self-serve teams get the Manage Seats flow.
  // Past-due standing disables the button in place rather than hiding it, so it is not part of this check.
  const canManageSeats = ability.can('update', 'TeamSeats') && !hasManualBilling;
  const isPastDue = team?.billingStatus === TEAM_BILLING_STATUS_PAST_DUE;
  const seats = team?.seats ?? null;
  const seatBanner = getSeatBannerState(seats, hasManualBilling);
  const hasVerifiedDomain = useMemo(() => {
    return domains?.some((domain) => domain.status === 'VERIFIED') || false;
  }, [domains]);

  const teamId = userProfile.teamMembership?.team?.id;
  const hasSsoConfigured = !ssoConfig || ssoConfig.ssoProvider !== 'NONE';
  const configuredSsoProvider = ssoConfig && ssoConfig.ssoProvider !== 'NONE' && ssoConfig.ssoEnabled ? ssoConfig.ssoProvider : null;
  const ssoIsOnlyLoginProvider = !!configuredSsoProvider && loginConfiguration?.allowedProviders.length === 0;

  const fetchTeam = useCallback(async () => {
    try {
      if (!teamId) {
        return;
      }
      const teamData = await getTeam(teamId);
      setTeam(teamData);
      setLoginConfiguration(teamData.loginConfig || TeamLoginConfigSchema.parse({}));
    } catch (error) {
      setLoadingError(getErrorMessage(error));
    }
  }, [teamId]);

  const fetchSsoConfig = useCallback(async () => {
    try {
      if (!teamId || !canReadSsoConfiguration) {
        return;
      }
      const data = await getSsoConfiguration(teamId);
      setSsoConfig(data);
    } catch (error) {
      setLoadingError(getErrorMessage(error));
    }
  }, [teamId, canReadSsoConfiguration]);

  const fetchDomains = useCallback(async () => {
    try {
      if (!teamId || !canReadDomainConfiguration) {
        return;
      }
      const data = await getDomainVerifications(teamId);
      setDomains(data);
    } catch (error) {
      setLoadingError(getErrorMessage(error));
    }
  }, [teamId, canReadDomainConfiguration]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.allSettled([fetchTeam(), fetchSsoConfig(), fetchDomains()]).finally(() => setLoading(false));
  }, [fetchTeam, fetchSsoConfig, fetchDomains]);

  async function handleLoginConfigurationUpdate(loginConfiguration: TeamLoginConfigRequest) {
    if (!team?.id) {
      throw new Error('Team Id is required.');
    }

    const updatedTeam = await updateTeamLoginConfiguration(team.id, loginConfiguration);
    setTeam(updatedTeam);
    const loginConfig = TeamLoginConfigSchema.parse(updatedTeam.loginConfig || {});
    setLoginConfiguration(loginConfig);
    setLoginConfigurationKey(new Date().getTime());
  }

  function openManageSeats(source: string) {
    if (!canManageSeats) {
      return;
    }
    trackEvent(ANALYTICS_KEYS.team_seats_modal_open, { source });
    setManageSeatsModalOpen(true);
  }

  /** "Buy more seats" inside a member modal: dismiss whichever modal is open, then open Manage Seats. */
  function openManageSeatsFromModal() {
    setInviteModalOpen(false);
    setTeamMemberUpdateState({ open: false });
    setTeamMemberStatusUpdateState({ open: false });
    openManageSeats('member-modal');
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
      case 'view-audit-log': {
        setTeamAuditLogModalOpen(true);
        break;
      }
      case 'manage-seats': {
        openManageSeats('dashboard');
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
              setTeamMemberStatusUpdateState({ open: true, action: 'deactivate', teamMember: action.member });
              break;
            }
            case 'reactivate': {
              setTeamMemberStatusUpdateState({ open: true, action: 'reactivate', teamMember: action.member });
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

  function handleDomainChange(action: 'ADD' | 'VERIFY' | 'DELETE', domain: DomainVerification) {
    fetchDomains();
    setDomains((prevDomains) => {
      if (!prevDomains) return prevDomains;
      if (action === 'ADD') {
        return prevDomains.concat(domain);
      }
      if (action === 'VERIFY') {
        return prevDomains.map((d) => (d.id === domain.id ? domain : d));
      }
      if (action === 'DELETE') {
        return prevDomains.filter(({ id }) => id !== domain.id);
      }
      return prevDomains;
    });
  }

  return (
    <>
      {team && inviteModalOpen && (
        <TeamMemberInviteModal
          teamId={team.id}
          hasManualBilling={hasManualBilling}
          userRole={userProfile.teamMembership?.role || TeamMemberRoleSchema.enum.MEMBER}
          seats={seats}
          canManageSeats={canManageSeats}
          isPastDue={isPastDue}
          onBuySeats={openManageSeatsFromModal}
          onClose={(_invitations) => {
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
      {canReadAuditLog && team && teamAuditLogModalOpen && (
        <TeamAuditLogModal teamId={team.id} onClose={() => setTeamAuditLogModalOpen(false)} />
      )}
      {team && seats && canManageSeats && manageSeatsModalOpen && (
        <TeamSeatsManageModal
          teamId={team.id}
          seats={seats}
          onClose={(updatedTeam) => {
            if (updatedTeam) {
              setTeam(updatedTeam);
            }
            setManageSeatsModalOpen(false);
          }}
        />
      )}
      {team && teamMemberUpdateState.open && (
        <TeamMemberUpdateModal
          teamId={team.id}
          hasManualBilling={hasManualBilling}
          teamMember={teamMemberUpdateState.teamMember}
          currentUserRole={userProfile.teamMembership?.role}
          seats={seats}
          canManageSeats={canManageSeats}
          isPastDue={isPastDue}
          onBuySeats={openManageSeatsFromModal}
          onClose={(teamData) => {
            if (teamData) {
              setTeam(teamData);
            }
            setTeamMemberUpdateState({ open: false });
          }}
        />
      )}
      {team && teamMemberStatusUpdateState.open && (
        <TeamMemberStatusUpdateModal
          teamId={team.id}
          action={teamMemberStatusUpdateState.action}
          hasManualBilling={hasManualBilling}
          teamMember={teamMemberStatusUpdateState.teamMember}
          seats={seats}
          canManageSeats={canManageSeats}
          isPastDue={isPastDue}
          onBuySeats={openManageSeatsFromModal}
          onClose={(teamData) => {
            if (teamData) {
              setTeam(teamData);
            }
            setTeamMemberStatusUpdateState({ open: false });
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
              {canReadAuditLog && (
                <button className="slds-button slds-button_neutral" onClick={() => handleTeamGlobalAction('view-audit-log')}>
                  View Audit Logs
                </button>
              )}
              <Link to={APP_ROUTES.BILLING.ROUTE} className="slds-button slds-button_neutral">
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
              {team.billingStatus === TeamBillingStatusSchema.enum.PAST_DUE && (
                <ScopedNotification theme="warning" className="slds-m-bottom_medium">
                  You do not have any active subscriptions and may have a past-due invoice, your team will be cancelled if service is not
                  resumed.
                  <br />
                  Go to the billing page to resume service or contact support for assistance.
                </ScopedNotification>
              )}
              {seatBanner && (
                <div data-testid="team-seats-banner" className="slds-m-bottom_medium">
                  <ScopedNotification theme={seatBanner.theme}>
                    {seatBanner.message}
                    {canManageSeats && (
                      <button
                        type="button"
                        className="slds-button slds-button_neutral slds-m-left_small"
                        disabled={isPastDue}
                        title={isPastDue ? PAST_DUE_SEATS_HINT : undefined}
                        onClick={() => handleTeamGlobalAction('manage-seats')}
                      >
                        Manage Seats
                      </button>
                    )}
                  </ScopedNotification>
                </div>
              )}
              <TeamName team={team} onSave={(updatedTeam) => setTeam(updatedTeam)} />
              {seats && (
                <TeamSeats
                  seats={seats}
                  billingStatus={team.billingStatus}
                  hasManualBilling={hasManualBilling}
                  canManageSeats={canManageSeats}
                  onManageSeats={() => handleTeamGlobalAction('manage-seats')}
                />
              )}
            </>
          )}

          <div data-testid="team-login-configuration-container" className="slds-m-bottom_medium">
            {loginConfiguration && (
              <TeamLoginConfiguration
                key={loginConfigurationKey}
                loginConfiguration={loginConfiguration}
                hasSsoConfigured={hasSsoConfigured}
                ssoIsActive={hasSsoConfigured && !!ssoConfig?.ssoEnabled}
                onUpdate={handleLoginConfigurationUpdate}
              />
            )}
          </div>

          {team && domains && (
            <TeamDomainConfiguration teamId={team.id} domains={domains} hasSsoEnabled={hasSsoConfigured} onChange={handleDomainChange} />
          )}

          {team && showCanvasOrgs && <SalesforceCanvasOrgs scope={{ type: 'team', teamId: team.id }} canManage={isTeamAdmin} />}

          {team && ssoConfig && (
            <div data-testid="team-sso-configuration-container" className="slds-m-bottom_medium">
              <TeamSSOConfiguration
                teamId={team.id}
                hasVerifiedDomain={hasVerifiedDomain}
                ssoIsOnlyLoginProvider={ssoIsOnlyLoginProvider}
                ssoConfig={ssoConfig}
                onSsoConfigChange={setSsoConfig}
                reloadConfig={fetchSsoConfig}
              />
            </div>
          )}

          <div data-testid="team-member-table-container" className="slds-m-bottom_xx-large">
            {team && (
              <TeamMembersTable
                loginConfiguration={team.loginConfig}
                billingStatus={team.billingStatus}
                seats={seats}
                hasManualBilling={hasManualBilling}
                teamMembers={team.members}
                invitations={team.invitations}
                userProfile={userProfile}
                configuredSsoProvider={configuredSsoProvider}
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

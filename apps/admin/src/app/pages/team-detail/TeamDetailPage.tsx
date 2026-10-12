import { ProvisionTeamResponse, StripeLinkResult, TeamDetail } from '@jetstream/admin/types';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { apiPost, useApiQuery } from '../../api/admin-api-client';
import { AuditLogTable } from '../../components/AuditLogTable';
import { BooleanBadge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EntitlementList } from '../../components/EntitlementList';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { KeyValueList } from '../../components/KeyValueList';
import { PageHeader } from '../../components/PageHeader';
import { PageSpinner } from '../../components/Spinner';
import { SubscriptionTable } from '../../components/SubscriptionTable';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { formatDate, formatDateTime } from '../../utils/format';
import { StripeLinkResultAlert } from './StripeLinkResultAlert';
import { TeamBillingCard } from './TeamBillingCard';
import { TeamDomainsCard } from './TeamDomainsCard';
import { TeamInvitationsCard } from './TeamInvitationsCard';
import { TeamMembersCard } from './TeamMembersCard';

/** Navigation state set by the provisioning wizard after it creates a team */
export interface TeamDetailLocationState {
  provisionResult?: ProvisionTeamResponse;
}

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { provisionResult } = (location.state as TeamDetailLocationState | null) ?? {};
  const { data: team, error, loading, reload } = useApiQuery<TeamDetail>(teamId ? `/api/teams/${teamId}` : null);
  const {
    run: retryStripeLink,
    loading: retryingStripeLink,
    error: retryStripeLinkError,
  } = useAsyncAction(() => apiPost<StripeLinkResult>(`/api/teams/${teamId}/stripe-link`));

  async function handleRetryStripeLink() {
    const stripeLinkResult = await retryStripeLink();
    if (stripeLinkResult && provisionResult) {
      // Keep the provisioning banner in history state so a reload shows the latest outcome
      const nextState: TeamDetailLocationState = { provisionResult: { ...provisionResult, stripe: stripeLinkResult } };
      navigate(location.pathname, { replace: true, state: nextState });
      reload();
    }
  }

  if (!team) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load team" onRetry={reload} />;
    }
    return <PageSpinner />;
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/teams" className="hover:underline">
            Teams
          </Link>
        }
        title={team.name}
        badges={
          <>
            <StatusBadge status={team.status} />
            <StatusBadge status={team.billingStatus} />
          </>
        }
        subtitle={`Created ${formatDate(team.createdAt)}`}
        actions={
          <Button size="sm" onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      {provisionResult && (
        <div className="mb-4 space-y-2">
          <Alert tone="success" title="Team provisioned">
            No email has been sent. Invite or add the first admin below when you are ready.
          </Alert>
          <StripeLinkResultAlert
            result={provisionResult.stripe}
            actions={
              provisionResult.stripe.error ? (
                <Button size="sm" onClick={handleRetryStripeLink} loading={retryingStripeLink}>
                  Retry Stripe link
                </Button>
              ) : undefined
            }
          />
          {retryStripeLinkError && <ErrorAlert error={retryStripeLinkError} title="Retry failed" />}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} title="Unable to refresh team" onRetry={reload} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TeamMembersCard team={team} onChanged={reload} />
          <TeamInvitationsCard team={team} onChanged={reload} />
          <Card title="Subscriptions" flush>
            <SubscriptionTable subscriptions={team.subscriptions} />
          </Card>
          <Card title="Recent audit log" flush>
            <AuditLogTable auditLogs={team.auditLogs} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Team">
            <KeyValueList
              items={[
                { label: 'Team id', value: <span className="font-mono text-xs">{team.id}</span> },
                { label: 'Status', value: <StatusBadge status={team.status} /> },
                { label: 'Billing status', value: <StatusBadge status={team.billingStatus} /> },
                { label: 'Created', value: formatDateTime(team.createdAt) },
                { label: 'Updated', value: formatDateTime(team.updatedAt) },
              ]}
            />
          </Card>
          <TeamBillingCard team={team} onChanged={reload} />
          <Card title="Entitlements" description="Synced from the Stripe subscription's entitlements">
            <EntitlementList entitlements={team.entitlements} />
          </Card>
          <TeamDomainsCard team={team} onChanged={reload} />
          <Card title="Login configuration">
            {team.loginConfig ? (
              <KeyValueList
                items={[
                  { label: 'Require MFA', value: <BooleanBadge value={team.loginConfig.requireMfa} /> },
                  {
                    label: 'SSO',
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        {team.loginConfig.ssoProvider}
                        <BooleanBadge value={team.loginConfig.ssoEnabled} trueLabel="Enabled" falseLabel="Disabled" />
                      </span>
                    ),
                  },
                  { label: 'Auto-add by domain', value: <BooleanBadge value={team.loginConfig.autoAddToTeam} /> },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">No login configuration</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

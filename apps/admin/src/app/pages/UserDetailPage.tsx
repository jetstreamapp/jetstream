import { UserDetail } from '@jetstream/admin/types';
import { Link, useParams } from 'react-router';
import { useApiQuery } from '../api/admin-api-client';
import { AuditLogTable } from '../components/AuditLogTable';
import { Badge, BooleanBadge, StatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EntitlementList } from '../components/EntitlementList';
import { ErrorAlert } from '../components/ErrorAlert';
import { StripeIdLink } from '../components/ExternalLink';
import { KeyValueList } from '../components/KeyValueList';
import { PageHeader } from '../components/PageHeader';
import { PageSpinner } from '../components/Spinner';
import { SubscriptionTable } from '../components/SubscriptionTable';
import { Table } from '../components/Table';
import {
  EMPTY_VALUE,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  getStripeDashboardUrl,
  isDateInPast,
} from '../utils/format';

function UserAgentCell({ userAgent }: { userAgent: string | null }) {
  if (!userAgent) {
    return <>{EMPTY_VALUE}</>;
  }
  return (
    <span title={userAgent} className="block max-w-xs truncate text-xs text-slate-500">
      {userAgent}
    </span>
  );
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data: user, error, loading, reload } = useApiQuery<UserDetail>(userId ? `/api/users/${userId}` : null);

  if (!user) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load user" onRetry={reload} />;
    }
    return <PageSpinner />;
  }

  const isLocked = !!user.lockedUntil && !isDateInPast(user.lockedUntil);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/users" className="hover:underline">
            Users
          </Link>
        }
        title={user.email}
        subtitle={user.name}
        badges={
          <>
            {!user.emailVerified && <Badge tone="amber">Unverified</Badge>}
            {isLocked && <Badge tone="red">Locked</Badge>}
            {user.forcePasswordReset && <Badge tone="amber">Password reset required</Badge>}
          </>
        }
        actions={
          <Button size="sm" onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} title="Unable to refresh user" onRetry={reload} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Web sessions (${user.webSessions.length})`} flush>
            <Table
              rows={user.webSessions}
              getRowKey={(session) => `${session.createdAt}-${session.expiresAt}-${session.ipAddress}`}
              emptyMessage="No active web sessions"
              columns={[
                {
                  key: 'loginTime',
                  header: 'Signed in',
                  className: 'whitespace-nowrap',
                  render: ({ loginTime, createdAt }) => formatDateTime(loginTime ?? createdAt),
                },
                { key: 'provider', header: 'Provider', render: ({ provider }) => provider ?? EMPTY_VALUE },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: ({ ipAddress }) => <span className="font-mono text-xs">{ipAddress ?? EMPTY_VALUE}</span>,
                },
                { key: 'userAgent', header: 'User agent', render: ({ userAgent }) => <UserAgentCell userAgent={userAgent} /> },
                {
                  key: 'expiresAt',
                  header: 'Expires',
                  className: 'whitespace-nowrap',
                  render: ({ expiresAt }) => formatRelative(expiresAt),
                },
              ]}
            />
          </Card>
          <Card title={`Extension and desktop sessions (${user.externalSessions.length})`} flush>
            <Table
              rows={user.externalSessions}
              getRowKey={({ id }) => id}
              emptyMessage="No extension or desktop sessions"
              columns={[
                { key: 'source', header: 'Source', render: ({ source }) => source },
                { key: 'platform', header: 'Platform', render: ({ platform }) => platform ?? EMPTY_VALUE },
                { key: 'appVersion', header: 'Version', render: ({ appVersion }) => appVersion ?? EMPTY_VALUE },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: ({ ipAddress }) => <span className="font-mono text-xs">{ipAddress ?? EMPTY_VALUE}</span>,
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  className: 'whitespace-nowrap',
                  render: ({ createdAt }) => formatDateTime(createdAt),
                },
                {
                  key: 'expiresAt',
                  header: 'Expires',
                  className: 'whitespace-nowrap',
                  render: ({ expiresAt }) => formatRelative(expiresAt),
                },
              ]}
            />
          </Card>
          <Card title="Login activity" flush>
            <Table
              rows={user.loginActivity}
              getRowKey={({ id }) => id}
              emptyMessage="No login activity"
              columns={[
                { key: 'createdAt', header: 'When', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDateTime(createdAt) },
                { key: 'action', header: 'Action', render: ({ action }) => <span className="font-mono text-xs">{action}</span> },
                { key: 'method', header: 'Method', render: ({ method }) => method ?? EMPTY_VALUE },
                {
                  key: 'success',
                  header: 'Result',
                  render: ({ success, errorMessage }) =>
                    success ? (
                      <Badge tone="green">Success</Badge>
                    ) : (
                      <Badge tone="red" title={errorMessage ?? undefined}>
                        Failed
                      </Badge>
                    ),
                },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: ({ ipAddress }) => <span className="font-mono text-xs">{ipAddress ?? EMPTY_VALUE}</span>,
                },
                { key: 'userAgent', header: 'User agent', render: ({ userAgent }) => <UserAgentCell userAgent={userAgent} /> },
              ]}
            />
          </Card>
          <Card title="Subscriptions" flush>
            <SubscriptionTable subscriptions={user.subscriptions} />
          </Card>
          <Card title="Recent audit log" flush>
            <AuditLogTable auditLogs={user.auditLogs} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Profile">
            <KeyValueList
              items={[
                { label: 'User id', value: <span className="font-mono text-xs">{user.id}</span> },
                { label: 'Email verified', value: <BooleanBadge value={user.emailVerified} /> },
                { label: 'Created', value: formatDateTime(user.createdAt) },
                { label: 'Last login', value: <span title={formatDateTime(user.lastLoggedIn)}>{formatRelative(user.lastLoggedIn)}</span> },
                { label: 'Password set', value: <BooleanBadge value={user.hasPasswordSet} /> },
                { label: 'Failed logins', value: formatNumber(user.failedLoginAttempts) },
                { label: 'Locked until', value: isLocked ? formatDateTime(user.lockedUntil) : EMPTY_VALUE },
                { label: 'Salesforce orgs', value: formatNumber(user.salesforceOrgCount) },
              ]}
            />
          </Card>
          <Card title="Team">
            {user.teamMembership ? (
              <KeyValueList
                items={[
                  {
                    label: 'Team',
                    value: (
                      <Link to={`/teams/${user.teamMembership.teamId}`} className="text-blue-700 hover:underline">
                        {user.teamMembership.teamName}
                      </Link>
                    ),
                  },
                  { label: 'Role', value: user.teamMembership.role },
                  { label: 'Status', value: <StatusBadge status={user.teamMembership.status} /> },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">Not on a team</p>
            )}
          </Card>
          <Card title="Billing">
            {user.billingAccount ? (
              <KeyValueList
                items={[
                  {
                    label: 'Stripe customer',
                    value: (
                      <StripeIdLink id={user.billingAccount.customerId} href={getStripeDashboardUrl(user.billingAccount.customerId)} />
                    ),
                  },
                  { label: 'Manual billing', value: <BooleanBadge value={user.billingAccount.manualBilling} /> },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">No personal billing account</p>
            )}
          </Card>
          <Card title="Entitlements" description="Personal entitlements; team entitlements apply while on an active team">
            <EntitlementList entitlements={user.entitlements} />
          </Card>
          <Card title="Sign-in methods">
            <div className="space-y-3">
              <Table
                rows={user.identities}
                getRowKey={({ provider, email, createdAt }) => `${provider}-${email}-${createdAt}`}
                emptyMessage="No linked identities"
                columns={[
                  {
                    key: 'provider',
                    header: 'Provider',
                    render: ({ provider, isPrimary }) => (
                      <span className="inline-flex items-center gap-1">
                        {provider}
                        {isPrimary && <Badge tone="blue">Primary</Badge>}
                      </span>
                    ),
                  },
                  { key: 'email', header: 'Email', render: ({ email }) => email ?? EMPTY_VALUE },
                  { key: 'createdAt', header: 'Linked', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDate(createdAt) },
                ]}
              />
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">MFA factors</p>
                {user.authFactors.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {user.authFactors.map(({ type, enabled }) => (
                      <li key={type}>
                        <Badge tone={enabled ? 'green' : 'gray'}>
                          {type}
                          {enabled ? '' : ' (off)'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">None</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

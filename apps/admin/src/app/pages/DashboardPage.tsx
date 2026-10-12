import { DashboardSummary } from '@jetstream/admin/types';
import { ReactNode } from 'react';
import { useApiQuery } from '../api/admin-api-client';
import { Button } from '../components/Button';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/PageHeader';
import { PageSpinner } from '../components/Spinner';
import { formatDateTime, formatNumber } from '../utils/format';

function KpiTile({ label, value, hint }: { label: string; value: number; hint?: ReactNode }) {
  return (
    <div className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{formatNumber(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function KpiSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

export function DashboardPage() {
  const { data: summary, error, loading, reload } = useApiQuery<DashboardSummary>('/api/dashboard');

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={summary ? `As of ${formatDateTime(summary.generatedAt)}` : undefined}
        actions={
          <Button size="sm" onClick={reload} loading={loading && !!summary}>
            Refresh
          </Button>
        }
      />
      {error && <ErrorAlert error={error} onRetry={reload} />}
      {!summary && loading && <PageSpinner />}
      {summary && (
        <>
          <KpiSection title="Users">
            <KpiTile label="Total users" value={summary.totalUsers} />
            <KpiTile label="New, last 7 days" value={summary.newUsersLast7Days} />
            <KpiTile label="New, last 30 days" value={summary.newUsersLast30Days} />
            <KpiTile label="Active, last 7 days" value={summary.activeUsersLast7Days} hint="Distinct users with a successful login" />
          </KpiSection>
          <KpiSection title="Sessions">
            <KpiTile label="Active web sessions" value={summary.activeWebSessions} />
            <KpiTile label="Users with a web session" value={summary.activeWebSessionUsers} />
            <KpiTile label="Extension and desktop sessions" value={summary.activeExternalSessions} />
            <KpiTile label="Salesforce orgs" value={summary.salesforceOrgs} />
          </KpiSection>
          <KpiSection title="Teams and billing">
            <KpiTile label="Teams" value={summary.totalTeams} />
            <KpiTile label="Active teams" value={summary.activeTeams} />
            <KpiTile label="Paying users" value={summary.payingUsers} />
            <KpiTile label="Paying teams" value={summary.payingTeams} />
          </KpiSection>
        </>
      )}
    </>
  );
}

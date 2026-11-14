import { FeatureFlagOverrides, FeatureFlagOverrideScope } from '@jetstream/admin/types';
import { Link, useParams } from 'react-router';
import { useApiQuery } from '../../api/admin-api-client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { OverrideBadge } from '../../components/OverrideBadge';
import { PageHeader } from '../../components/PageHeader';
import { PageSpinner } from '../../components/Spinner';
import { Table } from '../../components/Table';
import { useUpdateFeatureFlagOverrides } from '../../hooks/useUpdateFeatureFlagOverrides';
import { EMPTY_VALUE, formatDateTime } from '../../utils/format';
import { BulkOverrideCard } from './BulkOverrideCard';

export function FeatureFlagDetailPage() {
  const { flagKey } = useParams<{ flagKey: string }>();
  const {
    data: overrides,
    error,
    loading,
    reload,
  } = useApiQuery<FeatureFlagOverrides>(flagKey ? `/api/feature-flags/${encodeURIComponent(flagKey)}/overrides` : null);
  const { run: removeOverride, loading: removing, error: removeError } = useUpdateFeatureFlagOverrides();

  async function handleRemove(scope: FeatureFlagOverrideScope, id: string) {
    if (flagKey && (await removeOverride(flagKey, { scope, ids: [id], action: 'remove' }))) {
      reload();
    }
  }

  if (!overrides) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load feature flag" onRetry={reload} />;
    }
    return <PageSpinner />;
  }

  const { flag } = overrides;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/feature-flags" className="hover:underline">
            Feature flags
          </Link>
        }
        title={flag.key}
        subtitle={flag.description}
        badges={flag.defaultValue ? <Badge tone="green">On by default</Badge> : <Badge>Off by default</Badge>}
        actions={
          <Button size="sm" onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />
      {removeError && (
        <div className="mb-4">
          <ErrorAlert error={removeError} title="Unable to remove the override" />
        </div>
      )}
      <div className="space-y-4">
        <BulkOverrideCard flagKey={flag.key} onChanged={reload} />
        <Card title={`Teams with an override (${overrides.teams.length})`} flush>
          <Table
            rows={overrides.teams}
            getRowKey={({ teamId }) => teamId}
            emptyMessage="No team overrides"
            columns={[
              {
                key: 'name',
                header: 'Team',
                render: ({ teamId, name }) => (
                  <Link to={`/teams/${teamId}`} className="font-medium text-blue-700 hover:underline">
                    {name}
                  </Link>
                ),
              },
              { key: 'enabled', header: 'Override', render: ({ enabled }) => <OverrideBadge value={enabled} /> },
              { key: 'updatedAt', header: 'Updated', className: 'whitespace-nowrap', render: ({ updatedAt }) => formatDateTime(updatedAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                className: 'text-right',
                render: ({ teamId }) => (
                  <Button size="sm" onClick={() => handleRemove('team', teamId)} disabled={removing}>
                    Remove
                  </Button>
                ),
              },
            ]}
          />
        </Card>
        <Card title={`Users with an override (${overrides.users.length})`} flush>
          <Table
            rows={overrides.users}
            getRowKey={({ userId }) => userId}
            emptyMessage="No user overrides"
            columns={[
              {
                key: 'email',
                header: 'User',
                render: ({ userId, email, name }) => (
                  <div>
                    <Link to={`/users/${userId}`} className="font-medium text-blue-700 hover:underline">
                      {email}
                    </Link>
                    {name && <p className="text-xs text-slate-500">{name}</p>}
                  </div>
                ),
              },
              { key: 'enabled', header: 'Override', render: ({ enabled }) => <OverrideBadge value={enabled} /> },
              {
                key: 'team',
                header: 'Team',
                render: ({ teamId, teamName }) =>
                  teamId ? (
                    <Link to={`/teams/${teamId}`} className="text-blue-700 hover:underline">
                      {teamName}
                    </Link>
                  ) : (
                    EMPTY_VALUE
                  ),
              },
              { key: 'teamOverride', header: 'Team override', render: ({ teamOverride }) => <OverrideBadge value={teamOverride} /> },
              { key: 'updatedAt', header: 'Updated', className: 'whitespace-nowrap', render: ({ updatedAt }) => formatDateTime(updatedAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                className: 'text-right',
                render: ({ userId }) => (
                  <Button size="sm" onClick={() => handleRemove('user', userId)} disabled={removing}>
                    Remove
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

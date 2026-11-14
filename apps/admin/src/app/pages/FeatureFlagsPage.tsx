import { FeatureFlagSummary } from '@jetstream/admin/types';
import { Link } from 'react-router';
import { useApiQuery } from '../api/admin-api-client';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/PageHeader';
import { PageSpinner } from '../components/Spinner';
import { Table } from '../components/Table';
import { formatNumber } from '../utils/format';

export function FeatureFlagsPage() {
  const { data, error, loading, reload } = useApiQuery<FeatureFlagSummary[]>('/api/feature-flags');

  if (!data) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load feature flags" onRetry={reload} />;
    }
    return <PageSpinner />;
  }

  return (
    <>
      <PageHeader
        title="Feature flags"
        subtitle="Flags and their defaults are defined in code; overrides turn a flag on for a user or a whole team."
        actions={
          <Button size="sm" onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} title="Unable to refresh feature flags" onRetry={reload} />
        </div>
      )}
      <Card flush>
        <Table
          rows={data}
          getRowKey={({ key }) => key}
          columns={[
            {
              key: 'flag',
              header: 'Flag',
              render: ({ key }) => (
                <Link to={`/feature-flags/${key}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                  {key}
                </Link>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              render: ({ description }) => <span className="block max-w-xl text-slate-600">{description}</span>,
            },
            {
              key: 'default',
              header: 'Default',
              render: ({ defaultValue }) => (defaultValue ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>),
            },
            {
              key: 'users',
              header: 'User overrides',
              className: 'text-right tabular-nums',
              render: ({ userOverrideCount }) => formatNumber(userOverrideCount),
            },
            {
              key: 'teams',
              header: 'Team overrides',
              className: 'text-right tabular-nums',
              render: ({ teamOverrideCount }) => formatNumber(teamOverrideCount),
            },
          ]}
        />
      </Card>
    </>
  );
}

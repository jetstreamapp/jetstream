import { FeatureFlagEntityStatus, FeatureFlagOverrideAction, FeatureFlagOverrideScope } from '@jetstream/admin/types';
import { Link } from 'react-router';
import { useUpdateFeatureFlagOverrides } from '../hooks/useUpdateFeatureFlagOverrides';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { ErrorAlert } from './ErrorAlert';
import { OverrideBadge } from './OverrideBadge';
import { Table } from './Table';

export interface FeatureFlagStatusCardProps {
  scope: FeatureFlagOverrideScope;
  entityId: string;
  flags: FeatureFlagEntityStatus[];
  onChanged: () => void;
}

/** Every flag for one user or team, with its override, the team's override (users only) and the resolved value */
export function FeatureFlagStatusCard({ scope, entityId, flags, onChanged }: FeatureFlagStatusCardProps) {
  const { run: updateOverride, loading, error } = useUpdateFeatureFlagOverrides();

  async function handleUpdate(key: string, action: FeatureFlagOverrideAction) {
    if (await updateOverride(key, { scope, ids: [entityId], action })) {
      onChanged();
    }
  }

  return (
    <Card
      title="Feature flags"
      description={
        scope === 'user'
          ? 'A flag is on when its default, the team override or the user override is on. Remove an override to turn it off.'
          : 'Applies to every member of the team. Remove an override to turn it off.'
      }
      flush
    >
      {error && (
        <div className="p-3">
          <ErrorAlert error={error} title="Unable to update the feature flag" />
        </div>
      )}
      <Table
        rows={flags}
        getRowKey={({ key }) => key}
        emptyMessage="No feature flags are defined"
        columns={[
          {
            key: 'flag',
            header: 'Flag',
            render: ({ key, description }) => (
              <div>
                <Link to={`/feature-flags/${key}`} className="font-mono text-xs text-blue-700 hover:underline">
                  {key}
                </Link>
                <p className="mt-0.5 max-w-xs text-xs text-slate-500">{description}</p>
              </div>
            ),
          },
          {
            key: 'default',
            header: 'Default',
            render: ({ defaultValue }) => (defaultValue ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>),
          },
          ...(scope === 'user'
            ? [
                {
                  key: 'teamOverride',
                  header: 'Team override',
                  render: ({ teamOverride }: FeatureFlagEntityStatus) => <OverrideBadge value={teamOverride} />,
                },
              ]
            : []),
          {
            key: 'override',
            header: scope === 'user' ? 'User override' : 'Team override',
            render: ({ override }) => <OverrideBadge value={override} />,
          },
          {
            key: 'effective',
            header: 'Effective',
            render: ({ effective }) => (effective ? <Badge tone="green">Enabled</Badge> : <Badge>Disabled</Badge>),
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'text-right',
            render: ({ key, override, defaultValue }) =>
              override === null ? (
                <Button
                  size="sm"
                  onClick={() => handleUpdate(key, 'enable')}
                  disabled={loading || defaultValue}
                  title={defaultValue ? 'Already on by default' : undefined}
                >
                  Enable
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleUpdate(key, 'remove')} disabled={loading}>
                  Remove
                </Button>
              ),
          },
        ]}
      />
    </Card>
  );
}

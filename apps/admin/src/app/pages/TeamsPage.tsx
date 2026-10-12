import { PlusIcon } from '@heroicons/react/20/solid';
import { TeamListItem } from '@jetstream/admin/types';
import { Link } from 'react-router';
import { useApiQuery } from '../api/admin-api-client';
import { BooleanBadge, StatusBadge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { Spinner } from '../components/Spinner';
import { Table } from '../components/Table';
import { buildSearchPath, useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { EMPTY_VALUE, formatDate, formatNumber } from '../utils/format';

export function TeamsPage() {
  const { inputValue, setInputValue, query } = useUrlSearchQuery();
  const { data: teams, error, loading, reload } = useApiQuery<TeamListItem[]>(buildSearchPath('/api/teams', query));

  return (
    <>
      <PageHeader
        title="Teams"
        actions={
          <ButtonLink to="/teams/new" variant="primary">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Provision team
          </ButtonLink>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          autoFocus
          label="Search teams"
          placeholder="Team name, team id, member email or Stripe customer id"
        />
        {loading && <Spinner size="sm" className="text-slate-500" />}
      </div>
      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} onRetry={reload} />
        </div>
      )}
      <Card flush>
        <Table
          rows={teams ?? []}
          getRowKey={({ id }) => id}
          emptyMessage={loading ? 'Loading…' : 'No teams found'}
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: ({ id, name }) => (
                <Link to={`/teams/${id}`} className="font-medium text-blue-700 hover:underline">
                  {name}
                </Link>
              ),
            },
            { key: 'status', header: 'Status', render: ({ status }) => <StatusBadge status={status} /> },
            { key: 'billingStatus', header: 'Billing', render: ({ billingStatus }) => <StatusBadge status={billingStatus} /> },
            {
              key: 'members',
              header: 'Members',
              className: 'text-right tabular-nums',
              render: ({ memberCount }) => formatNumber(memberCount),
            },
            {
              key: 'seats',
              header: 'Seat limit',
              className: 'text-right tabular-nums',
              render: ({ licenseCountLimit }) => (licenseCountLimit === null ? 'Uncapped' : formatNumber(licenseCountLimit)),
            },
            {
              key: 'customer',
              header: 'Stripe customer',
              render: ({ customerId }) => (customerId ? <span className="font-mono text-xs">{customerId}</span> : EMPTY_VALUE),
            },
            { key: 'manualBilling', header: 'Manual billing', render: ({ manualBilling }) => <BooleanBadge value={manualBilling} /> },
            { key: 'createdAt', header: 'Created', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDate(createdAt) },
          ]}
        />
      </Card>
    </>
  );
}

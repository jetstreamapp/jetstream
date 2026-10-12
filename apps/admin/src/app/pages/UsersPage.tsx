import { UserListItem } from '@jetstream/admin/types';
import { Link } from 'react-router';
import { useApiQuery } from '../api/admin-api-client';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/SearchInput';
import { Spinner } from '../components/Spinner';
import { Table } from '../components/Table';
import { buildSearchPath, useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { EMPTY_VALUE, formatDate, formatRelative, isDateInPast } from '../utils/format';

export function UsersPage() {
  const { inputValue, setInputValue, query } = useUrlSearchQuery();
  const { data: users, error, loading, reload } = useApiQuery<UserListItem[]>(buildSearchPath('/api/users', query));

  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          autoFocus
          label="Search users"
          placeholder="Email, name, user id or Stripe customer id"
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
          rows={users ?? []}
          getRowKey={({ id }) => id}
          emptyMessage={loading ? 'Loading…' : 'No users found'}
          columns={[
            {
              key: 'email',
              header: 'Email',
              render: ({ id, email, emailVerified }) => (
                <span className="flex items-center gap-1.5">
                  <Link to={`/users/${id}`} className="font-medium text-blue-700 hover:underline">
                    {email}
                  </Link>
                  {!emailVerified && <Badge tone="amber">Unverified</Badge>}
                </span>
              ),
            },
            { key: 'name', header: 'Name', render: ({ name }) => name || EMPTY_VALUE },
            {
              key: 'team',
              header: 'Team',
              render: ({ teamId, teamName, teamRole }) =>
                teamId ? (
                  <span>
                    <Link to={`/teams/${teamId}`} className="text-blue-700 hover:underline">
                      {teamName ?? teamId}
                    </Link>
                    {teamRole && <span className="ml-1 text-xs text-slate-500">({teamRole})</span>}
                  </span>
                ) : (
                  EMPTY_VALUE
                ),
            },
            {
              key: 'plan',
              header: 'Plan',
              render: ({ hasActiveSubscription }) => (hasActiveSubscription ? <Badge tone="green">Paid</Badge> : <Badge>Free</Badge>),
            },
            {
              key: 'locked',
              header: 'Status',
              render: ({ lockedUntil }) =>
                isDateInPast(lockedUntil) || !lockedUntil ? <Badge tone="green">OK</Badge> : <Badge tone="red">Locked</Badge>,
            },
            {
              key: 'lastLoggedIn',
              header: 'Last login',
              className: 'whitespace-nowrap',
              render: ({ lastLoggedIn }) => formatRelative(lastLoggedIn),
            },
            { key: 'createdAt', header: 'Created', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDate(createdAt) },
          ]}
        />
      </Card>
    </>
  );
}

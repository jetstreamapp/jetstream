import {
  DEFAULT_PAGE_SIZE,
  PaginatedResult,
  SortDirectionSchema,
  UserListItem,
  UserPlanFilterSchema,
  UserSortFieldSchema,
} from '@jetstream/admin/types';
import { Link } from 'react-router';
import { useApiQuery } from '../api/admin-api-client';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { SearchInput } from '../components/SearchInput';
import { Spinner } from '../components/Spinner';
import { Table, TableSort } from '../components/Table';
import { USER_PLAN_LABELS, UserPlanBadges } from '../components/UserPlanBadges';
import { buildListPath, useUrlListState, useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { EMPTY_VALUE, formatDate, formatDateTime, formatRelative, isDateInPast } from '../utils/format';

const SELECT_CLASS_NAME =
  'rounded-md border-0 py-1.5 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset';

export function UsersPage() {
  const { inputValue, setInputValue, query } = useUrlSearchQuery();
  const { searchParams, page, setParams, setPage } = useUrlListState();
  // Unknown values in a hand-edited URL fall back to the defaults instead of failing the request
  const plan = UserPlanFilterSchema.safeParse(searchParams.get('plan')).data ?? null;
  const sort = UserSortFieldSchema.catch('createdAt').parse(searchParams.get('sort'));
  const direction = SortDirectionSchema.catch('desc').parse(searchParams.get('direction'));

  const { data, error, loading, reload } = useApiQuery<PaginatedResult<UserListItem>>(
    buildListPath('/api/users', { query, plan, sort, direction, page, pageSize: DEFAULT_PAGE_SIZE }),
    { keepPreviousData: true },
  );

  function handleSortChange({ key, direction }: TableSort) {
    setParams({ sort: key, direction });
  }

  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          autoFocus
          label="Search users"
          placeholder="Email, name, user id or Stripe customer id"
        />
        <select
          aria-label="Plan"
          value={plan ?? ''}
          onChange={(event) => setParams({ plan: event.target.value || null })}
          className={SELECT_CLASS_NAME}
        >
          <option value="">All plans</option>
          {UserPlanFilterSchema.options.map((planOption) => (
            <option key={planOption} value={planOption}>
              {USER_PLAN_LABELS[planOption]}
            </option>
          ))}
        </select>
        {loading && <Spinner size="sm" className="text-slate-500" />}
      </div>
      {error && (
        <div className="mb-4">
          <ErrorAlert error={error} onRetry={reload} />
        </div>
      )}
      <Card flush>
        <Table
          rows={data?.items ?? []}
          getRowKey={({ id }) => id}
          emptyMessage={loading ? 'Loading…' : 'No users found'}
          sort={{ key: sort, direction }}
          onSortChange={handleSortChange}
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
            { key: 'plan', header: 'Plan', render: (user) => <UserPlanBadges {...user} /> },
            {
              key: 'locked',
              header: 'Status',
              render: ({ lockedUntil }) =>
                isDateInPast(lockedUntil) || !lockedUntil ? <Badge tone="green">OK</Badge> : <Badge tone="red">Locked</Badge>,
            },
            {
              key: 'lastLoggedIn',
              header: 'Last login',
              sortKey: 'lastLoggedIn',
              className: 'whitespace-nowrap',
              render: ({ lastLoggedIn }) => <span title={formatDateTime(lastLoggedIn)}>{formatRelative(lastLoggedIn)}</span>,
            },
            {
              key: 'createdAt',
              header: 'Created',
              sortKey: 'createdAt',
              className: 'whitespace-nowrap',
              render: ({ createdAt }) => formatDate(createdAt),
            },
          ]}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </>
  );
}

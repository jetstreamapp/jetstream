import { PaginatedResult, UserListItem } from '@jetstream/admin/types';
import { useState } from 'react';
import { useApiQuery } from '../api/admin-api-client';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { buildListPath } from '../hooks/useUrlSearchQuery';
import { Badge } from './Badge';
import { Button } from './Button';
import { ErrorAlert } from './ErrorAlert';
import { SearchInput } from './SearchInput';
import { Spinner } from './Spinner';
import { UserPlanBadges } from './UserPlanBadges';

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 8;

export interface UserPickerProps {
  /** Users already picked; their rows show as added */
  selectedUserIds: ReadonlySet<string>;
  onSelect: (user: UserListItem) => void;
  actionLabel?: string;
}

/**
 * Finds an existing Jetstream user to add to a team. Users who already belong to a team cannot be
 * picked, because a user can only be on one team.
 */
export function UserPicker({ selectedUserIds, onSelect, actionLabel = 'Add' }: UserPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const query = useDebouncedValue(inputValue.trim(), 300);
  const hasQuery = query.length >= MIN_QUERY_LENGTH;
  const { data, error, loading } = useApiQuery<PaginatedResult<UserListItem>>(
    hasQuery ? buildListPath('/api/users', { query, pageSize: RESULT_LIMIT }) : null,
  );
  const users = hasQuery ? (data?.items ?? []) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SearchInput value={inputValue} onChange={setInputValue} label="Find a user" placeholder="Search users by email or name" />
        {loading && <Spinner size="sm" className="text-slate-500" />}
      </div>
      {error && <ErrorAlert error={error} title="User search failed" />}
      {hasQuery && !loading && users.length === 0 && (
        <p className="text-xs text-slate-500">
          No users found. They need a Jetstream account before they can be added; send an invitation instead.
        </p>
      )}
      {users.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
          {users.map((user) => {
            const isSelected = selectedUserIds.has(user.id);
            return (
              <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {user.email} {user.name && <span className="font-normal text-slate-500">· {user.name}</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <UserPlanBadges {...user} />
                    {user.teamId && <Badge tone="amber">On team {user.teamName ?? user.teamId}</Badge>}
                    {user.hasPersonalSubscription && (
                      <span className="text-xs text-amber-800">Their personal subscription keeps billing until it is canceled.</span>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={() => onSelect(user)} disabled={isSelected || !!user.teamId}>
                  {isSelected ? 'Added' : actionLabel}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

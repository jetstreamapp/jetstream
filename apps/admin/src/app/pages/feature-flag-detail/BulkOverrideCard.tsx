import {
  FeatureFlagOverrideAction,
  FeatureFlagOverrideScope,
  MAX_FEATURE_FLAG_OVERRIDE_TARGETS,
  PaginatedResult,
  TeamListItem,
  UserListItem,
} from '@jetstream/admin/types';
import { useState } from 'react';
import { useApiQuery } from '../../api/admin-api-client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { Pagination } from '../../components/Pagination';
import { SearchInput } from '../../components/SearchInput';
import { Spinner } from '../../components/Spinner';
import { Table } from '../../components/Table';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useUpdateFeatureFlagOverrides } from '../../hooks/useUpdateFeatureFlagOverrides';
import { buildListPath } from '../../hooks/useUrlSearchQuery';

const PAGE_SIZE = 25;

interface Target {
  id: string;
  label: string;
  detail: string | null;
}

const SCOPE_CONFIG = {
  user: {
    title: 'Users',
    singular: 'user',
    plural: 'users',
    labelColumn: 'Email',
    path: '/api/users',
    placeholder: 'Email, name, user id or Stripe customer id',
  },
  team: {
    title: 'Teams',
    singular: 'team',
    plural: 'teams',
    labelColumn: 'Team',
    path: '/api/teams',
    placeholder: 'Team name, team id, member email or Stripe customer id',
  },
} satisfies Record<FeatureFlagOverrideScope, object>;

const SCOPES = Object.keys(SCOPE_CONFIG) as FeatureFlagOverrideScope[];

function toTarget(item: UserListItem | TeamListItem): Target {
  if ('email' in item) {
    const { id, email, name, teamName } = item;
    return { id, label: email, detail: [name, teamName && `Team: ${teamName}`].filter(Boolean).join(' · ') || null };
  }
  return { id: item.id, label: item.name, detail: `${item.memberCount} members` };
}

/**
 * Switching scope remounts the selector (see `key`), which is what discards the previous scope's
 * search, page and selection, so a user id can never be sent as a team scope.
 */
export function BulkOverrideCard({ flagKey, onChanged }: { flagKey: string; onChanged: () => void }) {
  const [scope, setScope] = useState<FeatureFlagOverrideScope>('user');

  return (
    <Card
      title="Update overrides in bulk"
      description={`Search, tick ${SCOPE_CONFIG[scope].plural} (up to ${MAX_FEATURE_FLAG_OVERRIDE_TARGETS} at a time) and apply. Selections are kept while you search.`}
      actions={
        <div role="group" aria-label="Override scope" className="inline-flex gap-1">
          {SCOPES.map((option) => (
            <Button key={option} size="sm" variant={scope === option ? 'primary' : 'secondary'} onClick={() => setScope(option)}>
              {SCOPE_CONFIG[option].title}
            </Button>
          ))}
        </div>
      }
    >
      <BulkOverrideSelector key={scope} flagKey={flagKey} scope={scope} onChanged={onChanged} />
    </Card>
  );
}

function BulkOverrideSelector({ flagKey, scope, onChanged }: { flagKey: string; scope: FeatureFlagOverrideScope; onChanged: () => void }) {
  const { singular, plural, labelColumn, path, placeholder } = SCOPE_CONFIG[scope];
  const [inputValue, setInputValue] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, Target>>(new Map());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const query = useDebouncedValue(inputValue.trim(), 300);

  const {
    data,
    error: searchError,
    loading: searching,
  } = useApiQuery<PaginatedResult<UserListItem | TeamListItem>>(buildListPath(path, { query, page, pageSize: PAGE_SIZE }), {
    keepPreviousData: true,
  });
  const { run: applyUpdate, loading: applying, error: applyError } = useUpdateFeatureFlagOverrides();

  const rows = data?.items.map(toTarget) ?? [];
  const allOnPageSelected = rows.length > 0 && rows.every(({ id }) => selected.has(id));
  const isSelectionTooLarge = selected.size > MAX_FEATURE_FLAG_OVERRIDE_TARGETS;

  function toggleTarget(target: Target) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(target.id)) {
        next.delete(target.id);
      } else {
        next.set(target.id, target);
      }
      return next;
    });
  }

  function togglePage() {
    setSelected((previous) => {
      const next = new Map(previous);
      rows.forEach((target) => (allOnPageSelected ? next.delete(target.id) : next.set(target.id, target)));
      return next;
    });
  }

  async function handleApply(action: FeatureFlagOverrideAction) {
    const verb = action === 'enable' ? 'Enable' : 'Remove the override for';
    if (!window.confirm(`${verb} ${flagKey} for ${selected.size} ${selected.size === 1 ? singular : plural}?`)) {
      return;
    }
    const result = await applyUpdate(flagKey, { scope, ids: Array.from(selected.keys()), action });
    if (result) {
      setSuccessMessage(
        `${action === 'enable' ? 'Enabled' : 'Removed'} ${flagKey}: ${result.affected} override${result.affected === 1 ? '' : 's'} changed`,
      );
      setSelected(new Map());
      onChanged();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={inputValue}
          onChange={(value) => {
            setInputValue(value);
            setPage(1);
          }}
          label={`Search ${plural}`}
          placeholder={placeholder}
        />
        {searching && <Spinner size="sm" className="text-slate-500" />}
      </div>
      {searchError && <ErrorAlert error={searchError} title={`Unable to search ${plural}`} />}
      {applyError && <ErrorAlert error={applyError} title="Unable to update overrides" />}
      {successMessage && <Alert tone="success">{successMessage}</Alert>}

      <div className="rounded-md ring-1 ring-slate-200">
        <Table
          rows={rows}
          getRowKey={({ id }) => id}
          emptyMessage={searching ? 'Searching…' : `No ${plural} found`}
          columns={[
            {
              key: 'select',
              header: (
                <input
                  type="checkbox"
                  aria-label={`Select all ${plural} on this page`}
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  disabled={rows.length === 0}
                />
              ),
              className: 'w-8',
              render: (target) => (
                <input
                  type="checkbox"
                  aria-label={`Select ${target.label}`}
                  checked={selected.has(target.id)}
                  onChange={() => toggleTarget(target)}
                />
              ),
            },
            { key: 'label', header: labelColumn, render: ({ label }) => <span className="font-medium text-slate-900">{label}</span> },
            { key: 'detail', header: 'Details', render: ({ detail }) => <span className="text-slate-500">{detail}</span> },
          ]}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isSelectionTooLarge ? 'red' : 'blue'}>{selected.size} selected</Badge>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleApply('enable')}
          loading={applying}
          disabled={selected.size === 0 || isSelectionTooLarge}
        >
          Enable for selected
        </Button>
        <Button size="sm" onClick={() => handleApply('remove')} disabled={applying || selected.size === 0 || isSelectionTooLarge}>
          Remove override for selected
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())} disabled={selected.size === 0}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}

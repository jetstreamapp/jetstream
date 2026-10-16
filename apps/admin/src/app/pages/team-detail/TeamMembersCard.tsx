import { TeamDetail, TeamMemberToAdd, UserListItem } from '@jetstream/admin/types';
import { TeamMemberRole } from '@jetstream/types';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiPost } from '../../api/admin-api-client';
import { StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { Table } from '../../components/Table';
import { TEAM_ROLE_LABELS, TeamRoleSelect } from '../../components/TeamRoleSelect';
import { UserPicker } from '../../components/UserPicker';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { EMPTY_VALUE, formatDate, formatDateTime, formatRelative } from '../../utils/format';

function AddExistingUserForm({ team, onAdded }: { team: TeamDetail; onAdded: (email: string) => void }) {
  const [pendingUser, setPendingUser] = useState<UserListItem | null>(null);
  const [role, setRole] = useState<TeamMemberRole>('MEMBER');
  const {
    run: addMember,
    loading,
    error,
    clearError,
  } = useAsyncAction((request: TeamMemberToAdd) => apiPost<{ email: string }>(`/api/teams/${team.id}/members`, request));
  const memberUserIds = new Set(team.members.map(({ userId }) => userId));

  function handleSelect(user: UserListItem) {
    clearError();
    setPendingUser(user);
  }

  async function handleAdd() {
    if (!pendingUser) {
      return;
    }
    if (
      !window.confirm(
        `Add ${pendingUser.email} to ${team.name} as ${TEAM_ROLE_LABELS[role]}? They are signed out so they sign in again under the team's login rules. No email is sent.`,
      )
    ) {
      return;
    }
    const result = await addMember({ userId: pendingUser.id, role });
    if (result) {
      setPendingUser(null);
      onAdded(result.email);
    }
  }

  return (
    <div className="space-y-2 border-t border-slate-200 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">Add existing user</p>
      <p className="text-xs text-slate-500">
        Adds someone who already has a Jetstream account straight to the team and signs them out, so they sign in again under the
        team&apos;s login rules. No invitation or email is sent.
      </p>
      {pendingUser ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
          <span className="font-medium text-slate-900">{pendingUser.email}</span>
          <TeamRoleSelect value={role} onChange={setRole} />
          <Button variant="primary" size="sm" onClick={handleAdd} loading={loading}>
            Add to team
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingUser(null)} disabled={loading}>
            Cancel
          </Button>
        </div>
      ) : (
        <UserPicker selectedUserIds={memberUserIds} onSelect={handleSelect} actionLabel="Choose" />
      )}
      {error && <ErrorAlert error={error} title="User not added" />}
    </div>
  );
}

export function TeamMembersCard({ team, onChanged }: { team: TeamDetail; onChanged: () => void }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleAdded(email: string) {
    setSuccessMessage(`${email} added to the team`);
    onChanged();
  }

  return (
    <Card title={`Members (${team.members.length})`} flush>
      {successMessage && (
        <div className="px-4 pt-3">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}
      <Table
        rows={team.members}
        getRowKey={({ userId }) => userId}
        emptyMessage="No members yet"
        columns={[
          {
            key: 'email',
            header: 'Email',
            render: ({ userId, email }) => (
              <Link to={`/users/${userId}`} className="text-blue-700 hover:underline">
                {email}
              </Link>
            ),
          },
          { key: 'name', header: 'Name', render: ({ name }) => name || EMPTY_VALUE },
          { key: 'role', header: 'Role', render: ({ role }) => role },
          { key: 'status', header: 'Status', render: ({ status }) => <StatusBadge status={status} /> },
          {
            key: 'lastLoggedIn',
            header: 'Last login',
            className: 'whitespace-nowrap',
            render: ({ lastLoggedIn }) => <span title={formatDateTime(lastLoggedIn)}>{formatRelative(lastLoggedIn)}</span>,
          },
          { key: 'createdAt', header: 'Joined', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDate(createdAt) },
        ]}
      />
      <AddExistingUserForm team={team} onAdded={handleAdded} />
    </Card>
  );
}

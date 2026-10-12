import { SendTeamInvitationRequest, SendTeamInvitationRequestSchema, TeamDetail, TeamInvitationItem } from '@jetstream/admin/types';
import { TeamMemberRoleSchema } from '@jetstream/types';
import { FormEvent, useState } from 'react';
import { apiDelete, apiPost } from '../../api/admin-api-client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { Table } from '../../components/Table';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { formatDateTime, formatRelative, isDateInPast } from '../../utils/format';

type TeamMemberRole = SendTeamInvitationRequest['role'];

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  BILLING: 'Billing (no seat)',
};

function InviteMemberForm({ teamId, teamName, onInvited }: { teamId: string; teamName: string; onInvited: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('ADMIN');
  const [validationError, setValidationError] = useState<string | null>(null);
  const {
    run: sendInvitation,
    loading,
    error,
  } = useAsyncAction((request: SendTeamInvitationRequest) => apiPost<TeamInvitationItem>(`/api/teams/${teamId}/invitations`, request));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedRequest = SendTeamInvitationRequestSchema.safeParse({ email, role });
    if (!parsedRequest.success) {
      setValidationError('Enter a valid email address');
      return;
    }
    setValidationError(null);
    const { data: request } = parsedRequest;
    // Sending is the explicit "email them now" action, so confirm before anything goes out
    if (!window.confirm(`Send an invitation email to ${request.email} to join ${teamName} as ${ROLE_LABELS[request.role]}?`)) {
      return;
    }
    const invitation = await sendInvitation(request);
    if (invitation) {
      setEmail('');
      onInvited(invitation.email);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-slate-200 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">Invite member</p>
      <p className="text-xs text-slate-500">An invitation email goes out as soon as you click Send. Invitations expire after 14 days.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-slate-600">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@customer.com"
            className="rounded-md border-0 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as TeamMemberRole)}
            className="rounded-md border-0 py-1.5 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset"
          >
            {TeamMemberRoleSchema.options.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {ROLE_LABELS[roleOption]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" loading={loading}>
          Send invitation
        </Button>
      </div>
      {validationError && <p className="text-xs text-red-700">{validationError}</p>}
      {error && <ErrorAlert error={error} title="Invitation not sent" />}
    </form>
  );
}

export function TeamInvitationsCard({ team, onChanged }: { team: TeamDetail; onChanged: () => void }) {
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { run: resendInvitation, error: resendError } = useAsyncAction((invitationId: string) =>
    apiPost<TeamInvitationItem>(`/api/teams/${team.id}/invitations/${invitationId}/resend`),
  );
  const { run: revokeInvitation, error: revokeError } = useAsyncAction((invitationId: string) =>
    apiDelete<{ id: string }>(`/api/teams/${team.id}/invitations/${invitationId}`),
  );

  async function handleResend({ id, email }: TeamInvitationItem) {
    if (!window.confirm(`Resend the invitation email to ${email}? This also extends the invitation for 14 days.`)) {
      return;
    }
    setPendingInvitationId(id);
    setSuccessMessage(null);
    const result = await resendInvitation(id);
    setPendingInvitationId(null);
    if (result) {
      setSuccessMessage(`Invitation resent to ${email}`);
      onChanged();
    }
  }

  async function handleRevoke({ id, email }: TeamInvitationItem) {
    if (!window.confirm(`Revoke the invitation for ${email}? The link in their email will stop working.`)) {
      return;
    }
    setPendingInvitationId(id);
    setSuccessMessage(null);
    const result = await revokeInvitation(id);
    setPendingInvitationId(null);
    if (result) {
      setSuccessMessage(`Invitation for ${email} revoked`);
      onChanged();
    }
  }

  function handleInvited(email: string) {
    setSuccessMessage(`Invitation sent to ${email}`);
    onChanged();
  }

  const actionError = resendError ?? revokeError;

  return (
    <Card title="Invitations" description="Nothing is emailed until you send or resend an invitation." flush>
      {(successMessage || actionError) && (
        <div className="space-y-2 px-4 pt-3">
          {successMessage && <Alert tone="success">{successMessage}</Alert>}
          {actionError && <ErrorAlert error={actionError} title="Invitation update failed" />}
        </div>
      )}
      <Table
        rows={team.invitations}
        getRowKey={({ id }) => id}
        emptyMessage="No invitations"
        columns={[
          { key: 'email', header: 'Email', render: ({ email }) => email },
          { key: 'role', header: 'Role', render: ({ role }) => role },
          {
            key: 'expiresAt',
            header: 'Expires',
            className: 'whitespace-nowrap',
            render: ({ expiresAt }) =>
              isDateInPast(expiresAt) ? (
                <Badge tone="red">Expired</Badge>
              ) : (
                <span title={formatDateTime(expiresAt)}>{formatRelative(expiresAt)}</span>
              ),
          },
          {
            key: 'lastSentAt',
            header: 'Last sent',
            className: 'whitespace-nowrap',
            render: ({ lastSentAt }) => formatDateTime(lastSentAt),
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'text-right whitespace-nowrap',
            render: (invitation) => (
              <span className="inline-flex gap-1">
                <Button size="sm" variant="ghost" disabled={!!pendingInvitationId} onClick={() => handleResend(invitation)}>
                  Resend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700"
                  disabled={!!pendingInvitationId}
                  onClick={() => handleRevoke(invitation)}
                >
                  Revoke
                </Button>
              </span>
            ),
          },
        ]}
      />
      <InviteMemberForm teamId={team.id} teamName={team.name} onInvited={handleInvited} />
    </Card>
  );
}

import { ApproveTeamDomainRequest, ApproveTeamDomainRequestSchema, TeamDetail, TeamDomainItem } from '@jetstream/admin/types';
import { FormEvent, useState } from 'react';
import { apiPost } from '../../api/admin-api-client';
import { StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { Table } from '../../components/Table';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { formatDate, formatDateTime } from '../../utils/format';

const DOMAIN_STATUS_VERIFIED = 'VERIFIED';

export function TeamDomainsCard({ team, onChanged }: { team: TeamDetail; onChanged: () => void }) {
  const [domainInput, setDomainInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    run: approveDomain,
    loading,
    error,
  } = useAsyncAction((request: ApproveTeamDomainRequest) => apiPost<TeamDomainItem>(`/api/teams/${team.id}/domains`, request));

  async function submitDomain(domain: string) {
    const parsedRequest = ApproveTeamDomainRequestSchema.safeParse({ domain });
    if (!parsedRequest.success) {
      setValidationError(parsedRequest.error.issues[0]?.message ?? 'Enter a valid domain');
      return;
    }
    setValidationError(null);
    setSuccessMessage(null);
    const { data: request } = parsedRequest;
    if (!window.confirm(`Mark ${request.domain} as verified for ${team.name} without the DNS check?`)) {
      return;
    }
    const result = await approveDomain(request);
    if (result) {
      setDomainInput('');
      setSuccessMessage(`${result.domain} is verified`);
      onChanged();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDomain(domainInput);
  }

  return (
    <Card title="Domains" description="Verified domains let the team set up SSO. Sign-in is unaffected until they turn SSO on." flush>
      {(successMessage || error) && (
        <div className="space-y-2 px-4 pt-3">
          {successMessage && <Alert tone="success">{successMessage}</Alert>}
          {error && <ErrorAlert error={error} title="Domain not approved" />}
        </div>
      )}
      <Table
        rows={team.domains}
        getRowKey={({ id }) => id}
        emptyMessage="No domains"
        columns={[
          { key: 'domain', header: 'Domain', render: ({ domain }) => <span className="font-mono text-xs">{domain}</span> },
          { key: 'status', header: 'Status', render: ({ status }) => <StatusBadge status={status} /> },
          {
            key: 'verifiedAt',
            header: 'Verified',
            className: 'whitespace-nowrap',
            render: ({ verifiedAt, createdAt }) =>
              verifiedAt ? <span title={formatDateTime(verifiedAt)}>{formatDate(verifiedAt)}</span> : `Added ${formatDate(createdAt)}`,
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'text-right',
            render: ({ domain, status }) =>
              status !== DOMAIN_STATUS_VERIFIED ? (
                <Button size="sm" variant="ghost" onClick={() => submitDomain(domain)} disabled={loading}>
                  Approve
                </Button>
              ) : null,
          },
        ]}
      />
      <form onSubmit={handleSubmit} className="space-y-1 border-t border-slate-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-600">
            Add verified domain
            <input
              type="text"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="customer.com"
              className="rounded-md border-0 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset"
            />
          </label>
          <Button type="submit" loading={loading}>
            Approve
          </Button>
        </div>
        {validationError && <p className="text-xs text-red-700">{validationError}</p>}
      </form>
    </Card>
  );
}

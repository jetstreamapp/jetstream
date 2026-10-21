import { AuditLogItem } from '@jetstream/admin/types';
import { Link } from 'react-router';
import { EMPTY_VALUE, formatDateTime } from '../utils/format';
import { Table } from './Table';

function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) {
    return '';
  }
  try {
    return JSON.stringify(metadata);
  } catch {
    return String(metadata);
  }
}

export function AuditLogTable({ auditLogs }: { auditLogs: AuditLogItem[] }) {
  return (
    <Table
      rows={auditLogs}
      getRowKey={({ id }) => id}
      emptyMessage="No audit log entries"
      columns={[
        { key: 'createdAt', header: 'When', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDateTime(createdAt) },
        { key: 'action', header: 'Action', render: ({ action }) => <span className="font-mono text-xs">{action}</span> },
        {
          key: 'resource',
          header: 'Resource',
          render: ({ resource, resourceId }) => (
            <span className="text-xs">
              {resource}
              {resourceId && <span className="block font-mono text-slate-500">{resourceId}</span>}
            </span>
          ),
        },
        {
          key: 'actor',
          header: 'User',
          render: ({ userId }) =>
            userId ? (
              <Link to={`/users/${userId}`} className="font-mono text-xs text-blue-700 hover:underline">
                {userId.slice(0, 8)}
              </Link>
            ) : (
              EMPTY_VALUE
            ),
        },
        {
          key: 'metadata',
          header: 'Details',
          render: ({ metadata }) => {
            const formattedMetadata = formatMetadata(metadata);
            return (
              <span title={formattedMetadata} className="block max-w-md truncate font-mono text-xs text-slate-500">
                {formattedMetadata || EMPTY_VALUE}
              </span>
            );
          },
        },
      ]}
    />
  );
}

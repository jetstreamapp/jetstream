import { downloadTeamAuditLogsCsv, getTeamAuditLogs } from '@jetstream/shared/data';
import { AuditLogPageResponse, AuditLogUserFacing } from '@jetstream/types';
import { DatePicker, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { endOfMonth } from 'date-fns/endOfMonth';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { subDays } from 'date-fns/subDays';
import { subMonths } from 'date-fns/subMonths';
import { useCallback, useEffect, useRef, useState } from 'react';

const ACTION_DISPLAY_NAMES: Record<string, string> = {
  TEAM_UPDATED: 'Team Name Updated',
  LOGIN_CONFIG_UPDATED: 'Login Configuration Updated',
  TEAM_MEMBER_ROLE_UPDATED: 'Member Role Updated',
  TEAM_MEMBER_STATUS_UPDATED: 'Member Status Updated',
  TEAM_SESSION_REVOKED: 'Session Revoked',
  TEAM_INVITATION_CREATED: 'Invitation Sent',
  TEAM_INVITATION_RESENT: 'Invitation Resent',
  TEAM_INVITATION_CANCELLED: 'Invitation Cancelled',
  TEAM_INVITATION_ACCEPTED: 'Invitation Accepted',
  SSO_SAML_CONFIG_CREATED: 'SAML Config Created',
  SSO_SAML_CONFIG_UPDATED: 'SAML Config Updated',
  SSO_SAML_CONFIG_DELETED: 'SAML Config Deleted',
  SSO_OIDC_CONFIG_CREATED: 'OIDC Config Created',
  SSO_OIDC_CONFIG_UPDATED: 'OIDC Config Updated',
  SSO_OIDC_CONFIG_DELETED: 'OIDC Config Deleted',
  SSO_SETTINGS_UPDATED: 'SSO Settings Updated',
  DOMAIN_VERIFICATION_ADDED: 'Domain Added',
  DOMAIN_VERIFIED: 'Domain Verified',
  DOMAIN_DELETED: 'Domain Deleted',
};

function toApiDateString(date: Date | null): string | undefined {
  return date ? format(date, 'yyyy-MM-dd') : undefined;
}

export interface TeamAuditLogModalProps {
  teamId: string;
  onClose: () => void;
}

export function TeamAuditLogModal({ teamId, onClose }: TeamAuditLogModalProps) {
  // Stable "today" reference so DatePicker max constraints don't change on every render
  const today = useRef(new Date()).current;

  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [records, setRecords] = useState<AuditLogUserFacing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(() => subDays(today, 30));
  const [endDate, setEndDate] = useState<Date | null>(() => today);
  // Incrementing this key forces DatePicker remount when shortcuts set dates externally
  const [datePickerKey, setDatePickerKey] = useState(0);

  // Track pending cursor load to avoid stale closures
  const pendingCursor = useRef<string | null>(null);

  const loadPage = useCallback(
    (cursor: string | null) => {
      setLoading(true);
      setLoadingError(null);
      getTeamAuditLogs(teamId, {
        cursorId: cursor ?? undefined,
        startDate: toApiDateString(startDate),
        endDate: toApiDateString(endDate),
      })
        .then((result: AuditLogPageResponse) => {
          setRecords((prev) => (cursor ? [...prev, ...result.records] : result.records));
          setHasMore(result.hasMore);
          setNextCursor(result.nextCursor);
        })
        .catch((error: Error) => {
          setLoadingError(error.message);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [teamId, startDate, endDate],
  );

  // Re-fetch from scratch when date range changes
  useEffect(() => {
    setNextCursor(null);
    pendingCursor.current = null;
    loadPage(null);
  }, [loadPage]);

  function handleLoadMore() {
    loadPage(nextCursor);
  }

  function applyDateRange(start: Date, end: Date) {
    setStartDate(start);
    setEndDate(end);
    setDatePickerKey((key) => key + 1);
  }

  async function handleDownloadCsv() {
    setCsvLoading(true);
    try {
      const csv = await downloadTeamAuditLogsCsv(teamId, {
        startDate: toApiDateString(startDate),
        endDate: toApiDateString(endDate),
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${toApiDateString(startDate)}-to-${toApiDateString(endDate)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setLoadingError('Failed to download audit logs. Please try again.');
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <Modal
      testId="team-audit-log-modal"
      header="Audit Logs"
      size="lg"
      className="slds-p-around_medium slds-is-relative"
      footer={
        <button className="slds-button slds-button_neutral" disabled={csvLoading || loading} onClick={handleDownloadCsv}>
          {csvLoading ? 'Downloading...' : 'Download CSV'}
        </button>
      }
      onClose={onClose}
    >
      {loading && <Spinner />}
      {loadingError && (
        <ScopedNotification theme="error" className="slds-m-vertical_medium">
          {loadingError}
        </ScopedNotification>
      )}

      {/* Date range pickers */}
      <div className="slds-grid slds-m-bottom_x-small">
        <div>
          <DatePicker
            key={`start-${datePickerKey}`}
            id="audit-log-start-date"
            label="Start Date"
            maxAvailableDate={endDate ?? today}
            hasError={false}
            initialSelectedDate={startDate ?? undefined}
            onChange={setStartDate}
          />
        </div>
        <div className="slds-m-left_small">
          <DatePicker
            key={`end-${datePickerKey}`}
            id="audit-log-end-date"
            label="End Date"
            minAvailableDate={startDate ?? undefined}
            maxAvailableDate={today}
            hasError={false}
            initialSelectedDate={endDate ?? undefined}
            onChange={setEndDate}
          />
        </div>
      </div>

      {/* Date shortcut buttons */}
      <div className="slds-m-bottom_small">
        <div className="slds-button-group" role="group">
          <button className="slds-button slds-button_neutral" onClick={() => applyDateRange(subDays(today, 7), today)}>
            Last 7 Days
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => applyDateRange(subDays(today, 30), today)}>
            Last 30 Days
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => applyDateRange(startOfMonth(today), today)}>
            This Month
          </button>
          <button
            className="slds-button slds-button_neutral"
            onClick={() => applyDateRange(startOfMonth(subMonths(today, 1)), endOfMonth(subMonths(today, 1)))}
          >
            Last Month
          </button>
        </div>
      </div>

      <table aria-label="Audit Logs" className="slds-table slds-table_cell-buffer slds-table_bordered">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col">
              <span className="slds-truncate" title="Date/Time">
                Date/Time
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Performed By">
                Performed By
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Action">
                Action
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="IP Address">
                IP Address
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Details">
                Details
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {!loading && records.length === 0 && (
            <tr>
              <td colSpan={5} className="slds-text-align_center slds-p-around_medium">
                No audit log entries found for the selected date range.
              </td>
            </tr>
          )}
          {records.map((record) => (
            <AuditLogRow key={record.id} record={record} />
          ))}
        </tbody>
        {hasMore && (
          <tfoot>
            <tr>
              <td colSpan={5} className="slds-text-align_center">
                <button className="slds-button slds-button_neutral" disabled={loading} onClick={handleLoadMore}>
                  Load More
                </button>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </Modal>
  );
}

const AuditLogRow = ({ record }: { record: AuditLogUserFacing }) => {
  const { id: _id, action, createdAt, ipAddress, metadata, performedBy, resourceId: _resourceId } = record;
  const displayAction = ACTION_DISPLAY_NAMES[action] ?? action;

  return (
    <tr>
      <td role="gridcell" className="slds-cell-wrap">
        {parseISO(createdAt).toLocaleString()}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {performedBy ? (
          <div>
            <div>{performedBy.name}</div>
            <div className="slds-text-color_weak">{performedBy.email}</div>
          </div>
        ) : (
          <span className="slds-text-color_weak">Unknown</span>
        )}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {displayAction}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {ipAddress}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {metadata ? (
          <pre className="slds-text-body_small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
            {JSON.stringify(metadata, null, 2)}
          </pre>
        ) : null}
      </td>
    </tr>
  );
};

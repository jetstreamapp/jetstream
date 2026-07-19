import { InsertUpdateUpsert, Maybe } from '@jetstream/types';
import { LoadMultiObjectRequestWithResult, LoadMultiObjectRun } from '../load-records-multi-object-types';

export interface RecordResultRow {
  _key: string;
  worksheet: string;
  /** Excel row number the record came from (data starts on row 6) */
  rowNumber: number;
  group: string;
  referenceId: string;
  sobject: string;
  operation: InsertUpdateUpsert;
  /** null = not processed yet (in flight or cancelled before its request was sent) */
  _success: boolean | null;
  _id: string;
  created: boolean;
  /** Error message - rendered by the standalone record-error column */
  status?: string;
  severity?: 'error' | 'none';
  runType: LoadMultiObjectRun['type'];
  runId: number;
}

export interface LoadResultsSummary {
  successCount: number;
  failureCount: number;
  pendingCount: number;
  totalCount: number;
}

/**
 * Flatten runs into one row per record, keeping only the LATEST outcome per Reference Id
 * (a retry run supersedes the initial run for the groups it contains).
 */
export function buildRecordResultRows(runs: LoadMultiObjectRun[], groupNumbersByGraphId: Record<string, number>): RecordResultRow[] {
  const rowsByRefId: Record<string, RecordResultRow> = {};

  runs.forEach((run) => {
    run.requests.forEach((request) => {
      Object.values(request.recordWithResponseByRefId).forEach((record) => {
        const graphResult = request.dataWithResultsByGraphId[record.graphId];
        const responseBody: Maybe<{ id?: string; success?: boolean; created?: boolean; errorCode?: string; message?: string }> =
          record.response?.body;

        let success: boolean | null = null;
        let errorMessage: string | undefined;
        if (request.errorMessage) {
          success = false;
          errorMessage = request.errorMessage;
        } else if (graphResult?.isSuccess === true) {
          success = true;
        } else if (graphResult?.isSuccess === false) {
          // groups are atomic - every record in a failed group failed (or was rolled back)
          success = false;
          errorMessage = responseBody?.errorCode ? `${responseBody.errorCode}: ${responseBody.message}` : responseBody?.message;
        }

        const groupNumber = groupNumbersByGraphId[record.graphId];
        rowsByRefId[record.referenceId] = {
          _key: record.referenceId,
          worksheet: record.worksheet,
          rowNumber: record.rowIndex + 6,
          group: groupNumber ? `Group ${groupNumber}` : record.graphId,
          referenceId: record.referenceId,
          sobject: record.sobject,
          operation: record.operation,
          _success: success,
          // PATCH (update/upsert-update) returns 204 with no body - success is known from the graph result
          _id: responseBody?.id || '',
          created: !!responseBody?.created || (record.operation === 'INSERT' && success === true),
          status: errorMessage,
          severity: errorMessage ? 'error' : 'none',
          runType: run.type,
          runId: run.runId,
        };
      });
    });
  });

  return Object.values(rowsByRefId);
}

/**
 * Outcome for a whole group. Groups are atomic, so a group only counts as loaded once every record in it
 * succeeded, and any failure fails the group. null = still pending.
 */
export function getGroupSuccess(rows: RecordResultRow[]): boolean | null {
  if (rows.some(({ _success }) => _success === false)) {
    return false;
  }
  return rows.length > 0 && rows.every(({ _success }) => _success === true) ? true : null;
}

export function getLoadResultsSummary(rows: RecordResultRow[]): LoadResultsSummary {
  return rows.reduce(
    (summary, { _success }) => {
      if (_success === true) {
        summary.successCount++;
      } else if (_success === false) {
        summary.failureCount++;
      } else {
        summary.pendingCount++;
      }
      return summary;
    },
    { successCount: 0, failureCount: 0, pendingCount: 0, totalCount: rows.length },
  );
}

/** Rows for the results download - one flat sheet with worksheet identity preserved */
export function buildResultsDownloadRows(rows: RecordResultRow[], which: 'results' | 'failures') {
  return rows
    .filter(({ _success }) => (which === 'failures' ? _success === false : true))
    .map((row) => ({
      Worksheet: row.worksheet,
      Row: row.rowNumber,
      Group: row.group,
      Object: row.sobject,
      Operation: row.operation,
      'Reference Id': row.referenceId,
      Id: row._id,
      Success: row._success === true,
      Created: row.created,
      Error: row.status || '',
    }));
}

export const RESULTS_DOWNLOAD_HEADER = [
  'Worksheet',
  'Row',
  'Group',
  'Object',
  'Operation',
  'Reference Id',
  'Id',
  'Success',
  'Created',
  'Error',
];

/**
 * Raw composite-graph request payload - shared by the "Download Load Data" action and the Data
 * History capture so the two exports never drift.
 */
export function buildRequestExport(requests: LoadMultiObjectRequestWithResult[]): { groupId: string; data: unknown[] }[] {
  return requests.map((request) => ({ groupId: request.key, data: Object.values(request.dataWithResultsByGraphId) }));
}

import { DataHistoryOperation } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import { RESULTS_DOWNLOAD_HEADER, RecordResultRow, buildResultsDownloadRows, getLoadResultsSummary } from './load/load-results-utils';

/**
 * Helpers that adapt the multi-object load feature to the `@jetstream/ui/data-history` capture API.
 * The handle's methods are internally queued, never reject, and no-op when capture is disabled or
 * opted out, so nothing here needs null checks or its own error handling.
 */

function multiObjectOperationToDataHistoryOperation(operation: string): DataHistoryOperation {
  switch (operation) {
    case 'INSERT':
      return 'insert';
    case 'UPDATE':
      return 'update';
    case 'UPSERT':
      return 'upsert';
    default:
      return 'insert';
  }
}

/** Distinct target object names across every graph in the load */
export function getMultiObjectDistinctSobjects(requests: LoadMultiObjectRequestWithResult[]): string[] {
  const sobjects = new Set<string>();
  requests.forEach((request) => {
    Object.values(request.recordWithResponseByRefId).forEach(({ sobject }) => {
      if (sobject) {
        sobjects.add(sobject);
      }
    });
  });
  return Array.from(sobjects);
}

/**
 * Resolve the load's representative operation. When every object shares one operation that value is
 * used; when operations are mixed across objects the entry records `'insert'` and the caller stores
 * the per-object operations in `config` (see `mixed`/`byObject`).
 */
export function getMultiObjectOperations(requests: LoadMultiObjectRequestWithResult[]): {
  operation: DataHistoryOperation;
  byObject: Record<string, string>;
  mixed: boolean;
} {
  const operationsByObject: Record<string, Set<string>> = {};
  requests.forEach((request) => {
    Object.values(request.recordWithResponseByRefId).forEach(({ sobject, operation }) => {
      if (!sobject || !operation) {
        return;
      }
      operationsByObject[sobject] = operationsByObject[sobject] || new Set<string>();
      operationsByObject[sobject].add(operation);
    });
  });

  const allOperations = new Set<string>();
  const byObject: Record<string, string> = {};
  Object.entries(operationsByObject).forEach(([sobject, operations]) => {
    operations.forEach((operation) => allOperations.add(operation));
    byObject[sobject] = Array.from(operations).join(', ');
  });

  const mixed = allOperations.size > 1;
  const [singleOperation] = Array.from(allOperations);
  return {
    operation: mixed || !singleOperation ? 'insert' : multiObjectOperationToDataHistoryOperation(singleOperation),
    byObject,
    mixed,
  };
}

export interface FinalizeMultiObjectHistoryOptions {
  /** Flattened per-record rows for the finished run — the same rows the results tables and download use */
  rows: RecordResultRow[];
  /** The run's requests, used to detect a load where every request failed before Salesforce responded */
  requests: LoadMultiObjectRequestWithResult[];
}

/**
 * Finalize a run's history entry: stream the flattened result rows, then `finish` with counts derived
 * from the same rows. Even when every request failed outright (nothing reached Salesforce) the entry is
 * finished rather than failed, so it keeps the attempted record counts and still gets a manifest written
 * for folder re-indexing. Nothing (not even the row building) happens when the entry is not being
 * captured. Fire-and-forget — the returned promise is only for sequencing in tests.
 */
export function finalizeMultiObjectHistory(
  handle: DataHistoryEntryHandle,
  { rows, requests }: FinalizeMultiObjectHistoryOptions,
): Promise<void> {
  return handle.capture(async () => {
    await handle.appendResultsRows(buildResultsDownloadRows(rows, 'results'), RESULTS_DOWNLOAD_HEADER);
    const allRequestsFailed = requests.length > 0 && requests.every(({ errorMessage }) => !!errorMessage);
    // Records left pending (the run was cancelled before their request was sent) were never
    // attempted, so they are excluded from the entry totals rather than counted as failures.
    const { successCount, failureCount } = getLoadResultsSummary(rows);
    await handle.finish({
      counts: { total: successCount + failureCount, success: successCount, failure: failureCount },
      // The status must be explicit: a request that failed before any record was mapped contributes no
      // counts, which would otherwise be derived as a success
      status: allRequestsFailed ? 'failed' : undefined,
      errorMessage: allRequestsFailed ? requests.find(({ errorMessage }) => errorMessage)?.errorMessage || 'Load failed' : undefined,
    });
  });
}

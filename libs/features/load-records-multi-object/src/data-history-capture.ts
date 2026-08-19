import { DataHistoryOperation, DataHistoryStatus, InsertUpdateUpsert } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import { RESULTS_DOWNLOAD_HEADER, RecordResultRow, buildResultsDownloadRows, getLoadResultsSummary } from './load/load-results-utils';

/**
 * Helpers that adapt the multi-object load feature to the `@jetstream/ui/data-history` capture API.
 * The handle's methods are internally queued, never reject, and no-op when capture is disabled or
 * opted out, so nothing here needs null checks or its own error handling.
 */

function multiObjectOperationToDataHistoryOperation(operation: InsertUpdateUpsert): DataHistoryOperation {
  switch (operation) {
    case 'INSERT':
      return 'insert';
    case 'UPDATE':
      return 'update';
    case 'UPSERT':
      return 'upsert';
    default: {
      const unhandledOperation: never = operation;
      throw new Error(`Unhandled operation: ${unhandledOperation}`);
    }
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
 * used; when operations are mixed across objects the entry records `'mixed'` and the caller stores
 * the per-object operations in `config` (see `mixed`/`byObject`).
 */
export function getMultiObjectOperations(requests: LoadMultiObjectRequestWithResult[]): {
  operation: DataHistoryOperation;
  byObject: Record<string, string>;
  mixed: boolean;
} {
  const operationsByObject: Record<string, Set<InsertUpdateUpsert>> = {};
  requests.forEach((request) => {
    Object.values(request.recordWithResponseByRefId).forEach(({ sobject, operation }) => {
      if (!sobject || !operation) {
        return;
      }
      operationsByObject[sobject] = operationsByObject[sobject] || new Set<InsertUpdateUpsert>();
      operationsByObject[sobject].add(operation);
    });
  });

  const allOperations = new Set<InsertUpdateUpsert>();
  const byObject: Record<string, string> = {};
  Object.entries(operationsByObject).forEach(([sobject, operations]) => {
    operations.forEach((operation) => allOperations.add(operation));
    byObject[sobject] = Array.from(operations).join(', ');
  });

  const mixed = allOperations.size > 1;
  const [singleOperation] = Array.from(allOperations);
  let operation: DataHistoryOperation;
  if (mixed) {
    operation = 'mixed';
  } else if (!singleOperation) {
    // Degenerate case: no record carried an operation at all — keep the historical default
    operation = 'insert';
  } else {
    operation = multiObjectOperationToDataHistoryOperation(singleOperation);
  }
  return { operation, byObject, mixed };
}

export interface FinalizeMultiObjectHistoryOptions {
  /** Flattened per-record rows for the finished run — the same rows the results tables and download use */
  rows: RecordResultRow[];
  /** The run's requests, used to detect a load where every request failed before Salesforce responded */
  requests: LoadMultiObjectRequestWithResult[];
}

/**
 * Finalize a run's history entry: stream the flattened result rows, and `finish` with counts derived
 * from the same rows. Even when every request failed outright (nothing reached Salesforce) the entry is
 * finished rather than failed, so it keeps the attempted record counts and still gets a manifest written
 * for folder re-indexing. The row building happens only when the entry is being captured.
 * Fire-and-forget — the returned promise is only for sequencing in tests.
 *
 * Runs through `handle.finalize`, which finishes the entry with the derived outcome and is one-shot.
 */
export function finalizeMultiObjectHistory(
  handle: DataHistoryEntryHandle,
  { rows, requests }: FinalizeMultiObjectHistoryOptions,
): Promise<void> {
  const allRequestsFailed = requests.length > 0 && requests.every(({ errorMessage }) => !!errorMessage);
  // Records left pending (the run was cancelled before their request was sent) were never
  // attempted, so they are excluded from the entry totals rather than counted as failures.
  const { successCount, failureCount, pendingCount } = getLoadResultsSummary(rows);
  return handle.finalize(
    {
      counts: { total: successCount + failureCount, success: successCount, failure: failureCount },
      status: getFinalStatus({ allRequestsFailed, successCount, failureCount, pendingCount }),
      errorMessage: allRequestsFailed
        ? requests.find(({ errorMessage }) => errorMessage)?.errorMessage || 'Load failed'
        : pendingCount > 0
          ? `The load was cancelled — ${pendingCount.toLocaleString()} ${pendingCount === 1 ? 'record was' : 'records were'} not attempted.`
          : undefined,
    },
    async () => {
      await handle.appendResultsRows(buildResultsDownloadRows(rows, 'results'), RESULTS_DOWNLOAD_HEADER);
    },
  );
}

/**
 * The status has to be explicit in two cases the count-derived default gets wrong: a request that
 * failed before any record was mapped contributes no counts (derived as a success), and a cancelled
 * run leaves pending records that are excluded from the counts — so a run cancelled before anything
 * was sent would also derive as a clean 0/0 success. A cancelled run that did load some records is a
 * partial success; one that loaded nothing has no outcome to report and is `incomplete`.
 */
function getFinalStatus({
  allRequestsFailed,
  successCount,
  failureCount,
  pendingCount,
}: {
  allRequestsFailed: boolean;
  successCount: number;
  failureCount: number;
  pendingCount: number;
}): DataHistoryStatus | undefined {
  if (allRequestsFailed) {
    return 'failed';
  }
  if (pendingCount > 0) {
    return successCount + failureCount > 0 ? 'partial' : 'incomplete';
  }
  return undefined;
}

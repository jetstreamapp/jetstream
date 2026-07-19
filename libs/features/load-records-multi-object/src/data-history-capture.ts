import { DataHistoryInputSource, DataHistoryOperation, LocalOrGoogle, Maybe } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import { RESULTS_DOWNLOAD_HEADER, RecordResultRow, buildResultsDownloadRows, getLoadResultsSummary } from './load/load-results-utils';

/**
 * Thin helpers that adapt the multi-object load feature to the `@jetstream/ui/data-history` capture
 * API. The handle is threaded as a promise (it resolves to `null` when capture is disabled or opted
 * out). Every wrapper is fire-and-forget and swallows rejections so history capture can NEVER slow
 * down or break a load — the capture methods themselves are internally queued and never reject.
 */
export type DataHistoryHandlePromise = Promise<DataHistoryEntryHandle | null>;

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

export function buildMultiObjectInputSource({
  filename,
  filenameType,
  googleFileId,
}: {
  filename: Maybe<string>;
  filenameType: Maybe<LocalOrGoogle>;
  googleFileId: Maybe<string>;
}): DataHistoryInputSource {
  const isGoogle = filenameType === 'google';
  return {
    type: isGoogle ? 'google' : 'local',
    fileName: filename ?? undefined,
    googleFileId: isGoogle ? (googleFileId ?? undefined) : undefined,
  };
}

/** Persist the composite-graph request payload (fire-and-forget) */
export function writeMultiObjectRequestJson(handle: Maybe<DataHistoryHandlePromise>, payload: unknown): void {
  if (!handle) {
    return;
  }
  void handle.then((resolved) => resolved?.writeRequestJson(payload)).catch(() => undefined);
}

export interface FinalizeMultiObjectHistoryOptions {
  /** Flattened per-record rows for the finished run — the same rows the results tables and download use */
  rows: RecordResultRow[];
  /** The run's requests, used to detect a load where every request failed before Salesforce responded */
  requests: LoadMultiObjectRequestWithResult[];
}

/**
 * Finalize a run's history entry: stream the flattened result rows, then `finish` with counts derived
 * from the same rows. When every request failed outright (nothing reached Salesforce) the entry is
 * marked `fail` with that error instead. Fire-and-forget and never throws.
 */
export function finalizeMultiObjectHistory(
  handle: Maybe<DataHistoryHandlePromise>,
  { rows, requests }: FinalizeMultiObjectHistoryOptions,
): void {
  if (!handle) {
    return;
  }
  void handle
    .then((resolved) => {
      if (!resolved) {
        return;
      }
      const allRequestsFailed = requests.length > 0 && requests.every(({ errorMessage }) => !!errorMessage);
      if (allRequestsFailed) {
        resolved.fail(requests.find(({ errorMessage }) => !!errorMessage)?.errorMessage || 'Load failed');
        return;
      }
      const downloadRows = buildResultsDownloadRows(rows, 'results');
      if (downloadRows.length > 0) {
        resolved.appendResultsRows(downloadRows, RESULTS_DOWNLOAD_HEADER);
      }
      // Records left pending (the run was cancelled before their request was sent) were never
      // attempted, so they are excluded from the entry totals rather than counted as failures.
      const { successCount, failureCount } = getLoadResultsSummary(rows);
      resolved.finish({ counts: { total: successCount + failureCount, success: successCount, failure: failureCount } });
    })
    .catch(() => undefined);
}

import { DataHistoryOperation, InsertUpdateUpsert } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { buildMultiObjectResultRows, getMultiObjectCounts, MULTI_OBJECT_RESULTS_HEADER } from './load-records-multi-object-results';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

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
export function getMultiObjectDistinctSobjects(data: LoadMultiObjectRequestWithResult[]): string[] {
  const sobjects = new Set<string>();
  data.forEach((item) => {
    Object.values(item.recordWithResponseByRefId).forEach(({ sobject }) => {
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
export function getMultiObjectOperations(data: LoadMultiObjectRequestWithResult[]): {
  operation: DataHistoryOperation;
  byObject: Record<string, string>;
  mixed: boolean;
} {
  const opsByObject: Record<string, Set<InsertUpdateUpsert>> = {};
  data.forEach((item) => {
    Object.values(item.recordWithResponseByRefId).forEach(({ sobject, operation }) => {
      if (!sobject || !operation) {
        return;
      }
      opsByObject[sobject] = opsByObject[sobject] || new Set<InsertUpdateUpsert>();
      opsByObject[sobject].add(operation);
    });
  });

  const allOperations = new Set<InsertUpdateUpsert>();
  const byObject: Record<string, string> = {};
  Object.entries(opsByObject).forEach(([sobject, operations]) => {
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

/**
 * Finalize a multi-object history entry: stream the flattened result rows, then `finish` with counts
 * derived from the same data. Even when every group failed outright (no group produced any response)
 * the entry is finished rather than failed, so it keeps the attempted record counts and still gets a
 * manifest written for folder re-indexing. Nothing (not even the row building) happens when the entry
 * is not being captured. Fire-and-forget — the returned promise is only for sequencing in tests.
 */
export function finalizeMultiObjectHistory(handle: DataHistoryEntryHandle, data: LoadMultiObjectRequestWithResult[]): Promise<void> {
  return handle.capture(async () => {
    await handle.appendResultsRows(buildMultiObjectResultRows(data, 'results'), MULTI_OBJECT_RESULTS_HEADER);
    const allGroupsFailed = data.length > 0 && data.every((item) => !!item.errorMessage);
    await handle.finish({
      counts: getMultiObjectCounts(data),
      // The status must be explicit: a group that failed before any record was mapped contributes no
      // counts, which would otherwise be derived as a success
      status: allGroupsFailed ? 'failed' : undefined,
      errorMessage: allGroupsFailed ? data.find(({ errorMessage }) => errorMessage)?.errorMessage || 'Load failed' : undefined,
    });
  });
}

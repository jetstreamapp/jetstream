import { DataHistoryInputSource, DataHistoryOperation, LocalOrGoogle, Maybe } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { buildMultiObjectResultRows, getMultiObjectCounts, MULTI_OBJECT_RESULTS_HEADER } from './load-records-multi-object-results';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

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
 * used; when operations are mixed across objects the entry records `'insert'` and the caller stores
 * the per-object operations in `config` (see `mixed`/`byObject`).
 */
export function getMultiObjectOperations(data: LoadMultiObjectRequestWithResult[]): {
  operation: DataHistoryOperation;
  byObject: Record<string, string>;
  mixed: boolean;
} {
  const opsByObject: Record<string, Set<string>> = {};
  data.forEach((item) => {
    Object.values(item.recordWithResponseByRefId).forEach(({ sobject, operation }) => {
      if (!sobject || !operation) {
        return;
      }
      opsByObject[sobject] = opsByObject[sobject] || new Set<string>();
      opsByObject[sobject].add(operation);
    });
  });

  const allOperations = new Set<string>();
  const byObject: Record<string, string> = {};
  Object.entries(opsByObject).forEach(([sobject, operations]) => {
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

/**
 * Finalize a multi-object history entry: stream the flattened result rows, then `finish` with counts
 * derived from the same data. When every group failed outright (no group produced any response) the
 * entry is marked `fail`. Fire-and-forget and never throws.
 */
export function finalizeMultiObjectHistory(handle: Maybe<DataHistoryHandlePromise>, data: LoadMultiObjectRequestWithResult[]): void {
  if (!handle) {
    return;
  }
  void handle
    .then((resolved) => {
      if (!resolved) {
        return;
      }
      const resultRows = buildMultiObjectResultRows(data, 'results');
      if (resultRows.length > 0) {
        resolved.appendResultsRows(resultRows, MULTI_OBJECT_RESULTS_HEADER);
      }
      const allGroupsFailed = data.length > 0 && data.every((item) => !!item.errorMessage);
      if (allGroupsFailed) {
        resolved.fail(data.find((item) => item.errorMessage)?.errorMessage || 'Load failed');
      } else {
        resolved.finish({ counts: getMultiObjectCounts(data) });
      }
    })
    .catch(() => undefined);
}

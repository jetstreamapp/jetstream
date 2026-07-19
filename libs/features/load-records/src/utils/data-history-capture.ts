import {
  ApiMode,
  DataHistoryApi,
  DataHistoryInputSource,
  DataHistoryOperation,
  InsertUpdateUpsertDelete,
  LocalOrGoogle,
  Maybe,
} from '@jetstream/types';
import { DataHistoryEntryHandle, FinishDataHistoryEntryOptions } from '@jetstream/ui/data-history';

/**
 * Thin helpers that adapt the Load Records feature to the `@jetstream/ui/data-history` capture API.
 *
 * The handle is threaded through the results components as a promise (it resolves to `null` when
 * capture is disabled or opted out). Every wrapper here is fire-and-forget and swallows rejections
 * so history capture can NEVER slow down or break a load — the capture methods themselves are
 * internally queued and never reject, and the `.catch` is a belt-and-suspenders guard on the
 * promise plumbing.
 */
export type DataHistoryHandlePromise = Promise<DataHistoryEntryHandle | null>;

export function loadTypeToDataHistoryOperation(loadType: InsertUpdateUpsertDelete): DataHistoryOperation {
  switch (loadType) {
    case 'INSERT':
      return 'insert';
    case 'UPDATE':
      return 'update';
    case 'UPSERT':
      return 'upsert';
    case 'DELETE':
    case 'HARD_DELETE':
      return 'delete';
    default:
      return 'insert';
  }
}

export function apiModeToDataHistoryApi(apiMode: ApiMode): DataHistoryApi {
  return apiMode === 'BATCH' ? 'batch-composite' : 'bulk-v1';
}

export function buildLoadRecordsInputSource({
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

/** Persist the parsed input rows for an entry (fire-and-forget) */
export function writeHistoryInputRows(handle: Maybe<DataHistoryHandlePromise>, rows: Record<string, unknown>[], header: string[]): void {
  if (!handle || rows.length === 0 || header.length === 0) {
    return;
  }
  void handle.then((resolved) => resolved?.writeInputRows(rows, header)).catch(() => undefined);
}

/** Append a chunk of result rows to an entry (fire-and-forget, streams batch-by-batch) */
export function appendHistoryResultsRows(handle: Maybe<DataHistoryHandlePromise>, rows: Record<string, unknown>[], header: string[]): void {
  if (!handle || rows.length === 0 || header.length === 0) {
    return;
  }
  void handle.then((resolved) => resolved?.appendResultsRows(rows, header)).catch(() => undefined);
}

/** Finalize an entry with its counts/status (fire-and-forget) */
export function finishHistoryEntry(handle: Maybe<DataHistoryHandlePromise>, outcome: FinishDataHistoryEntryOptions): void {
  if (!handle) {
    return;
  }
  void handle.then((resolved) => resolved?.finish(outcome)).catch(() => undefined);
}

/** Mark an entry failed after a fatal load error (fire-and-forget) */
export function failHistoryEntry(handle: Maybe<DataHistoryHandlePromise>, errorMessage: string): void {
  if (!handle) {
    return;
  }
  void handle.then((resolved) => resolved?.fail(errorMessage)).catch(() => undefined);
}

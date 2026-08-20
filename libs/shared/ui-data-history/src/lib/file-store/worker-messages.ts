import type { DataHistoryFileOpCommon, DataHistoryFileOpCommonResults } from '@jetstream/types';

/**
 * The postMessage transport of the shared Data History file-op protocol
 * ({@link DataHistoryFileOpCommon}) between `OpfsFileStore` (main thread) and
 * `history-storage.worker.ts`.
 *
 * Types only — this module must have zero runtime footprint so importing it does not grow the worker
 * bundle, hence the `import type` above.
 *
 * Stream ids are allocated CLIENT-side here: a respawned worker restarts its own counters, so
 * worker-side allocation could hand a fresh stream an id a stale handle still holds. (The Electron
 * transport has no respawn and allocates server-side instead.)
 */
export type HistoryWorkerRequestBody = DataHistoryFileOpCommon | { op: 'open-stream'; streamId: number; path: string; gzip: boolean };

/** A request body plus the id the promise-map RPC correlates its response with */
export type HistoryWorkerRequest = HistoryWorkerRequestBody & { id: number };

export interface HistoryWorkerSuccessResponse {
  id: number;
  success: true;
  result?: unknown;
}

export interface HistoryWorkerErrorResponse {
  id: number;
  success: false;
  error: string;
}

export type HistoryWorkerResponse = HistoryWorkerSuccessResponse | HistoryWorkerErrorResponse;

/** `read-file` is a Blob here (structured clone carries Blobs fine); every other op is shared. */
export interface HistoryWorkerResultByOp extends DataHistoryFileOpCommonResults {
  'read-file': Blob;
}

export type OpenStreamResult = HistoryWorkerResultByOp['open-stream'];
export type StreamCloseResult = HistoryWorkerResultByOp['stream-close'];
export type WriteFileResult = HistoryWorkerResultByOp['write-file'];
export type ListEntryDirsResult = HistoryWorkerResultByOp['list-entry-dirs'];

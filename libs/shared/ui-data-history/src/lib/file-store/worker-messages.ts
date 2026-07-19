/**
 * RPC protocol between `OpfsFileStore` (main thread) and `history-storage.worker.ts`.
 * Types only — this module must have zero runtime footprint so importing it does not grow the
 * worker bundle.
 */

export type HistoryWorkerRequest =
  | { id: number; op: 'init' }
  | { id: number; op: 'write-file'; path: string; gzip: boolean; bytes: Uint8Array }
  | { id: number; op: 'open-stream'; path: string; gzip: boolean }
  | { id: number; op: 'stream-write'; streamId: number; bytes: Uint8Array }
  | { id: number; op: 'stream-close'; streamId: number }
  | { id: number; op: 'stream-abort'; streamId: number }
  | { id: number; op: 'read-file'; path: string; gunzip: boolean }
  | { id: number; op: 'delete-dir'; path: string }
  | { id: number; op: 'list-entry-dirs' }
  | { id: number; op: 'estimate' };

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

/**
 * A request without its id, as passed to the RPC client. Plain `Omit` does not distribute over
 * unions (it would collapse the request variants to their common keys), so distribute manually.
 */
export type HistoryWorkerRequestBody = HistoryWorkerRequest extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never;

export interface OpenStreamResult {
  streamId: number;
}

export interface StreamCloseResult {
  bytes: number;
}

export interface WriteFileResult {
  bytes: number;
}

export interface ListEntryDirsResult {
  dirs: Array<{ orgFolder: string; entryKey: string }>;
}

export interface EstimateResult {
  usageBytes?: number;
  quotaBytes?: number;
}

import { DataHistoryStorageBackend } from '@jetstream/types';

/**
 * Pluggable storage backend for Data History payload files.
 *
 * BACKEND-PORTABILITY CONTRACT: implementations exist for OPFS today, with the File System Access
 * API (Chrome/Edge user-chosen folder) and Electron-native filesystem planned. To keep those
 * additive, this interface deals exclusively in backend-agnostic RELATIVE paths
 * (`<orgFolder>/<entryKey>/<fileName>`) and `Uint8Array`/`Blob` payloads — no OPFS types,
 * `FileSystemHandle`s, or absolute paths may appear in this contract or leak out of an
 * implementation.
 */
export interface HistoryFileStore {
  readonly type: DataHistoryStorageBackend;
  readonly capabilities: HistoryFileStoreCapabilities;
  /** Idempotent. Acquire the storage root (and, for future backends, verify permission). */
  init(): Promise<void>;
  /**
   * Open a streaming writer, replacing any existing file at `relativePath`. Chunks passed to
   * `write` are consumed (their buffers may be transferred) — callers must not reuse them.
   */
  createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream>;
  /** One-shot write, replacing any existing file. Returns the size on disk (post-compression). */
  writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }>;
  readFile(relativePath: string, options: { gunzip: boolean }): Promise<Blob>;
  /** Recursively delete an entry directory. Resolves (not rejects) when the directory is absent. */
  deleteEntryDir(relativeDirPath: string): Promise<void>;
  /** Enumerate `<orgFolder>/<entryKey>` directories — used by the orphan/reconcile sweep. */
  listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>>;
  estimate(): Promise<{ usageBytes?: number; quotaBytes?: number } | null>;
}

export interface HistoryFileStoreCapabilities {
  /** Files are visible to the user in their real filesystem (FSA/native backends) */
  userVisibleFiles: boolean;
  /** `init()` may fail on a lost permission that requires a user gesture to restore (FSA) */
  needsPermissionCheck: boolean;
  /** The backend can rebuild Dexie rows from on-disk `manifest.json` files */
  supportsReindex: boolean;
  survivesSiteDataClear: boolean;
}

export interface HistoryWriteStream {
  /** Chunks are consumed (buffer may be transferred) — do not reuse after calling. */
  write(chunk: Uint8Array): Promise<void>;
  /** Finalize (flush gzip trailer etc.) and return the total size on disk. */
  close(): Promise<{ bytes: number }>;
  /** Best-effort: discard the partial file. */
  abort(): Promise<void>;
}

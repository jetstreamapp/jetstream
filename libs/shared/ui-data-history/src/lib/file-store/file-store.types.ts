import { DataHistoryStorageBackend } from '@jetstream/types';

/**
 * Pluggable storage backend for Data History payload files.
 *
 * BACKEND-PORTABILITY CONTRACT: three implementations share it — OPFS (every user's default), the
 * File System Access API (Chrome/Edge user-chosen folder) and the Electron-native filesystem — and
 * entries on different backends coexist, so this interface deals exclusively in backend-agnostic
 * RELATIVE paths (`<orgFolder>/<entryKey>/<fileName>`) and `Uint8Array`/`Blob` payloads — no OPFS
 * types, `FileSystemHandle`s, or absolute paths may appear in this contract or leak out of an
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
  /**
   * Read a payload back. `maxBytes` caps the read AT THE SOURCE and must be honored there rather
   * than by slicing a fully-read Blob: the in-modal preview only ever shows a couple of MB, but a
   * results file from a large bulk load runs to hundreds of MB — and reading it whole means
   * inflating the entire gzip stream (OPFS) or pulling every byte across IPC (desktop) to display
   * the head of it. Omit for downloads and migration, which genuinely need the whole file.
   *
   * Read `maxBytes + 1` when the caller needs to know whether the file was longer than the cap.
   */
  readFile(relativePath: string, options: { gunzip: boolean; maxBytes?: number }): Promise<Blob>;
  /** Recursively delete an entry directory. Resolves (not rejects) when the directory is absent. */
  deleteEntryDir(relativeDirPath: string): Promise<void>;
  /** Enumerate `<orgFolder>/<entryKey>` directories — used by the orphan/reconcile sweep. */
  listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>>;
  /**
   * Release any owned resources (e.g. the OPFS worker thread) when the store is discarded — called
   * by the factory when the active/cached stores are reset after a backend change. Idempotent.
   */
  dispose?(): void;
}

export interface HistoryFileStoreCapabilities {
  /** Files are visible to the user in their real filesystem (FSA/native backends) */
  userVisibleFiles: boolean;
  /**
   * Whether NEW payload files should be gzip'd in this backend. True for invisible quota-bound
   * storage (OPFS); false for user-visible backends where plain .csv/.json files the user can
   * open directly are the point. Stores must still honor the explicit gzip/gunzip flags either
   * way — existing files carry their own `compressed` flag.
   */
  compressFiles: boolean;
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

import { z } from 'zod';

/**
 * Schemas + inferred types for the local "Data History" feature — a device-local log of data
 * modifications (data loads, mass updates, query grid edits, record modal saves).
 *
 * Metadata rows live in Dexie (`data_history` table); request/result payloads live in a pluggable
 * file store (OPFS by default; File System Access API user-chosen folder on Chromium, Electron-native
 * filesystem on desktop). User-facing docs: apps/docs/docs/load/data-history.mdx.
 *
 * BACKEND-PORTABILITY CONTRACT: rows store only backend-agnostic RELATIVE paths (never absolute
 * paths or FileSystemHandles) plus a per-entry `storageBackend` stamp so entries can live in
 * different backends simultaneously during a migration.
 */

export const dataHistorySourceSchema = z.enum([
  'load-records',
  'load-multi-object',
  'mass-update',
  'mass-update-from-query',
  'query-table-edit',
  'record-modal',
  'create-record',
]);
export type DataHistorySource = z.infer<typeof dataHistorySourceSchema>;

export const dataHistoryOperationSchema = z.enum(['insert', 'update', 'upsert', 'delete', 'create', 'edit', 'clone', 'mixed']);
export type DataHistoryOperation = z.infer<typeof dataHistoryOperationSchema>;

export const dataHistoryApiSchema = z.enum(['bulk-v1', 'batch-composite', 'composite-graph', 'collections']);
export type DataHistoryApi = z.infer<typeof dataHistoryApiSchema>;

/**
 * `incomplete` = an `in-progress` entry that was stranded (crash/refresh mid-load) and reclassified
 * by the init sweep. It never transitions anywhere else.
 */
export const dataHistoryStatusSchema = z.enum(['in-progress', 'success', 'partial', 'failed', 'incomplete']);
export type DataHistoryStatus = z.infer<typeof dataHistoryStatusSchema>;

export const dataHistoryFileKindSchema = z.enum(['input', 'request', 'results']);
export type DataHistoryFileKind = z.infer<typeof dataHistoryFileKindSchema>;

export const dataHistoryStorageBackendSchema = z.enum(['opfs', 'directory', 'native']);
export type DataHistoryStorageBackend = z.infer<typeof dataHistoryStorageBackendSchema>;

export const dataHistoryFileRefSchema = z.object({
  kind: dataHistoryFileKindSchema,
  /** Relative path within the history root: `<orgFolder>/<entryKey>/<fileName>` */
  path: z.string(),
  fileName: z.string(),
  contentType: z.enum(['text/csv', 'application/json']),
  compressed: z.boolean(),
  /** Size on disk (compressed size when `compressed` is true) */
  bytes: z.number(),
  rowCount: z.number().optional(),
});
export type DataHistoryFileRef = z.infer<typeof dataHistoryFileRefSchema>;

export const dataHistoryCountsSchema = z.object({
  total: z.number(),
  success: z.number(),
  failure: z.number(),
  /** Client-side failures that were never submitted to Salesforce (e.g. prepare/transform errors) */
  processingErrors: z.number().optional(),
});
export type DataHistoryCounts = z.infer<typeof dataHistoryCountsSchema>;

export const dataHistoryInputSourceSchema = z.object({
  type: z.enum(['local', 'google', 'paste', 'inline']),
  fileName: z.string().optional(),
  googleFileId: z.string().optional(),
});
export type DataHistoryInputSource = z.infer<typeof dataHistoryInputSourceSchema>;

/**
 * Dexie row shape for `data_history`. This is the searchable catalog — every payload lives in the
 * file store as a real file and is only read on demand. An entry's payloads ARE its `files`; there
 * is no second storage mode.
 */
export const dataHistoryItemSchema = z.object({
  /** `dh_<uuid>` — also used as the entry's directory name in the file store */
  key: z.string(),
  /** SalesforceOrgUi.uniqueId */
  org: z.string(),
  /** Display label snapshot so history remains meaningful if the org is later removed */
  orgLabel: z.string(),
  source: dataHistorySourceSchema,
  operation: dataHistoryOperationSchema,
  api: dataHistoryApiSchema,
  /** One entry for most flows; multiple for load-multi-object */
  sobjects: z.array(z.string()),
  status: dataHistoryStatusSchema,
  counts: dataHistoryCountsSchema,
  /**
   * Small config snapshot (field mapping, load options, mass-update transformation criteria, etc.).
   * This is metadata, not data — large payloads belong in the file store.
   */
  config: z.record(z.string(), z.unknown()),
  inputSource: dataHistoryInputSourceSchema.optional(),
  /** Salesforce Bulk API job id, where applicable */
  jobId: z.string().optional(),
  /** Links a retry run back to the entry it retried */
  parentKey: z.string().optional(),
  files: z.array(dataHistoryFileRefSchema),
  storageBackend: dataHistoryStorageBackendSchema,
  /** Sum of files[].bytes — quota accounting without touching the file store */
  sizeBytes: z.number(),
  pinned: z.boolean(),
  /** Booleans cannot be Dexie indexes — mirrored from `pinned` via creating/updating hooks */
  pinnedIdx: z.enum(['true', 'false']),
  errorMessage: z.string().nullable(),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DataHistoryItem = z.infer<typeof dataHistoryItemSchema>;

/**
 * The Data History file-operation protocol, defined ONCE for the two transports that execute it:
 * the browser's OPFS storage worker (`history-storage.worker.ts`, over postMessage) and the Electron
 * main process (`data-history-file.service.ts`, over IPC). Each transport re-exports these with only
 * the parts that genuinely differ layered on top, so an op cannot be added to one side alone:
 *
 * - `open-stream` — the worker takes a CLIENT-allocated `streamId` (a respawned worker restarts its
 *   own counters, so a stale handle must not be able to route into a live stream), while the main
 *   process allocates and returns one.
 * - `read-file` — a `Blob` over structured clone, raw bytes over IPC (Blobs are not IPC-serializable).
 *
 * Type-only by design: the worker bundle must stay dependency-free, so consumers `import type`.
 */
export type DataHistoryFileOpCommon =
  /** `scopeDir` is the per-user directory inside the history root that all paths resolve under */
  | { op: 'init'; scopeDir: string }
  | { op: 'write-file'; path: string; gzip: boolean; bytes: Uint8Array }
  | { op: 'stream-write'; streamId: number; bytes: Uint8Array }
  | { op: 'stream-close'; streamId: number }
  | { op: 'stream-abort'; streamId: number }
  /** `maxBytes` caps the read at the source — see `HistoryFileStore.readFile` for why that matters */
  | { op: 'read-file'; path: string; gunzip: boolean; maxBytes?: number }
  | { op: 'delete-dir'; path: string }
  | { op: 'list-entry-dirs' };

/**
 * Result shape per op for every op whose result is identical across transports. `read-file` is
 * deliberately absent — it is the one result that differs, so each transport declares it and cannot
 * forget to.
 */
export interface DataHistoryFileOpCommonResults {
  init: void;
  'write-file': { bytes: number };
  'open-stream': { streamId: number };
  'stream-write': void;
  'stream-close': { bytes: number };
  'stream-abort': void;
  'delete-dir': void;
  'list-entry-dirs': { dirs: Array<{ orgFolder: string; entryKey: string }> };
}

export const dataHistorySettingsSchema = z.object({
  enabled: z.boolean(),
  retentionDays: z.number(),
});
export type DataHistorySettings = z.infer<typeof dataHistorySettingsSchema>;

/**
 * Resolved storage limits for the signed-in user's plan. The tiers themselves (and the platform
 * rules that pick one) live in `data-history-limits.ts` in `@jetstream/ui/data-history`; only the
 * SHAPE lives here, so app state can hold the resolved limits without depending on the storage
 * library — see `dataHistoryLimitsState`.
 */
export interface DataHistoryTierLimits {
  /** Internal size backstop — never surfaced as a user control */
  maxTotalBytes: number;
  /** Maximum stored entries (null = unlimited). The free-tier cap. */
  maxEntries: number | null;
  retentionDaysMax: number;
  defaultRetentionDays: number;
}

/**
 * Value of the `data_history_config` row with key `backend`. `directoryHandle` is a persisted
 * `FileSystemDirectoryHandle` (structured-cloneable); typed loosely because this lib is also
 * consumed outside the DOM. This config row is the ONLY place a handle may be stored.
 */
export interface DataHistoryBackendConfig {
  active: DataHistoryStorageBackend;
  directoryHandle?: unknown;
  nativePath?: string;
}

/** Dexie row shape for `data_history_config` — fixed keys, one row per concern */
export interface DataHistoryConfigItem {
  key: 'settings' | 'backend' | 'paidPlanLastSeenAt' | 'deletedEntryTombstones';
  value: unknown;
  updatedAt: Date;
}

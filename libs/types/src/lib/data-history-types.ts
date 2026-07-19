import { z } from 'zod';

/**
 * Schemas + inferred types for the local "Data History" feature — a device-local log of data
 * modifications (data loads, mass updates, query grid edits, record modal saves).
 *
 * Metadata rows live in Dexie (`data_history` table); large request/result payloads live in a
 * pluggable file store (OPFS by default; File System Access API and Electron-native filesystem are
 * planned backends). See tmp/data-history-plan/02-data-model-and-flow.md for the full design.
 *
 * BACKEND-PORTABILITY CONTRACT: rows store only backend-agnostic RELATIVE paths (never absolute
 * paths or FileSystemHandles) plus a per-entry `storageBackend` stamp so entries can live in
 * different backends simultaneously during a migration.
 */

export const dataHistorySourceSchema = z.enum([
  'load-records',
  'load-custom-metadata',
  'load-multi-object',
  'mass-update',
  'mass-update-from-query',
  'query-table-edit',
  'record-modal',
  'create-record',
]);
export type DataHistorySource = z.infer<typeof dataHistorySourceSchema>;

export const dataHistoryOperationSchema = z.enum(['insert', 'update', 'upsert', 'delete', 'undelete', 'create', 'edit', 'clone']);
export type DataHistoryOperation = z.infer<typeof dataHistoryOperationSchema>;

export const dataHistoryApiSchema = z.enum(['bulk-v1', 'batch-composite', 'composite-graph', 'collections', 'metadata']);
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
 * Dexie row shape for `data_history`. This is the searchable catalog — payloads live in the file
 * store (or `inlinePayload` for small single-record actions) and are only decoded on demand.
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
  /** Sum of files[].bytes + inlinePayload size — quota accounting without touching the file store */
  sizeBytes: z.number(),
  /**
   * Escape hatch for tiny single-record actions: gzip-compressed JSON of
   * `DataHistoryInlinePayload` instead of file-store churn. List views must NOT decode this.
   */
  inlinePayload: z.instanceof(Uint8Array).nullable(),
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

/** Decoded shape of `DataHistoryItem.inlinePayload` */
export interface DataHistoryInlinePayload {
  request: unknown;
  results: unknown;
}

export const dataHistorySettingsSchema = z.object({
  enabled: z.boolean(),
  retentionDays: z.number(),
});
export type DataHistorySettings = z.infer<typeof dataHistorySettingsSchema>;

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
  key: 'settings' | 'backend';
  value: unknown;
  updatedAt: Date;
}

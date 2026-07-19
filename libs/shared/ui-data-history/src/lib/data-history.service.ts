import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage, gzipDecode, gzipEncode } from '@jetstream/shared/utils';
import {
  DataHistoryApi,
  DataHistoryCounts,
  DataHistoryFileKind,
  DataHistoryFileRef,
  DataHistoryInlinePayload,
  DataHistoryInputSource,
  DataHistoryItem,
  DataHistoryOperation,
  DataHistorySettings,
  DataHistorySource,
  DataHistoryStatus,
  SalesforceOrgUi,
} from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { serializeRowsToCsvChunks } from './csv-utils';
import { DATA_HISTORY_INLINE_PAYLOAD_MAX_BYTES, DataHistoryTierLimits, getDataHistoryTierLimits } from './data-history-limits';
import { buildManifestJson } from './data-history-manifest';
import { pruneEntryCountOverage, runDataHistoryRetentionSweep } from './data-history-retention';
import {
  deleteEntryFilesAndRow,
  deriveStatusFromCounts,
  getEffectiveSettings,
  getTierLimits,
  requestPersistOnce,
  setTierLimits,
} from './data-history-state';
import { getFileStoreForBackend, getHistoryFileStore } from './file-store/file-store-factory';
import { HistoryFileStore, HistoryWriteStream } from './file-store/file-store.types';
import { DATA_HISTORY_FILE_NAMES, getEntryFilePath, getOrgFolderName } from './file-store/path-utils';

/**
 * Public capture + management API for the local Data History feature.
 *
 * FAILURE-ISOLATION RULE (the top regression risk of this feature): history capture must NEVER
 * break a user's data operation. Every public capture function catches internally, logs, and
 * resolves — `startDataHistoryEntry` returns null instead of throwing, and every
 * `DataHistoryEntryHandle` method routes through an internal queue whose errors mark the entry
 * failed rather than propagating to the caller.
 */

const TEXT_ENCODER = new TextEncoder();

export interface StartDataHistoryEntryOptions {
  org: SalesforceOrgUi;
  source: DataHistorySource;
  operation: DataHistoryOperation;
  api: DataHistoryApi;
  sobjects: string[];
  /** Small config snapshot (field mapping, load options, transformation criteria, ...) */
  config?: Record<string, unknown>;
  inputSource?: DataHistoryInputSource;
  jobId?: string;
  /** Links a retry run to the entry it retried */
  parentKey?: string;
  /** Per-run "don't save this one" opt-out — when true the entry is silently not captured */
  skipHistory?: boolean;
}

export interface FinishDataHistoryEntryOptions {
  counts: DataHistoryCounts;
  /** Derived from counts when omitted (failure=0 -> success, mixed -> partial, none -> failed) */
  status?: DataHistoryStatus;
  jobId?: string;
  errorMessage?: string;
}

export interface RecordDataHistoryActionOptions extends Omit<StartDataHistoryEntryOptions, 'jobId' | 'parentKey'> {
  request: unknown;
  results: unknown;
  counts: DataHistoryCounts;
  status?: DataHistoryStatus;
  errorMessage?: string;
}

export interface DataHistoryStorageHealth {
  entryCount: number;
  usedBytes: number;
  /** Internal size backstop from the tier — not a user setting */
  maxTotalBytes: number;
  /** Tier entry-count cap (null = unlimited) */
  maxEntries: number | null;
  /** Null when the browser does not expose persisted() */
  persisted: boolean | null;
  estimate: { usageBytes?: number; quotaBytes?: number } | null;
}

/**
 * Initialize the feature for the session. Establishes tier limits and kicks off the retention/
 * reconcile sweep in the background when any history exists. Safe to call multiple times (e.g.
 * when the ability/profile changes). Never throws.
 */
export async function initDataHistory(options: { hasPaidPlan: boolean }): Promise<void> {
  try {
    setTierLimits(getDataHistoryTierLimits(options));
    if (await isDataHistoryCaptureEnabled()) {
      // Protect history from automatic browser eviction — done on the user's behalf, no setting
      void requestPersistOnce();
    }
    const entryCount = await dataHistoryDb.getEntryCount();
    if (entryCount > 0) {
      void runDataHistoryRetentionSweep();
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error initializing data history', ex);
  }
}

/** Resolved tier limits for this session (null before initialization) — for settings UI display */
export function getDataHistoryLimits(): DataHistoryTierLimits | null {
  return getTierLimits();
}

/** Whether capture is currently active (initialized + not disabled in settings) */
export async function isDataHistoryCaptureEnabled(): Promise<boolean> {
  try {
    const settings = await getEffectiveSettings();
    return !!settings?.enabled;
  } catch {
    return false;
  }
}

/**
 * Begin a history entry for a long-running flow (data load, mass update). Returns null when
 * history is disabled, opted out for this run, not initialized, or on any internal failure —
 * callers must tolerate null silently (optional chaining is the expected call pattern).
 */
export async function startDataHistoryEntry(options: StartDataHistoryEntryOptions): Promise<DataHistoryEntryHandle | null> {
  try {
    if (options.skipHistory || !(await isDataHistoryCaptureEnabled())) {
      return null;
    }
    const store = await getHistoryFileStore();
    const orgFolder = await getOrgFolderName(options.org.uniqueId);
    const now = new Date();
    const item: DataHistoryItem = {
      key: dataHistoryDb.generateKey(),
      org: options.org.uniqueId,
      orgLabel: options.org.label || options.org.uniqueId,
      source: options.source,
      operation: options.operation,
      api: options.api,
      sobjects: options.sobjects,
      status: 'in-progress',
      counts: { total: 0, success: 0, failure: 0 },
      config: options.config || {},
      inputSource: options.inputSource,
      jobId: options.jobId,
      parentKey: options.parentKey,
      files: [],
      storageBackend: store.type,
      sizeBytes: 0,
      inlinePayload: null,
      pinned: false,
      pinnedIdx: 'false',
      errorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await dataHistoryDb.saveEntry(item);
    void requestPersistOnce();
    void pruneEntryCountOverage();
    return new DataHistoryEntryHandle(item, orgFolder, store);
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to start history entry', ex);
    return null;
  }
}

/**
 * Handle for an in-flight history entry. All methods are queued and fire-and-forget safe: any
 * internal error marks the entry `failed` and subsequent calls become no-ops — nothing ever
 * rejects into the calling flow. Await individual calls (or `flush()`) only when sequencing
 * matters, e.g. in tests.
 */
export class DataHistoryEntryHandle {
  readonly key: string;

  private item: DataHistoryItem;
  private readonly orgFolder: string;
  private readonly store: HistoryFileStore;
  private queue: Promise<void> = Promise.resolve();
  private failed = false;
  private finished = false;
  private resultsStream: HistoryWriteStream | null = null;
  private resultsHeaderWritten = false;
  private resultsRowCount = 0;

  constructor(item: DataHistoryItem, orgFolder: string, store: HistoryFileStore) {
    this.item = item;
    this.key = item.key;
    this.orgFolder = orgFolder;
    this.store = store;
  }

  /** Persist the parsed input rows as `input.csv.gz` */
  writeInputRows(rows: Record<string, unknown>[], header: string[]): Promise<void> {
    return this.run(async () => {
      const stream = await this.store.createWriteStream(this.filePath(DATA_HISTORY_FILE_NAMES.inputCsv), { gzip: true });
      try {
        for (const chunk of serializeRowsToCsvChunks(rows, header, { includeHeader: true })) {
          await stream.write(chunk);
        }
        const { bytes } = await stream.close();
        await this.addFileRef({
          kind: 'input',
          path: this.filePath(DATA_HISTORY_FILE_NAMES.inputCsv),
          fileName: DATA_HISTORY_FILE_NAMES.inputCsv,
          contentType: 'text/csv',
          compressed: true,
          bytes,
          rowCount: rows.length,
        });
      } catch (ex) {
        await abortQuietly(stream);
        throw ex;
      }
    });
  }

  /** Persist the exact request payload (JSON) as `request.json.gz` */
  writeRequestJson(payload: unknown): Promise<void> {
    return this.run(async () => {
      const path = this.filePath(DATA_HISTORY_FILE_NAMES.requestJson);
      const { bytes } = await this.store.writeFile(path, TEXT_ENCODER.encode(JSON.stringify(payload)), { gzip: true });
      await this.addFileRef({
        kind: 'request',
        path,
        fileName: DATA_HISTORY_FILE_NAMES.requestJson,
        contentType: 'application/json',
        compressed: true,
        bytes,
        rowCount: Array.isArray(payload) ? payload.length : undefined,
      });
    });
  }

  /**
   * Append per-record result rows to `results.csv.gz`, streaming batch-by-batch as results arrive
   * so large result sets are never duplicated in memory. The header is written on the first
   * non-empty call; pass the same header every time.
   */
  appendResultsRows(rows: Record<string, unknown>[], header: string[]): Promise<void> {
    return this.run(async () => {
      if (rows.length === 0) {
        return;
      }
      if (!this.resultsStream) {
        this.resultsStream = await this.store.createWriteStream(this.filePath(DATA_HISTORY_FILE_NAMES.resultsCsv), { gzip: true });
        this.resultsHeaderWritten = false;
      }
      for (const chunk of serializeRowsToCsvChunks(rows, header, { includeHeader: !this.resultsHeaderWritten })) {
        await this.resultsStream.write(chunk);
      }
      this.resultsHeaderWritten = true;
      this.resultsRowCount += rows.length;
    });
  }

  /** Finalize the entry: close streams, set status/counts, and write the manifest */
  finish(outcome: FinishDataHistoryEntryOptions): Promise<void> {
    return this.run(async () => {
      if (this.resultsStream) {
        const { bytes } = await this.resultsStream.close();
        this.resultsStream = null;
        await this.addFileRef({
          kind: 'results',
          path: this.filePath(DATA_HISTORY_FILE_NAMES.resultsCsv),
          fileName: DATA_HISTORY_FILE_NAMES.resultsCsv,
          contentType: 'text/csv',
          compressed: true,
          bytes,
          rowCount: this.resultsRowCount,
        });
      }
      this.item = {
        ...this.item,
        status: outcome.status ?? deriveStatusFromCounts(outcome.counts),
        counts: outcome.counts,
        jobId: outcome.jobId ?? this.item.jobId,
        errorMessage: outcome.errorMessage ?? null,
        finishedAt: new Date(),
      };
      await dataHistoryDb.updateEntry(this.key, {
        status: this.item.status,
        counts: this.item.counts,
        jobId: this.item.jobId,
        errorMessage: this.item.errorMessage,
        finishedAt: this.item.finishedAt,
      });
      await this.writeManifest();
      this.finished = true;
    });
  }

  /** Mark the entry failed (e.g. the load itself hit a fatal error) */
  fail(errorMessage: string): Promise<void> {
    return this.run(async () => {
      await this.markFailed(errorMessage);
    });
  }

  /** Resolves when all queued work has settled — primarily for tests and results components */
  flush(): Promise<void> {
    return this.queue;
  }

  private filePath(fileName: string): string {
    return getEntryFilePath(this.orgFolder, this.key, fileName);
  }

  /**
   * Serialize work per entry and convert any error into a failed entry instead of a rejection.
   * The returned promise NEVER rejects.
   */
  private run(task: () => Promise<void>): Promise<void> {
    const next = this.queue.then(async () => {
      if (this.failed || this.finished) {
        return;
      }
      try {
        await task();
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Capture step failed for entry', this.key, ex);
        await this.markFailed(getErrorMessage(ex));
      }
    });
    this.queue = next;
    return next;
  }

  private async markFailed(errorMessage: string): Promise<void> {
    if (this.failed) {
      return;
    }
    this.failed = true;
    if (this.resultsStream) {
      await abortQuietly(this.resultsStream);
      this.resultsStream = null;
    }
    try {
      await dataHistoryDb.updateEntry(this.key, { status: 'failed', errorMessage, finishedAt: new Date() });
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to mark entry as failed', this.key, ex);
    }
  }

  private async addFileRef(fileRef: DataHistoryFileRef): Promise<void> {
    this.item = {
      ...this.item,
      files: [...this.item.files.filter(({ kind }) => kind !== fileRef.kind), fileRef],
    };
    this.item.sizeBytes = this.item.files.reduce((total, file) => total + file.bytes, 0);
    await dataHistoryDb.updateEntry(this.key, { files: this.item.files, sizeBytes: this.item.sizeBytes });
  }

  private async writeManifest(): Promise<void> {
    await this.store.writeFile(this.filePath(DATA_HISTORY_FILE_NAMES.manifest), TEXT_ENCODER.encode(buildManifestJson(this.item)), {
      gzip: false,
    });
  }
}

/**
 * One-shot capture for synchronous flows (record modal, create record, query table edits).
 * Small payloads are stored inline in the Dexie row (gzip) to avoid file-store churn for frequent
 * single-record edits; larger ones are written as files. Never throws.
 */
export async function recordDataHistoryAction(options: RecordDataHistoryActionOptions): Promise<void> {
  try {
    if (options.skipHistory || !(await isDataHistoryCaptureEnabled())) {
      return;
    }
    const { request, results, counts } = options;
    const now = new Date();
    const item: DataHistoryItem = {
      key: dataHistoryDb.generateKey(),
      org: options.org.uniqueId,
      orgLabel: options.org.label || options.org.uniqueId,
      source: options.source,
      operation: options.operation,
      api: options.api,
      sobjects: options.sobjects,
      status: options.status ?? deriveStatusFromCounts(counts),
      counts,
      config: options.config || {},
      inputSource: options.inputSource,
      jobId: undefined,
      parentKey: undefined,
      files: [],
      storageBackend: 'opfs',
      sizeBytes: 0,
      inlinePayload: null,
      pinned: false,
      pinnedIdx: 'false',
      errorMessage: options.errorMessage ?? null,
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const payloadJson = JSON.stringify({ request, results });
    if (TEXT_ENCODER.encode(payloadJson).byteLength <= DATA_HISTORY_INLINE_PAYLOAD_MAX_BYTES) {
      item.inlinePayload = await gzipEncode({ request, results });
      item.sizeBytes = item.inlinePayload.byteLength;
    } else {
      const store = await getHistoryFileStore();
      item.storageBackend = store.type;
      const orgFolder = await getOrgFolderName(options.org.uniqueId);
      const requestPath = getEntryFilePath(orgFolder, item.key, DATA_HISTORY_FILE_NAMES.requestJson);
      const resultsPath = getEntryFilePath(orgFolder, item.key, DATA_HISTORY_FILE_NAMES.resultsJson);
      const requestFile = await store.writeFile(requestPath, TEXT_ENCODER.encode(JSON.stringify(request)), { gzip: true });
      const resultsFile = await store.writeFile(resultsPath, TEXT_ENCODER.encode(JSON.stringify(results)), { gzip: true });
      item.files = [
        {
          kind: 'request',
          path: requestPath,
          fileName: DATA_HISTORY_FILE_NAMES.requestJson,
          contentType: 'application/json',
          compressed: true,
          bytes: requestFile.bytes,
          rowCount: Array.isArray(request) ? request.length : undefined,
        },
        {
          kind: 'results',
          path: resultsPath,
          fileName: DATA_HISTORY_FILE_NAMES.resultsJson,
          contentType: 'application/json',
          compressed: true,
          bytes: resultsFile.bytes,
          rowCount: Array.isArray(results) ? results.length : undefined,
        },
      ];
      item.sizeBytes = requestFile.bytes + resultsFile.bytes;
      const manifestPath = getEntryFilePath(orgFolder, item.key, DATA_HISTORY_FILE_NAMES.manifest);
      await store.writeFile(manifestPath, TEXT_ENCODER.encode(buildManifestJson(item)), { gzip: false });
    }

    await dataHistoryDb.saveEntry(item);
    void requestPersistOnce();
    void pruneEntryCountOverage();
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to record history action', ex);
  }
}

/**
 * Read a payload back for viewing/downloading. Returns null when the entry has no data of the
 * requested kind. The returned fileName has the `.gz` suffix stripped (content is decompressed).
 */
export async function readDataHistoryFile(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
): Promise<{ blob: Blob; fileName: string; contentType: 'text/csv' | 'application/json' } | null> {
  const fileRef = item.files.find((file) => file.kind === kind);
  if (fileRef) {
    const store = await getFileStoreForBackend(item.storageBackend);
    const blob = await store.readFile(fileRef.path, { gunzip: fileRef.compressed });
    return { blob, fileName: fileRef.fileName.replace(/\.gz$/, ''), contentType: fileRef.contentType };
  }
  if (item.inlinePayload && (kind === 'request' || kind === 'results')) {
    const payload = await gzipDecode<DataHistoryInlinePayload>(item.inlinePayload);
    const value = kind === 'request' ? payload.request : payload.results;
    return {
      blob: new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
      fileName: `${kind}.json`,
      contentType: 'application/json',
    };
  }
  return null;
}

export async function setDataHistoryPinned(key: string, pinned: boolean): Promise<void> {
  await dataHistoryDb.setPinned(key, pinned);
}

export async function deleteDataHistoryEntry(key: string): Promise<void> {
  const item = await dataHistoryDb.getEntry(key);
  if (!item) {
    return;
  }
  try {
    await deleteEntryFilesAndRow(item);
  } catch (ex) {
    // Row removal wins over stranded files — the orphan sweep cleans those up later
    logger.warn('[DATA_HISTORY] Error deleting entry files, removing row anyway', key, ex);
    await dataHistoryDb.deleteEntries([key]);
  }
}

export async function deleteAllDataHistory(): Promise<void> {
  const entries = await dataHistoryDb.getAllEntries();
  for (const entry of entries) {
    await deleteDataHistoryEntry(entry.key);
  }
}

export async function getDataHistorySettings(): Promise<DataHistorySettings | null> {
  return await getEffectiveSettings();
}

export async function setDataHistoryEnabled(enabled: boolean): Promise<void> {
  const settings = await getEffectiveSettings();
  if (!settings) {
    return;
  }
  await dataHistoryDb.saveSettings({ ...settings, enabled });
}

export async function updateDataHistoryRetentionSettings(changes: { retentionDays?: number }): Promise<void> {
  const settings = await getEffectiveSettings();
  const tier = getTierLimits();
  if (!settings || !tier) {
    return;
  }
  await dataHistoryDb.saveSettings({
    ...settings,
    retentionDays: changes.retentionDays ?? settings.retentionDays,
  });
  // Apply tighter limits right away rather than waiting for the next app init
  void runDataHistoryRetentionSweep();
}

export async function getDataHistoryStorageHealth(): Promise<DataHistoryStorageHealth | null> {
  try {
    const settings = await getEffectiveSettings();
    const tier = getTierLimits();
    if (!settings || !tier) {
      return null;
    }
    const [entryCount, usedBytes] = await Promise.all([dataHistoryDb.getEntryCount(), dataHistoryDb.getTotalSizeBytes()]);
    let persisted: boolean | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
        persisted = await navigator.storage.persisted();
      }
    } catch {
      persisted = null;
    }
    let estimate: { usageBytes?: number; quotaBytes?: number } | null = null;
    try {
      const store = await getHistoryFileStore();
      estimate = await store.estimate();
    } catch {
      estimate = null;
    }
    return { entryCount, usedBytes, maxTotalBytes: tier.maxTotalBytes, maxEntries: tier.maxEntries, persisted, estimate };
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to compute storage health', ex);
    return null;
  }
}

async function abortQuietly(stream: HistoryWriteStream): Promise<void> {
  try {
    await stream.abort();
  } catch {
    // best-effort cleanup
  }
}

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
  DataHistoryStorageBackend,
  LocalOrGoogle,
  Maybe,
  SalesforceOrgUi,
} from '@jetstream/types';
import { dataHistoryDb, onLocalStorageScopeCleared } from '@jetstream/ui/db';
import { serializeRowsToCsvChunks } from './csv-utils';
import {
  DATA_HISTORY_INLINE_PAYLOAD_MAX_BYTES,
  DATA_HISTORY_PAID_TIER_GRACE_MS,
  DataHistoryTierLimits,
  getDataHistoryTierLimits,
} from './data-history-limits';
import { buildManifestJson } from './data-history-manifest';
import { pruneEntryCountOverage, runDataHistoryRetentionSweep } from './data-history-retention';
import {
  deleteEntryFilesAndRow,
  deriveStatusFromCounts,
  getEffectiveSettings,
  getStoragePersisted,
  getTierLimits,
  isEntryLikelyInFlight,
  isPersistentStoragePromptEligible,
  markEntryActive,
  markEntryInactive,
  requestPersistentStorage,
  requestPersistOnce,
  setTierLimits,
} from './data-history-state';
import { getFileStoreForBackend, getHistoryFileStore, resetHistoryFileStores } from './file-store/file-store-factory';
import { HistoryFileStore, HistoryWriteStream } from './file-store/file-store.types';
import { DATA_HISTORY_FILE_NAMES, getDataHistoryFileName, getEntryFilePath, getOrgFolderName } from './file-store/path-utils';
import { clearDataHistoryUserScope, isDataHistoryUserScope, setDataHistoryUserScope } from './file-store/user-scope';
export { getStoragePersisted, isPersistentStoragePromptEligible, requestPersistentStorage };

/**
 * Public capture + management API for the local Data History feature.
 *
 * FAILURE-ISOLATION RULE (the top regression risk of this feature): history capture must NEVER
 * break a user's data operation. Every public capture function catches internally, logs, and
 * resolves — `startDataHistoryEntry` always returns a usable handle instead of throwing, and every
 * `DataHistoryEntryHandle` method routes through an internal queue whose errors mark the entry
 * failed rather than propagating to the caller. Callers therefore never null-check, never await on
 * a critical path, and never need their own try/catch around capture.
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

/**
 * `inputSource` for a load started from a file — shared by every file-based load surface so the
 * google/local distinction is derived one way.
 */
export function buildDataHistoryInputSource({
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
 *
 * Returns whether capture ended up enabled and the resolved tier limits, which is what every caller
 * needs next (to seed `dataHistoryCaptureEnabledState` / `dataHistoryLimitsState` so feature UI can
 * read them synchronously). `limits` is null only when initialization failed before the tier was
 * resolved.
 *
 * `userId` scopes the payload files on disk to the signed-in account and is REQUIRED — see
 * `user-scope.ts`. It is the same id the caller scopes the local database with, so history files and
 * the history index can never end up bound to different accounts.
 *
 * `hasPaidPlan` is the WEB app's paid signal. Desktop, the browser extension and canvas omit it —
 * `getDataHistoryTierLimits` grants them the top tier from platform detection.
 */
export async function initDataHistory(options: {
  userId: string;
  hasPaidPlan?: boolean;
}): Promise<{ captureEnabled: boolean; limits: DataHistoryTierLimits | null }> {
  try {
    registerStorageScopeTeardownOnce();
    // Re-scoping to a different user must not leave stores cached against the previous account's
    // tree — they are resolved lazily, so dropping them here is enough to rebuild on next use.
    if (!isDataHistoryUserScope(options.userId)) {
      resetHistoryFileStores();
    }
    setDataHistoryUserScope(options.userId);
    const hasPaidPlan = await resolvePaidPlanWithGrace(options?.hasPaidPlan ?? false);
    setTierLimits(getDataHistoryTierLimits({ hasPaidPlan }));
    const captureEnabled = await isDataHistoryCaptureEnabled();
    if (captureEnabled) {
      // Protect history from automatic browser eviction — done on the user's behalf, no setting
      void requestPersistOnce();
    }
    const entryCount = await dataHistoryDb.getEntryCount();
    if (entryCount > 0) {
      void runDataHistoryRetentionSweep();
    }
    return { captureEnabled, limits: getTierLimits() };
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error initializing data history', ex);
    return { captureEnabled: false, limits: getTierLimits() };
  }
}

/**
 * End the session's data history storage: unbind the user scope and drop every cached file store.
 *
 * Without this, the module-level store cache outlives a logout — the next account on the same page
 * would inherit the previous one's resolved store, including a `DirectoryHandleFileStore` holding
 * an ALREADY-GRANTED handle to the folder the departing user chose. Pairs with
 * `clearLocalStorageScope()`; both run wherever a session ends.
 */
export function clearDataHistoryStorageScope(): void {
  resetHistoryFileStores();
  clearDataHistoryUserScope();
}

let storageScopeTeardownRegistered = false;

/**
 * Subscribe teardown to the local-storage scope lifecycle, so a logout or account switch unbinds
 * history storage through the SAME signal that unbinds the database — rather than relying on every
 * logout site to remember a second call. Registered from init (not at module load) so merely
 * importing this library never installs a listener.
 */
function registerStorageScopeTeardownOnce(): void {
  if (storageScopeTeardownRegistered) {
    return;
  }
  storageScopeTeardownRegistered = true;
  onLocalStorageScopeCleared(clearDataHistoryStorageScope);
}

/**
 * Free-tier limits are enforced DESTRUCTIVELY (the sweep deletes all but the newest entries and
 * clamps retention), so a paid signal that disappears — PAST_DUE from an expired card, a lapsed
 * renewal — keeps paid limits for a grace window instead of deleting up to a year of history over
 * a billing hiccup. Users who were never paid are unaffected (no marker exists).
 */
async function resolvePaidPlanWithGrace(hasPaidPlan: boolean): Promise<boolean> {
  try {
    if (hasPaidPlan) {
      await dataHistoryDb.savePaidPlanLastSeenAt(new Date());
      return true;
    }
    const lastSeenAt = await dataHistoryDb.getPaidPlanLastSeenAt();
    return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < DATA_HISTORY_PAID_TIER_GRACE_MS;
  } catch {
    return hasPaidPlan;
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
 * Begin a history entry for a long-running flow (data load, mass update). Always returns a usable
 * handle — when history is disabled, opted out for this run, not initialized, or the entry cannot be
 * created, the handle simply captures nothing. Callers never null-check and never await this.
 */
export function startDataHistoryEntry(options: StartDataHistoryEntryOptions): DataHistoryEntryHandle {
  return new DataHistoryEntryHandle(options);
}

/**
 * Freshly-started entry row with the in-progress defaults, shared by the entry-handle constructor
 * and the inline one-shot path (which spreads its final-state overrides on top) so the two can
 * never drift field-by-field.
 */
function buildNewHistoryItem(options: StartDataHistoryEntryOptions, now: Date): DataHistoryItem {
  return {
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
    // Placeholder until the creation task resolves the active store — the row is never saved
    // before that happens, so no row can be persisted with the wrong stamp.
    storageBackend: 'opfs',
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
}

/**
 * Handle for an in-flight history entry. All methods are queued and fire-and-forget safe: any
 * internal error marks the entry `failed` and subsequent calls become no-ops — nothing ever
 * rejects into the calling flow. Await individual calls (or `flush()`) only when sequencing
 * matters, e.g. in tests.
 *
 * The entry row is created by the first queued task rather than by the constructor, so the handle is
 * available synchronously; `key` is valid immediately (a retry can reference it as its `parentKey`
 * without awaiting anything).
 */
export class DataHistoryEntryHandle {
  readonly key: string;

  /** True once any capture step failed — `recordDataHistoryAction` uses this for all-or-nothing cleanup */
  get didFail(): boolean {
    return this.failed;
  }

  private item: DataHistoryItem;
  private orgFolder = '';
  /** Resolved by the creation task — null means nothing is being captured for this entry */
  private store: HistoryFileStore | null = null;
  private queue: Promise<void>;
  private capturing = true;
  private failed = false;
  private finished = false;
  private resultsStream: HistoryWriteStream | null = null;
  private resultsHeaderWritten = false;
  private resultsRowCount = 0;

  constructor(options: StartDataHistoryEntryOptions) {
    const now = new Date();
    this.item = buildNewHistoryItem(options, now);
    this.key = this.item.key;
    // Guard the entry against a concurrent backend migration until the handle finishes/fails
    markEntryActive(this.key);
    this.queue = this.createEntry(options);
  }

  /** Persist the parsed input rows as `input.csv.gz` */
  writeInputRows(rows: Record<string, unknown>[], header: string[]): Promise<void> {
    return this.run(async (store) => {
      if (rows.length === 0 || header.length === 0) {
        return;
      }
      const compressed = store.capabilities.compressFiles;
      const fileName = getDataHistoryFileName('input.csv', compressed);
      const stream = await store.createWriteStream(this.filePath(fileName), { gzip: compressed });
      try {
        for (const chunk of serializeRowsToCsvChunks(rows, header, { includeHeader: true })) {
          await stream.write(chunk);
        }
        const { bytes } = await stream.close();
        await this.addFileRef(store, {
          kind: 'input',
          path: this.filePath(fileName),
          fileName,
          contentType: 'text/csv',
          compressed,
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
    return this.writeJsonPayload('request', payload);
  }

  /** Persist the results payload (JSON) as `results.json.gz` — the one-shot counterpart to `appendResultsRows` */
  writeResultsJson(payload: unknown): Promise<void> {
    return this.writeJsonPayload('results', payload);
  }

  /** Shared body of `writeRequestJson`/`writeResultsJson` — identical writes to `<kind>.json.gz` */
  private writeJsonPayload(kind: 'request' | 'results', payload: unknown): Promise<void> {
    return this.run(async (store) => {
      const compressed = store.capabilities.compressFiles;
      const fileName = getDataHistoryFileName(`${kind}.json`, compressed);
      const path = this.filePath(fileName);
      const { bytes } = await store.writeFile(path, TEXT_ENCODER.encode(JSON.stringify(payload)), { gzip: compressed });
      await this.addFileRef(store, {
        kind,
        path,
        fileName,
        contentType: 'application/json',
        compressed,
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
    return this.run(async (store) => {
      if (rows.length === 0 || header.length === 0) {
        return;
      }
      const compressed = store.capabilities.compressFiles;
      if (!this.resultsStream) {
        this.resultsStream = await store.createWriteStream(this.filePath(getDataHistoryFileName('results.csv', compressed)), {
          gzip: compressed,
        });
        this.resultsHeaderWritten = false;
      }
      for (const chunk of serializeRowsToCsvChunks(rows, header, { includeHeader: !this.resultsHeaderWritten })) {
        await this.resultsStream.write(chunk);
      }
      this.resultsHeaderWritten = true;
      this.resultsRowCount += rows.length;
    });
  }

  /**
   * Run capture-only work once the entry exists. The task is NOT invoked when nothing is being
   * captured (history disabled, per-run opt-out, entry already failed/finished), so expensive work —
   * re-fetching a bulk job's per-record results from Salesforce, flattening a large result set —
   * never runs for an entry nothing would be written to.
   *
   * The task runs OUTSIDE the write queue (it calls the queued methods above itself, so it must not
   * be queued or it would wait on itself). It never rejects; the returned promise resolves once the
   * task and the writes it enqueued have settled, which is what callers await in tests.
   */
  capture(task: () => Promise<void>): Promise<void> {
    return (async () => {
      await this.queue;
      if (!this.capturing || this.failed || this.finished) {
        return;
      }
      try {
        await task();
      } catch (ex) {
        // The task owns its own finish/fail decision — e.g. a failed results fetch still finishes
        // the entry with the counts the UI shows, because the user's load itself succeeded
        logger.warn('[DATA_HISTORY] Capture task failed for entry', this.key, ex);
      }
      await this.queue;
    })();
  }

  /** Finalize the entry: close streams, set status/counts, and write the manifest */
  finish(outcome: FinishDataHistoryEntryOptions): Promise<void> {
    return this.run(async (store) => {
      if (this.resultsStream) {
        const compressed = store.capabilities.compressFiles;
        const { bytes } = await this.resultsStream.close();
        this.resultsStream = null;
        const fileName = getDataHistoryFileName('results.csv', compressed);
        await this.addFileRef(store, {
          kind: 'results',
          path: this.filePath(fileName),
          fileName,
          contentType: 'text/csv',
          compressed,
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
      try {
        await this.writeManifest(store);
      } catch (ex) {
        // The manifest only exists for folder re-indexing — a failed write here must not flip an
        // already-recorded accurate final status to 'failed' (every payload file was written fine)
        logger.warn('[DATA_HISTORY] Unable to write manifest for entry', this.key, ex);
      }
      this.finished = true;
      markEntryInactive(this.key);
    });
  }

  /** Mark the entry failed (e.g. the load itself hit a fatal error) */
  fail(errorMessage: string): Promise<void> {
    return this.run(async () => {
      await this.markFailed(errorMessage);
    });
  }

  /**
   * Resolves when all queued work has settled — primarily for tests and results components. Work
   * started through `capture()` is awaited via the promise that method returns, not through this.
   */
  flush(): Promise<void> {
    return this.queue;
  }

  /**
   * Create the entry row. Runs as the handle's first queued task so construction stays synchronous,
   * and self-gates: when capture is off (or the row cannot be written) the handle goes quiet and
   * every subsequent method is a no-op. Nothing was recorded in that case, so there is no entry to
   * mark failed. Never rejects.
   */
  private async createEntry(options: StartDataHistoryEntryOptions): Promise<void> {
    try {
      if (options.skipHistory || !(await isDataHistoryCaptureEnabled())) {
        this.stopCapturing();
        return;
      }
      const store = await getHistoryFileStore();
      this.orgFolder = await getOrgFolderName(options.org.uniqueId);
      this.item = { ...this.item, storageBackend: store.type };
      await dataHistoryDb.saveEntry(this.item);
      this.store = store;
      void requestPersistOnce();
      void pruneEntryCountOverage();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to start history entry', ex);
      this.stopCapturing();
    }
  }

  private stopCapturing(): void {
    this.capturing = false;
    markEntryInactive(this.key);
  }

  private filePath(fileName: string): string {
    return getEntryFilePath(this.orgFolder, this.key, fileName);
  }

  /**
   * Serialize work per entry and convert any error into a failed entry instead of a rejection.
   * Tasks receive the resolved store; they are skipped entirely when nothing is being captured.
   * The returned promise NEVER rejects.
   */
  private run(task: (store: HistoryFileStore) => Promise<void>): Promise<void> {
    const next = this.queue.then(async () => {
      if (!this.capturing || this.failed || this.finished || !this.store) {
        return;
      }
      try {
        await task(this.store);
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
    markEntryInactive(this.key);
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

  private async addFileRef(store: HistoryFileStore, fileRef: DataHistoryFileRef): Promise<void> {
    this.item = {
      ...this.item,
      files: [...this.item.files.filter(({ kind }) => kind !== fileRef.kind), fileRef],
      // Keep the stamp aligned with where the handle actually writes, so a read always resolves to
      // the backend the bytes live in even if a migration re-stamped the row concurrently.
      storageBackend: store.type,
    };
    this.item.sizeBytes = this.item.files.reduce((total, file) => total + file.bytes, 0);
    await dataHistoryDb.updateEntry(this.key, {
      files: this.item.files,
      sizeBytes: this.item.sizeBytes,
      storageBackend: store.type,
    });
  }

  private async writeManifest(store: HistoryFileStore): Promise<void> {
    await store.writeFile(this.filePath(DATA_HISTORY_FILE_NAMES.manifest), TEXT_ENCODER.encode(buildManifestJson(this.item)), {
      gzip: false,
    });
  }
}

/**
 * One-shot capture for synchronous flows (record modal, create record, query table edits).
 * On browser-managed storage (OPFS), small payloads are stored inline in the Dexie row (gzip) to
 * avoid file-store churn for frequent single-record edits. On user-visible backends (user-chosen
 * folder, desktop native) EVERY action is written as real files — the promise of "my history lives
 * in my folder" breaks if query edits and record saves never appear there, and inline payloads
 * cannot be recovered by a folder re-index. Never throws.
 */
export async function recordDataHistoryAction(options: RecordDataHistoryActionOptions): Promise<void> {
  try {
    if (options.skipHistory || !(await isDataHistoryCaptureEnabled())) {
      return;
    }
    const { request, results, counts, status, errorMessage, ...entryOptions } = options;

    const payloadJson = JSON.stringify({ request, results });
    const fitsInline = TEXT_ENCODER.encode(payloadJson).byteLength <= DATA_HISTORY_INLINE_PAYLOAD_MAX_BYTES;
    if (fitsInline && !(await isActiveStoreUserVisible())) {
      const now = new Date();
      const item: DataHistoryItem = {
        ...buildNewHistoryItem(entryOptions, now),
        status: status ?? deriveStatusFromCounts(counts),
        counts,
        // Stamp with the ACTIVE backend even though the payload lives inline: a row claiming a
        // backend it does not live on makes the sweep's stranded-entry reconciliation re-visit it
        // forever. Best-effort — this path never touches the file store, so a broken store must
        // not stop it from capturing.
        storageBackend: await getActiveBackendType(),
        errorMessage: errorMessage ?? null,
        finishedAt: now,
      };
      item.inlinePayload = await gzipEncode({ request, results });
      item.sizeBytes = item.inlinePayload.byteLength;
      await dataHistoryDb.saveEntry(item);
    } else {
      // Over the inline threshold: a regular entry handle owns the whole file/manifest/row sequence
      // and its invariants (row before files for the orphan sweep, backend stamp aligned with where
      // the bytes land, active-entry guard against concurrent migration). One-shots stay
      // ALL-OR-NOTHING: the user's operation itself succeeded, so a failed capture removes the row
      // rather than leaving a 'failed' stub that would misreport the operation's outcome.
      const handle = startDataHistoryEntry(entryOptions);
      await handle.writeRequestJson(request);
      await handle.writeResultsJson(results);
      await handle.finish({ counts, status, errorMessage });
      if (handle.didFail) {
        await dataHistoryDb.deleteEntries([handle.key]).catch(() => undefined);
      }
    }

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

/**
 * Delete one entry (files first, then row). Refuses while the entry is still being written: file
 * stores recreate missing directories on write, so deleting under an active handle lets it silently
 * resurrect the files on disk — rowless data the user believes is gone. Returns whether it deleted
 * so the UI can tell the user to retry once the capture settles.
 */
export async function deleteDataHistoryEntry(key: string): Promise<{ deleted: boolean }> {
  const item = await dataHistoryDb.getEntry(key);
  if (!item) {
    return { deleted: true };
  }
  if (isEntryLikelyInFlight(item)) {
    return { deleted: false };
  }
  // Tombstone BEFORE deleting, and unconditionally: even when the file delete succeeds, leftover or
  // late-written files (a straggling writer just past the in-flight window, a folder whose delete
  // partially failed) must never let a folder re-index resurrect an entry the user deleted.
  await dataHistoryDb.addDeletedEntryTombstone(key).catch(() => undefined);
  try {
    await deleteEntryFilesAndRow(item);
  } catch (ex) {
    // Row removal wins over stranded files — the tombstone above keeps them from re-indexing
    logger.warn('[DATA_HISTORY] Error deleting entry files, removing row anyway', key, ex);
    await dataHistoryDb.deleteEntries([key]);
  }
  return { deleted: true };
}

/**
 * Delete all history. Entries still being written are kept (deleting mid-write would strand their
 * files) — `skipped` lets the UI say so.
 */
export async function deleteAllDataHistory(): Promise<{ deleted: number; skipped: number }> {
  const entries = await dataHistoryDb.getAllEntries();
  let deleted = 0;
  let skipped = 0;
  for (const entry of entries) {
    const result = await deleteDataHistoryEntry(entry.key);
    if (result.deleted) {
      deleted++;
    } else {
      skipped++;
    }
  }
  return { deleted, skipped };
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
    const [entryCount, usedBytes, persisted] = await Promise.all([
      dataHistoryDb.getEntryCount(),
      dataHistoryDb.getTotalSizeBytes(),
      getStoragePersisted(),
    ]);
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

/** Active backend for stamping a row, falling back to OPFS when the store cannot be resolved */
async function getActiveBackendType(): Promise<DataHistoryStorageBackend> {
  try {
    return (await getHistoryFileStore()).type;
  } catch {
    return 'opfs';
  }
}

/**
 * Whether the active store keeps files the user can see (folder/native). Best-effort: a store that
 * cannot resolve reports false so small captures fall back to the inline path rather than failing.
 */
async function isActiveStoreUserVisible(): Promise<boolean> {
  try {
    return (await getHistoryFileStore()).capabilities.userVisibleFiles;
  } catch {
    return false;
  }
}

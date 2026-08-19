import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  DataHistoryApi,
  DataHistoryCounts,
  DataHistoryFileKind,
  DataHistoryFileRef,
  DataHistoryInputSource,
  DataHistoryItem,
  DataHistoryOperation,
  DataHistorySettings,
  DataHistorySource,
  DataHistoryStatus,
  DataHistoryTierLimits,
  LocalOrGoogle,
  Maybe,
  SalesforceOrgUi,
} from '@jetstream/types';
import { dataHistoryDb, onLocalStorageScopeCleared } from '@jetstream/ui/db';
import { serializeRowsToCsvChunks } from './csv-utils';
import { DATA_HISTORY_PAID_TIER_GRACE_MS, getDataHistoryTierLimits } from './data-history-limits';
import { buildManifestJson } from './data-history-manifest';
import { pruneEntryCountOverage, runDataHistoryRetentionSweep } from './data-history-retention';
import {
  deleteEntryFilesAndRow,
  deriveStatusFromCounts,
  getEffectiveSettings,
  getStoragePersisted,
  getStoredSettings,
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
import { getOrgFolderName } from './file-store/hashed-dir-names';
import { DATA_HISTORY_FILE_NAMES, getDataHistoryFileName, getEntryFilePath, getParentDirPath } from './file-store/path-utils';
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

/** Freshly-started entry row with the in-progress defaults */
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
  /**
   * Resolved by the creation task, and the ONE signal that says whether anything is being captured:
   * null means nothing is (history disabled, per-run opt-out, or the row could not be written). Read
   * it through `activeStore()` rather than directly, so every method agrees on what a live entry is.
   */
  private store: HistoryFileStore | null = null;
  private queue: Promise<void>;
  private failed = false;
  private finished = false;
  /** Promise of the first `finalize()` call — see that method for why it is one-shot */
  private finalizePromise: Promise<void> | null = null;
  private resultsStream: HistoryWriteStream | null = null;
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
      // The header goes out with the first rows of a fresh stream — and only then
      const isFirstChunk = !this.resultsStream;
      if (!this.resultsStream) {
        this.resultsStream = await store.createWriteStream(this.filePath(getDataHistoryFileName('results.csv', compressed)), {
          gzip: compressed,
        });
      }
      for (const chunk of serializeRowsToCsvChunks(rows, header, { includeHeader: isFirstChunk })) {
        await this.resultsStream.write(chunk);
      }
      this.resultsRowCount += rows.length;
    });
  }

  /**
   * Run the entry's FINAL capture step once the entry exists, then finish the entry with `outcome`.
   *
   * The outcome is a parameter rather than something the task settles because every host knows the
   * result of the user's operation before this runs — the task only enriches the entry with
   * per-record results. The handle owning the `finish()` makes two things structural instead of
   * per-call-site conventions: a task failure (logged, never rethrown) still finishes the entry with
   * the counts the UI shows, because the user's load itself succeeded; and a throwing task can no
   * longer strand the entry `in-progress` with its key pinned in the active-entry set, which would
   * block delete and migration for the life of the page.
   *
   * ONE-SHOT: every caller re-fetches per-record results from Salesforce before writing them, so a
   * second call would re-run that whole fetch — expensive, and invisible from the call site (a
   * polling done-branch that re-enters, an effect that re-fires on a dependency change). Later
   * callers get the FIRST invocation's promise, so everyone awaits the same work rather than a
   * snapshot of the queue that may not include it. Assigned synchronously so even two calls in the
   * same tick cannot both get through.
   *
   * The task runs OUTSIDE the write queue (it calls the queued methods above itself, so it must not
   * be queued or it would wait on itself). It never rejects; the returned promise resolves once the
   * task, the writes it enqueued, and the trailing `finish()` have settled, which is what callers
   * await in tests. Nothing runs when nothing is being captured, so the expensive re-fetch never
   * happens for an entry nothing would be written to.
   */
  finalize(outcome: FinishDataHistoryEntryOptions, task: () => Promise<void>): Promise<void> {
    this.finalizePromise = this.finalizePromise ?? this.runFinalizeTask(outcome, task);
    return this.finalizePromise;
  }

  private async runFinalizeTask(outcome: FinishDataHistoryEntryOptions, task: () => Promise<void>): Promise<void> {
    await this.queue;
    if (!this.activeStore()) {
      return;
    }
    try {
      await task();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Finalize task failed for entry', this.key, ex);
    }
    // `finish()` is queued, so awaiting it also waits out every write the task enqueued
    await this.finish(outcome);
  }

  /** Finalize the entry: close streams, set status/counts, and write the manifest */
  finish(outcome: FinishDataHistoryEntryOptions): Promise<void> {
    return this.run((store) => this.finishEntry(store, outcome));
  }

  /**
   * Body of `finish()`, split out so the settle-with-current-counts callers (`fail`,
   * `abandonIfUnsettled`) can read `this.item.counts` INSIDE the queued task — after a
   * `setSubmittedCount` queued just before them has run — rather than at call time.
   */
  private async finishEntry(store: HistoryFileStore, outcome: FinishDataHistoryEntryOptions): Promise<void> {
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
  }

  /**
   * The user's operation itself failed (a thrown load, a job that could not be created). This is an
   * OUTCOME, not a capture malfunction, so the entry is finished like any other — result rows already
   * streamed are kept, the manifest is written, and the submitted count (if recorded) survives — just
   * with `failed` status and the error. Hosts that know how many records the failure covers should
   * call `finish({ counts, status: 'failed', errorMessage })` directly; this is for the ones that
   * only know it blew up. The capture-malfunction teardown (`markFailed`) stays internal to `run()`.
   */
  fail(errorMessage: string): Promise<void> {
    return this.run((store) => this.finishEntry(store, { counts: this.item.counts, status: 'failed', errorMessage }));
  }

  /**
   * Record how many records the run submits, as soon as the host knows it (alongside the input rows).
   * `finish()` sets the final counts, but some entries render BEFORE or WITHOUT it — the live
   * `in-progress` row, an entry abandoned by its host mid-run (`abandonIfUnsettled`), one the retention
   * sweep reclassifies as `incomplete`, and one that `fail()`ed before any result came back — and all
   * of them can only show "N submitted" if the total was persisted up front. Without this they show "—".
   */
  setSubmittedCount(total: number): Promise<void> {
    return this.run(async () => {
      this.item = { ...this.item, counts: { ...this.item.counts, total } };
      await dataHistoryDb.updateEntry(this.key, { counts: this.item.counts });
    });
  }

  /**
   * Settle an entry whose host went away mid-run — the host component unmounting (SPA navigation,
   * modal close) is the caller. Without this, an abandoned entry stays `in-progress` forever and its
   * key stays in the active-entry set, blocking delete and migration for the life of the page.
   *
   * Settles as `incomplete`, NOT `failed`: by the time a host unmounts, the Bulk job or mass update
   * has usually been submitted and finishes on Salesforce regardless — the OUTCOME is unknown, not
   * bad. `incomplete` is exactly the status the retention sweep assigns to a capture a crashed tab
   * left behind, and it renders as "N submitted" (the total recorded by `setSubmittedCount`) rather
   * than a red Failed badge for a load that most likely succeeded. Results streamed so far are kept
   * (`finish` closes the stream).
   *
   * No-op once `finalize()` has started: a capture already running in the background finishes the
   * entry itself. A `finish()` or `fail()` already in flight also wins — the `finish()` below is
   * queued behind it and then no-ops against the settled entry.
   */
  abandonIfUnsettled(errorMessage: string): void {
    if (this.finalizePromise) {
      return;
    }
    void this.run((store) => this.finishEntry(store, { counts: this.item.counts, status: 'incomplete', errorMessage }));
  }

  /**
   * Resolves when all queued work has settled — primarily for tests and results components. Work
   * started through `finalize()` is awaited via the promise that method returns, not through this.
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
        // `store` is left null, which is what makes every other method a no-op — no second flag
        markEntryInactive(this.key);
        return;
      }
      const store = await getHistoryFileStore();
      this.orgFolder = await getOrgFolderName(options.org.uniqueId);
      this.item = { ...this.item, storageBackend: store.type };
      await dataHistoryDb.saveEntry(this.item);
      // Assigned LAST, and only here: a throw anywhere above must leave the handle quiet, and this
      // field is the only thing that says so
      this.store = store;
      void requestPersistOnce();
      void pruneEntryCountOverage();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to start history entry', ex);
      markEntryInactive(this.key);
    }
  }

  /**
   * The active store while this handle can still do work, otherwise null. The SINGLE "is this entry
   * live" predicate, shared by `run()` and `finalize()` so the two can never disagree about it —
   * they previously checked overlapping-but-different subsets of the lifecycle fields and only
   * agreed by accident. Returns the store rather than a boolean so callers get it already narrowed.
   */
  private activeStore(): HistoryFileStore | null {
    return this.failed || this.finished ? null : this.store;
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
      const store = this.activeStore();
      if (!store) {
        return;
      }
      try {
        await task(store);
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
 *
 * A regular entry handle owns the whole file/manifest/row sequence and its invariants (row before
 * files for the orphan sweep, backend stamp aligned with where the bytes land, active-entry guard
 * against concurrent migration), so this is just "start, write both payloads, finish". One-shots
 * stay ALL-OR-NOTHING: the user's operation itself succeeded, so a failed capture removes the entry
 * rather than leaving a 'failed' stub that would misreport the operation's outcome. Never throws.
 */
export async function recordDataHistoryAction(options: RecordDataHistoryActionOptions): Promise<void> {
  try {
    // Fast path, not a second gate — `createEntry` re-checks this and is the owner. Bailing here just
    // avoids allocating a handle and churning markEntryActive/markEntryInactive for a no-op capture.
    if (options.skipHistory || !(await isDataHistoryCaptureEnabled())) {
      return;
    }
    const { request, results, counts, status, errorMessage, ...entryOptions } = options;
    const handle = startDataHistoryEntry(entryOptions);
    await handle.writeRequestJson(request);
    await handle.writeResultsJson(results);
    await handle.finish({ counts, status, errorMessage });
    if (handle.didFail) {
      await rollbackFailedOneShot(handle.key);
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to record history action', ex);
  }
}

/**
 * How a single-record save turned out. `succeeded: false` covers BOTH a graceful per-record error
 * result and a thrown request — `results` carries whichever the call site has.
 */
export type SingleRecordOutcome = { succeeded: true; results: unknown } | { succeeded: false; results: unknown; errorMessage?: string };

/**
 * What a single-record capture needs BEFORE the save has happened — the entry's identity plus the
 * request. Call sites build this once and spread it into both the success and thrown-error captures,
 * so the two can never describe the same save differently.
 */
export type SingleRecordActionContext = Omit<RecordDataHistoryActionOptions, 'counts' | 'status' | 'results' | 'errorMessage'>;

/**
 * Capture a save that affects exactly ONE record — the record modal (create/edit/clone) and Create
 * Records. Those surfaces share a policy that is entirely mechanical: one record, it either landed
 * or it did not, and a thrown request is still a failed attempt worth recording (a timed-out save
 * may even have applied server-side, so having no record of the attempt is the worst outcome).
 *
 * Exists so that policy is stated once instead of at each call site: spelling out `counts` per call
 * invites a `{ total: 1, success: 1, failure: 1 }` typo, and the `status` those call sites used to
 * pass was in every case exactly what `deriveStatusFromCounts` already produces, so it is left off
 * and derived. Never throws.
 */
export async function recordSingleRecordAction(options: SingleRecordActionContext & { outcome: SingleRecordOutcome }): Promise<void> {
  const { outcome, ...entryOptions } = options;
  await recordDataHistoryAction({
    ...entryOptions,
    results: outcome.results,
    counts: { total: 1, success: outcome.succeeded ? 1 : 0, failure: outcome.succeeded ? 0 : 1 },
    errorMessage: outcome.succeeded ? undefined : outcome.errorMessage,
  });
}

/**
 * Discard a one-shot entry whose capture failed part-way. Deletes the files it did manage to write,
 * not just the row: on user-visible backends the orphan sweep deliberately leaves rowless
 * directories alone (they are recoverable history there), so a row-only delete would strand a
 * partial directory in the user's folder permanently. Best-effort — the user's operation already
 * succeeded and nothing here may surface to them.
 */
async function rollbackFailedOneShot(key: string): Promise<void> {
  try {
    const item = await dataHistoryDb.getEntry(key);
    if (item) {
      await deleteEntryFilesThenRow(item);
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to roll back failed one-shot capture', key, ex);
  }
}

/**
 * Read a payload back for viewing/downloading. Returns null when the entry has no data of the
 * requested kind. The returned fileName has the `.gz` suffix stripped (content is decompressed).
 *
 * `maxBytes` reads only the HEAD of the payload — for previews, which show a couple of MB of what
 * can be a hundreds-of-MB results file. It is honored by the backend itself (see
 * `HistoryFileStore.readFile`), so the rest of the file is never inflated or copied. Downloads and
 * migration omit it.
 */
export async function readDataHistoryFile(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
  options?: { maxBytes?: number },
): Promise<{ blob: Blob; fileName: string; contentType: 'text/csv' | 'application/json' } | null> {
  const fileRef = item.files.find((file) => file.kind === kind);
  if (!fileRef) {
    return null;
  }
  const store = await getFileStoreForBackend(item.storageBackend);
  const blob = await store.readFile(fileRef.path, { gunzip: fileRef.compressed, maxBytes: options?.maxBytes });
  return { blob, fileName: fileRef.fileName.replace(/\.gz$/, ''), contentType: fileRef.contentType };
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
  await deleteEntryFilesThenRow(item);
  return { deleted: true };
}

/**
 * Delete all history. Entries still being written are kept (deleting mid-write would strand their
 * files) — `skipped` lets the UI say so.
 *
 * Deliberately NOT a loop over `deleteDataHistoryEntry`: that would re-read every row it was just
 * handed and rewrite the whole tombstone list once per entry, which on a paid-tier history of
 * thousands of entries is minutes of serial IndexedDB work behind a spinner. Rows are removed in one
 * `bulkDelete`, and only entries whose FILES could not be removed are tombstoned — those are the
 * only ones a folder re-index could resurrect.
 */
export async function deleteAllDataHistory(): Promise<{ deleted: number; skipped: number }> {
  const entries = await dataHistoryDb.getAllEntries();
  const deletableEntries = entries.filter((entry) => !isEntryLikelyInFlight(entry));
  const deletedKeys: string[] = [];
  const tombstoneKeys: string[] = [];
  for (const entry of deletableEntries) {
    if (!(await deleteEntryFilesQuietly(entry))) {
      tombstoneKeys.push(entry.key);
    }
    deletedKeys.push(entry.key);
  }
  // One write for every entry whose files stayed behind — a folder whose handle has lapsed fails
  // for EVERY entry, so this is the common case there, not the exception
  await dataHistoryDb.addDeletedEntryTombstones(tombstoneKeys).catch(() => undefined);
  await dataHistoryDb.deleteEntries(deletedKeys);
  return { deleted: deletedKeys.length, skipped: entries.length - deletedKeys.length };
}

/**
 * Erase every payload file in the user's OPFS scope, INDEPENDENT of the Dexie rows — for account
 * deletion, where the rows are wiped with the database and nothing could ever reach these files
 * again (a later sign-in is a different user id, so a different scope directory; the init sweep
 * only looks for orphans when rows exist). Without this, up to the tier's full quota of the user's
 * Salesforce record payloads would stay in the browser's origin storage indefinitely.
 *
 * OPFS only: a user-chosen folder or the desktop history folder holds the user's own visible files,
 * which every other flow (disconnect, disable, migrate) deliberately leaves in place. Best-effort
 * and never throws — a local cleanup failure must not block deleting the account. Must run BEFORE
 * the local-storage scope is cleared, which unbinds the user scope every store is rooted under.
 */
export async function deleteAllDataHistoryFiles(): Promise<void> {
  try {
    const store = await getFileStoreForBackend('opfs');
    for (const { orgFolder, entryKey } of await store.listEntryDirs()) {
      await store.deleteEntryDir(`${orgFolder}/${entryKey}`).catch((ex) => {
        logger.warn('[DATA_HISTORY] Unable to delete entry files', `${orgFolder}/${entryKey}`, ex);
      });
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Unable to delete data history files', ex);
  }
}

/**
 * Remove an entry's files and then its row, keeping the row removal even when the files could not be
 * deleted — the caller has already tombstoned the key, which is what stops a folder re-index from
 * resurrecting the stranded files.
 */
async function deleteEntryFilesThenRow(item: DataHistoryItem): Promise<void> {
  try {
    await deleteEntryFilesAndRow(item);
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error deleting entry files, removing row anyway', item.key, ex);
    await dataHistoryDb.deleteEntries([item.key]);
  }
}

/** Remove just an entry's files, reporting whether they went away. Never throws. */
async function deleteEntryFilesQuietly(item: DataHistoryItem): Promise<boolean> {
  if (item.files.length === 0) {
    return true;
  }
  try {
    const store = await getFileStoreForBackend(item.storageBackend);
    await store.deleteEntryDir(getParentDirPath(item.files[0].path));
    return true;
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error deleting entry files', item.key, ex);
    return false;
  }
}

export async function getDataHistorySettings(): Promise<DataHistorySettings | null> {
  return await getEffectiveSettings();
}

// Both writers spread from the STORED settings, never the effective (tier-clamped) ones — see
// `getStoredSettings` for the retention loss that spreading the clamped copy back would cause.
export async function setDataHistoryEnabled(enabled: boolean): Promise<void> {
  const settings = await getStoredSettings();
  if (!settings) {
    return;
  }
  await dataHistoryDb.saveSettings({ ...settings, enabled });
}

export async function updateDataHistoryRetentionSettings(changes: { retentionDays?: number }): Promise<void> {
  const settings = await getStoredSettings();
  if (!settings) {
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
    return { entryCount, usedBytes, maxTotalBytes: tier.maxTotalBytes, maxEntries: tier.maxEntries };
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

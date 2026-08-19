import { buildBulkResultRow } from '@jetstream/shared/utils';
import {
  ApiMode,
  BulkJobWithBatches,
  DataHistoryApi,
  DataHistoryCounts,
  DataHistoryOperation,
  FieldMapping,
  InsertUpdateUpsertDelete,
  LoadDataBulkApiStatusPayload,
  LocalOrGoogle,
  Maybe,
  PrepareDataResponse,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  appendBulkJobBatchResults,
  buildDataHistoryInputSource,
  DataHistoryEntryHandle,
  startDataHistoryEntry,
} from '@jetstream/ui/data-history';
import {
  alignBatchSourceRecordsToResults,
  getBulkJobCompletedBatches,
  getLoadResultsHeader,
  isDeleteLoadType,
} from '../components/load-results/load-results-utils';

/**
 * Helpers that adapt the Load Records feature to the `@jetstream/ui/data-history` capture API.
 *
 * The handle itself is fire-and-forget: its methods are internally queued, never reject, and no-op
 * when capture is disabled or opted out — so callers hand rows straight to it with no null checks
 * and no `.catch()` plumbing of their own.
 */

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
    default: {
      const unhandledLoadType: never = loadType;
      throw new Error(`Unhandled load type: ${unhandledLoadType}`);
    }
  }
}

export function apiModeToDataHistoryApi(apiMode: ApiMode): DataHistoryApi {
  return apiMode === 'BATCH' ? 'batch-composite' : 'bulk-v1';
}

/**
 * A run that failed before any record reached Salesforce (pre-processing/query errors, or a thrown
 * prepare step). FINISH the entry — not fail — so the attempted count is recorded: every input
 * record counts as a failure rather than the entry looking like a capture malfunction.
 */
export function finishHistoryAsPrepareFailure(historyHandle: DataHistoryEntryHandle, attemptedCount: number, errorMessage: string): void {
  historyHandle.finish({
    counts: { total: attemptedCount, success: 0, failure: attemptedCount },
    status: 'failed',
    errorMessage,
  });
}

/**
 * Everything a Load Records run records about HOW it was configured. Named (rather than left as an
 * inline parameter type) because the entry-start and per-run option types below are both derived
 * from it — three layers of `Parameters<typeof …>[0]['config']` compiled the same but sent every
 * reader on a hunt through unnamed function parameters to learn what five fields a call site passes.
 */
export interface LoadRecordsHistoryConfig {
  loadType: InsertUpdateUpsertDelete;
  apiMode: ApiMode;
  numRecords: number;
  batchSize: Maybe<number>;
  insertNulls: boolean;
  serialMode: boolean;
  hasDateFieldMapped: boolean;
  dateFormat: string;
  fieldMapping: FieldMapping;
  hasZipAttachment: boolean;
  timesSameDataSubmitted: number;
  trialRun?: boolean;
  trialRunSize?: Maybe<number>;
  retry?: { retryCount: number; retrySource: 'all' | 'selected'; totalFailedCount: number };
}

/** The config values a single run supplies — the rest come from the load wizard via `startLoadRecordsHistory` */
export type LoadRecordsHistoryRunConfig = Omit<LoadRecordsHistoryConfig, 'loadType' | 'apiMode'>;

/**
 * Metadata snapshot stored on the entry's `config`, mirroring the `load_Submitted` analytics payload
 * (the loaded rows themselves are captured as files). Shared by the initial-load and retry paths so
 * the two records stay comparable — `retry` adds the retry-specific fields on top.
 */
export function buildLoadRecordsHistoryConfig({
  loadType,
  apiMode,
  numRecords,
  batchSize,
  insertNulls,
  serialMode,
  hasDateFieldMapped,
  dateFormat,
  fieldMapping,
  hasZipAttachment,
  timesSameDataSubmitted,
  trialRun = false,
  trialRunSize,
  retry,
}: LoadRecordsHistoryConfig): Record<string, unknown> {
  return {
    loadType,
    apiMode,
    numRecords,
    batchSize,
    insertNulls,
    serialMode,
    hasDateFieldMapped,
    dateFormat,
    trialRun,
    trialRunSize,
    hasZipAttachment,
    timesSameDataSubmitted,
    numStaticFields: Object.values(fieldMapping).filter(({ type }) => type === 'STATIC').length,
    ...(retry ? { isRetry: true, ...retry } : {}),
  };
}

/**
 * Begin a history entry for a Load Records run — initial load, trial run, or retry (a retry links to
 * the run it retried via `parentKey`). Owns the envelope shared by every load-records entry; callers
 * pass only the per-run values. The handle self-gates (captures nothing when disabled/opted out) and
 * is never awaited on the load's critical path.
 */
export function startLoadRecordsHistory({
  org,
  loadType,
  apiMode,
  sobject,
  inputFilename,
  inputFilenameType,
  inputGoogleFileId,
  skipHistory,
  config,
  parentKey,
}: {
  org: SalesforceOrgUi;
  loadType: InsertUpdateUpsertDelete;
  apiMode: ApiMode;
  sobject: string;
  inputFilename: Maybe<string>;
  inputFilenameType: Maybe<LocalOrGoogle>;
  inputGoogleFileId: Maybe<string>;
  skipHistory?: boolean;
  /** Config snapshot values — `loadType`/`apiMode` are added automatically */
  config: LoadRecordsHistoryRunConfig;
  parentKey?: string;
}): DataHistoryEntryHandle {
  return startDataHistoryEntry({
    org,
    source: 'load-records',
    operation: loadTypeToDataHistoryOperation(loadType),
    api: apiModeToDataHistoryApi(apiMode),
    sobjects: [sobject],
    config: buildLoadRecordsHistoryConfig({ loadType, apiMode, ...config }),
    inputSource: buildDataHistoryInputSource({
      filename: inputFilename,
      filenameType: inputFilenameType,
      googleFileId: inputGoogleFileId,
    }),
    parentKey,
    skipHistory,
  });
}

/**
 * Proactively capture a finished bulk job's per-record results, then finish the entry. Bulk results
 * expire server-side (~7 days), so they are fetched even when the user never clicks download.
 * The fetch loop and its bounded-memory/skip-a-failed-batch policies live in
 * `appendBulkJobBatchResults`; this supplies the load's batch resolution and row building.
 *
 * Skipped entirely — with no network calls — when capture is off, and a results-fetch failure still
 * finishes the entry with the counts the UI shows, because the load itself succeeded and must never
 * be recorded as failed. Fire-and-forget — the returned promise is only for sequencing in tests.
 *
 * Runs through `handle.finalize`, which finishes the entry with these counts and is one-shot.
 */
export function captureBulkApiLoadResults({
  handle,
  selectedOrg,
  jobInfo,
  batchSummary,
  preparedData,
  loadType,
  fields,
  counts,
  errorMessage,
}: {
  handle: DataHistoryEntryHandle;
  selectedOrg: SalesforceOrgUi;
  jobInfo: BulkJobWithBatches;
  batchSummary: LoadDataBulkApiStatusPayload;
  preparedData: PrepareDataResponse;
  loadType: InsertUpdateUpsertDelete;
  /** Mapped target field headers (`getFieldHeaderFromMapping`) */
  fields: string[];
  counts: DataHistoryCounts;
  /** Why the load stopped early, when it did (records never submitted are in `counts.failure`) */
  errorMessage?: string;
}): Promise<void> {
  return handle.finalize({ counts, jobId: jobInfo.id ?? undefined, errorMessage }, async () => {
    if (!jobInfo.id) {
      return;
    }
    const isDelete = isDeleteLoadType(loadType);
    const { batchIds, recordsByBatch } = getBulkJobCompletedBatches({ jobInfo, batchSummary, preparedData });
    await appendBulkJobBatchResults({
      handle,
      org: selectedOrg,
      jobId: jobInfo.id,
      batchIds,
      header: getLoadResultsHeader(fields),
      buildBatchRows: (results, _batchId, batchIndex) => {
        // Per-batch alignment, matching the single-batch download scope: for deletes Salesforce
        // omits records with no mapped Id, and it applies that uniformly per batch
        const records = alignBatchSourceRecordsToResults([recordsByBatch[batchIndex]], results.length, isDelete);
        return results.map((resultRecord, recordIndex) => buildBulkResultRow(resultRecord, records[recordIndex]));
      },
    });
  });
}

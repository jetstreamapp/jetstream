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
  BatchResultsFetcher,
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
 * Whether any record may have reached Salesforce when a load failed. 'none' — a pre-processing/query
 * error, a thrown prepare step, a Bulk job that accepted no batch. 'unknown' — a throw after records
 * were sent (a Batch request mid-load, the Bulk job-status read after every batch was submitted).
 */
export type LoadFailureReach = 'none' | 'unknown';

/**
 * The ONE rule for settling a failed run's history entry — both results components delegate here
 * rather than each picking a settle call, so the rule cannot drift between them.
 *
 * 'none': every attempted record is recorded as failed — the results component reports the same
 * `failure: attemptedCount` to its parent, so the entry and the UI agree. 'unknown': `handle.fail()`,
 * which keeps the results streamed so far and only the submitted count — recording "every record
 * failed" for a job Salesforce may well be processing would be a wrong permanent record.
 */
export function settleHistoryForFailedLoad(
  historyHandle: DataHistoryEntryHandle,
  { reached, attemptedCount, errorMessage }: { reached: LoadFailureReach; attemptedCount: number; errorMessage: string },
): void {
  if (reached === 'unknown') {
    historyHandle.fail(errorMessage);
    return;
  }
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
  isTrialRun?: boolean;
  trialRunSize?: Maybe<number>;
  retry?: { retryCount: number; retrySource: 'all' | 'selected'; totalFailedCount: number };
}

/**
 * The built run snapshot: what is stored on the entry's `config` AND sent as the `load_Submitted`
 * analytics payload — one object serves both so the two can never drift. A type alias (not an
 * interface) so it stays assignable to the `Record<string, unknown>` both consumers take.
 */
export type LoadRecordsHistorySnapshot = Omit<LoadRecordsHistoryConfig, 'fieldMapping' | 'retry' | 'isTrialRun'> & {
  isTrialRun: boolean;
  numStaticFields: number;
  isRetry?: true;
  retryCount?: number;
  retrySource?: 'all' | 'selected';
  totalFailedCount?: number;
};

/**
 * Metadata snapshot of HOW a Load Records run was configured (the loaded rows themselves are
 * captured as files). Shared by the initial-load and retry paths so the two records stay comparable
 * — `retry` adds the retry-specific fields on top.
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
  isTrialRun = false,
  trialRunSize,
  retry,
}: LoadRecordsHistoryConfig): LoadRecordsHistorySnapshot {
  return {
    loadType,
    apiMode,
    numRecords,
    batchSize,
    insertNulls,
    serialMode,
    hasDateFieldMapped,
    dateFormat,
    isTrialRun,
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
 * pass the run snapshot they already built (see `buildLoadRecordsHistoryConfig`), so the same object
 * goes to analytics. The handle self-gates (captures nothing when disabled/opted out) and is never
 * awaited on the load's critical path.
 */
export function startLoadRecordsHistory({
  org,
  sobject,
  inputFilename,
  inputFilenameType,
  inputGoogleFileId,
  skipHistory,
  config,
  parentKey,
}: {
  org: SalesforceOrgUi;
  sobject: string;
  inputFilename: Maybe<string>;
  inputFilenameType: Maybe<LocalOrGoogle>;
  inputGoogleFileId: Maybe<string>;
  skipHistory?: boolean;
  config: LoadRecordsHistorySnapshot;
  parentKey?: string;
}): DataHistoryEntryHandle {
  return startDataHistoryEntry({
    org,
    source: 'load-records',
    operation: loadTypeToDataHistoryOperation(config.loadType),
    api: apiModeToDataHistoryApi(config.apiMode),
    sobjects: [sobject],
    config,
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
  fetchBatchResults,
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
  /** Shared with the retry-record collector so each batch is downloaded once — see `createBatchResultsFetcher` */
  fetchBatchResults?: BatchResultsFetcher;
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
      fetchBatchResults,
      buildBatchRows: (results, _batchId, batchIndex) => {
        // Per-batch alignment, matching the single-batch download scope: for deletes Salesforce
        // omits records with no mapped Id, and it applies that uniformly per batch
        const records = alignBatchSourceRecordsToResults([recordsByBatch[batchIndex]], results.length, isDelete);
        return results.map((resultRecord, recordIndex) => buildBulkResultRow(resultRecord, records[recordIndex]));
      },
    });
  });
}

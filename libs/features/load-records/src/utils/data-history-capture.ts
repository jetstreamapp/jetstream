import { logger } from '@jetstream/shared/client-logger';
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
import { buildDataHistoryInputSource, DataHistoryEntryHandle, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { fetchBulkApiAllBatchResults, getLoadResultsHeader } from '../components/load-results/load-results-utils';

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
export function finishHistoryAsPrepareFailure(
  historyHandle: Maybe<DataHistoryEntryHandle>,
  attemptedCount: number,
  errorMessage: string,
): void {
  historyHandle?.finish({
    counts: { total: attemptedCount, success: 0, failure: attemptedCount },
    status: 'failed',
    errorMessage,
  });
}

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
}: {
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
}): Record<string, unknown> {
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
  /** Config snapshot values for `buildLoadRecordsHistoryConfig` — `loadType`/`apiMode` are added automatically */
  config: Omit<Parameters<typeof buildLoadRecordsHistoryConfig>[0], 'loadType' | 'apiMode'>;
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
 *
 * Skipped entirely — with no network calls — when capture is off, and a results-fetch failure still
 * finishes the entry with the counts the UI shows, because the load itself succeeded and must never
 * be recorded as failed. Fire-and-forget — the returned promise is only for sequencing in tests.
 */
export function captureBulkApiLoadResults({
  handle,
  selectedOrg,
  jobInfo,
  batchSummary,
  preparedData,
  loadType,
  fields,
  batchSize,
  counts,
}: {
  handle: DataHistoryEntryHandle;
  selectedOrg: SalesforceOrgUi;
  jobInfo: BulkJobWithBatches;
  batchSummary: LoadDataBulkApiStatusPayload;
  preparedData: PrepareDataResponse;
  loadType: InsertUpdateUpsertDelete;
  /** Mapped target field headers (`getFieldHeaderFromMapping`) */
  fields: string[];
  batchSize: number;
  counts: DataHistoryCounts;
}): Promise<void> {
  return handle.capture(async () => {
    try {
      if (jobInfo.id) {
        const { results, records } = await fetchBulkApiAllBatchResults({ selectedOrg, jobInfo, batchSummary, preparedData, loadType });
        const header = getLoadResultsHeader(fields);
        // Stream in batch-size chunks, awaiting each one: the capture methods only ENQUEUE work, so
        // without the await the loop would build (and hold) every chunk's rows before any of them is
        // serialized — the exact peak-memory spike the chunking exists to avoid.
        for (let offset = 0; offset < results.length; offset += batchSize) {
          const rows = results
            .slice(offset, offset + batchSize)
            .map((resultRecord, index) => buildBulkResultRow(resultRecord, records[offset + index]));
          await handle.appendResultsRows(rows, header);
        }
      }
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Failed to capture bulk results', ex);
    }
    await handle.finish({ counts, jobId: jobInfo.id ?? undefined });
  });
}

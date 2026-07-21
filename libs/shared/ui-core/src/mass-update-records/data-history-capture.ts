import { bulkApiGetRecords } from '@jetstream/shared/data';
import { BulkJobResultRecord, BulkJobWithBatches, DataHistoryCounts, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { DataHistoryEntryHandle, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { MetadataRowConfiguration } from './mass-update-records.types';
import { buildMassUpdateCombinedResults, getMassUpdateBatchSourceRecords, getMassUpdateResultsHeader } from './mass-update-records.utils';

/**
 * Thin helpers that adapt the mass-update deploy flow to the `@jetstream/ui/data-history` capture
 * API. The handle is a promise that resolves to `null` when capture is disabled or opted out. Every
 * wrapper is fire-and-forget and swallows rejections so history capture can NEVER slow down or break
 * a deployment — the capture methods themselves are internally queued and never reject.
 */
export type DataHistoryHandlePromise = Promise<DataHistoryEntryHandle | null>;

export type MassUpdateSource = 'STAND-ALONE' | 'QUERY';

/** Per-sobject context stashed at submit time so the poll-done branch can finalize the right entry */
export interface MassUpdateHistoryContext {
  handle: DataHistoryHandlePromise;
  batchSize: number;
  configuration: MetadataRowConfiguration[];
}

/** Begin a history entry for one sobject deployment (self-gates; never awaited on the critical path) */
export function startMassUpdateHistory({
  org,
  source,
  sobject,
  jobId,
  records,
  batchSize,
  serialMode,
  configuration,
  skipHistory,
}: {
  org: SalesforceOrgUi;
  source: MassUpdateSource;
  sobject: string;
  jobId: string;
  records: Record<string, unknown>[];
  batchSize: number;
  serialMode: boolean;
  configuration: MetadataRowConfiguration[];
  skipHistory?: boolean;
}): DataHistoryHandlePromise {
  return startDataHistoryEntry({
    org,
    source: source === 'QUERY' ? 'mass-update-from-query' : 'mass-update',
    operation: 'update',
    api: 'bulk-v1',
    sobjects: [sobject],
    jobId: jobId || undefined,
    // Snapshot the transformation/criteria configuration (field metadata is intentionally omitted — too large)
    config: {
      serialMode,
      batchSize,
      numRecords: records.length,
      transformations: configuration.map(({ selectedField, transformationOptions }) => ({
        field: selectedField,
        option: transformationOptions.option,
        criteria: transformationOptions.criteria,
        alternateField: transformationOptions.alternateField,
        staticValue: transformationOptions.staticValue,
        whereClause: transformationOptions.whereClause,
      })),
    },
    skipHistory,
  });
}

/** Persist the prepared records actually submitted as `request.json.gz` (fire-and-forget) */
export function writeMassUpdateRequestJson(handle: Maybe<DataHistoryHandlePromise>, records: Record<string, unknown>[]): void {
  if (!handle) {
    return;
  }
  void handle.then((resolved) => resolved?.writeRequestJson(records)).catch(() => undefined);
}

/** Mark the entry failed after a fatal deployment/poll error (fire-and-forget) */
export function failMassUpdateHistory(handle: Maybe<DataHistoryHandlePromise>, errorMessage: string): void {
  if (!handle) {
    return;
  }
  void handle.then((resolved) => resolved?.fail(errorMessage)).catch(() => undefined);
}

function computeMassUpdateCounts(jobInfo: BulkJobWithBatches, processingErrorCount: number): DataHistoryCounts {
  const numFailed = jobInfo.numberRecordsFailed || 0;
  const numProcessed = jobInfo.numberRecordsProcessed || 0;
  const success = Math.max(0, numProcessed - numFailed);
  // Client-side processing errors never reached Salesforce but are still failures for the user
  const failure = numFailed + processingErrorCount;
  return { total: success + failure, success, failure, processingErrors: processingErrorCount };
}

/**
 * Proactively capture per-record results when a deployment finishes. Bulk results expire server-side
 * (~7 days), so we fetch each completed batch's results, zip them with the submitted records, stream
 * them to the history entry, and finish with counts. Fully fire-and-forget: it never blocks the poll
 * loop and a results-fetch failure still finishes the entry with the job's counts.
 */
export function captureMassUpdateResults({
  handle,
  org,
  jobInfo,
  records,
  batchIdToIndex,
  batchSize,
  configuration,
  processingErrorCount,
}: {
  handle: Maybe<DataHistoryHandlePromise>;
  org: SalesforceOrgUi;
  jobInfo: BulkJobWithBatches;
  records: Record<string, unknown>[];
  batchIdToIndex: Record<string, number>;
  batchSize: number;
  configuration: MetadataRowConfiguration[];
  processingErrorCount: number;
}): void {
  if (!handle) {
    return;
  }
  void (async () => {
    const resolved = await handle;
    if (!resolved) {
      return;
    }
    const header = getMassUpdateResultsHeader(configuration);
    try {
      const completedBatches = (jobInfo.batches || []).filter((batch) => batch && batch.id && batch.state === 'Completed');
      for (const batch of completedBatches) {
        try {
          const resultRecords = await bulkApiGetRecords<BulkJobResultRecord>(org, jobInfo.id as string, batch.id, 'result');
          const sourceRecords = getMassUpdateBatchSourceRecords(records, batchIdToIndex, batch.id, batchSize);
          const rows = buildMassUpdateCombinedResults(resultRecords, sourceRecords, { includeSuccesses: true });
          if (rows.length > 0) {
            resolved.appendResultsRows(rows, header);
          }
        } catch {
          // One batch's results couldn't be fetched — skip it and still finish with the job counts
        }
      }
    } catch {
      // Ignore — finish with counts regardless so a successful load is never marked failed
    }
    resolved.finish({ counts: computeMassUpdateCounts(jobInfo, processingErrorCount), jobId: jobInfo.id ?? undefined });
  })().catch(() => undefined);
}

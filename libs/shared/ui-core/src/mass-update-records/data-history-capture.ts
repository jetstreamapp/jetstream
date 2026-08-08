import { bulkApiGetRecords } from '@jetstream/shared/data';
import { BulkJobResultRecord, BulkJobWithBatches, DataHistoryCounts, SalesforceOrgUi } from '@jetstream/types';
import { DataHistoryEntryHandle, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { MetadataRowConfiguration } from './mass-update-records.types';
import { buildMassUpdateCombinedResults, getMassUpdateBatchSourceRecords, getMassUpdateResultsHeader } from './mass-update-records.utils';

/**
 * Helpers that adapt the mass-update deploy flow to the `@jetstream/ui/data-history` capture API.
 * The handle's methods are internally queued, never reject, and no-op when capture is disabled or
 * opted out, so nothing here needs null checks or its own error handling.
 */

export type MassUpdateSource = 'STAND-ALONE' | 'QUERY';

/** Per-sobject context stashed at submit time so the poll-done branch can finalize the right entry */
export interface MassUpdateHistoryContext {
  handle: DataHistoryEntryHandle;
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
}): DataHistoryEntryHandle {
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
 * them to the history entry, and finish with counts.
 *
 * Skipped entirely — with no network calls — when the entry is not being captured, and a
 * results-fetch failure still finishes the entry with the job's counts. Fire-and-forget; the returned
 * promise is only for sequencing in tests.
 */
export function captureMassUpdateResults({
  context,
  org,
  jobInfo,
  records,
  batchIdToIndex,
  processingErrorCount,
}: {
  context: MassUpdateHistoryContext;
  org: SalesforceOrgUi;
  jobInfo: BulkJobWithBatches;
  records: Record<string, unknown>[];
  batchIdToIndex: Record<string, number>;
  processingErrorCount: number;
}): Promise<void> {
  const { handle, batchSize, configuration } = context;
  return handle.capture(async () => {
    const header = getMassUpdateResultsHeader(configuration);
    const completedBatches = (jobInfo.batches || []).filter((batch) => batch && batch.id && batch.state === 'Completed');
    for (const batch of completedBatches) {
      try {
        const resultRecords = await bulkApiGetRecords<BulkJobResultRecord>(org, jobInfo.id as string, batch.id, 'result');
        const sourceRecords = getMassUpdateBatchSourceRecords(records, batchIdToIndex, batch.id, batchSize);
        await handle.appendResultsRows(buildMassUpdateCombinedResults(resultRecords, sourceRecords, { includeSuccesses: true }), header);
      } catch {
        // One batch's results couldn't be fetched — skip it and still finish with the job counts
      }
    }
    await handle.finish({ counts: computeMassUpdateCounts(jobInfo, processingErrorCount), jobId: jobInfo.id ?? undefined });
  });
}

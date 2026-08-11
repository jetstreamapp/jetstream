import { BulkJobWithBatches, DataHistoryCounts, SalesforceOrgUi } from '@jetstream/types';
import { appendBulkJobBatchResults, DataHistoryEntryHandle, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { MetadataRowConfiguration } from './mass-update-records.types';
import { buildMassUpdateCombinedResults, getMassUpdateBatchSourceRecords, getMassUpdateResultsHeader } from './mass-update-records.utils';

/**
 * Helpers that adapt the mass-update deploy flow to the `@jetstream/ui/data-history` capture API.
 * The handle's methods are internally queued, never reject, and no-op when capture is disabled or
 * opted out, so nothing here needs null checks or its own error handling.
 */

export type MassUpdateSource = 'STAND-ALONE' | 'QUERY';

/**
 * A deployment's live capture context. The poll loop only sees `{ sobject, deployResults }`, so the
 * batch size and configuration its finalize step needs have to be carried alongside the handle.
 * Held only while the deployment is in flight — see `takeHistoryCapture` in `useDeployRecords`.
 */
export interface MassUpdateHistoryContext {
  handle: DataHistoryEntryHandle;
  batchSize: number;
  configuration: MetadataRowConfiguration[];
}

/**
 * Begin a history entry for one sobject deployment, at the point the deployment STARTS — before the
 * records are queried and prepared, so a failure in that step is recorded against this attempt
 * rather than against whatever the previous deployment of the same sobject left behind. The record
 * count therefore isn't known yet; it lands on the entry's `counts` when it finishes, and the bulk
 * job id lands with it. Self-gates; never awaited on the critical path.
 */
export function startMassUpdateHistory({
  org,
  source,
  sobject,
  batchSize,
  serialMode,
  configuration,
  skipHistory,
}: {
  org: SalesforceOrgUi;
  source: MassUpdateSource;
  sobject: string;
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
    // Snapshot the transformation/criteria configuration (field metadata is intentionally omitted — too large)
    config: {
      serialMode,
      batchSize,
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
 * (~7 days), so each completed batch's results are fetched, zipped with the submitted records, and
 * streamed to the history entry. The fetch loop and its bounded-memory/skip-a-failed-batch policies
 * live in `appendBulkJobBatchResults`; this supplies the deployment's batch resolution and row building.
 *
 * Skipped entirely — with no network calls — when the entry is not being captured, and a
 * results-fetch failure still finishes the entry with the job's counts. Fire-and-forget; the returned
 * promise is only for sequencing in tests.
 *
 * Runs through `handle.finalize`, which finishes the entry with the job's counts and is one-shot.
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
  return handle.finalize({ counts: computeMassUpdateCounts(jobInfo, processingErrorCount), jobId: jobInfo.id ?? undefined }, async () => {
    const completedBatches = (jobInfo.batches || []).filter((batch) => batch && batch.id && batch.state === 'Completed');
    await appendBulkJobBatchResults({
      handle,
      org,
      jobId: jobInfo.id as string,
      batchIds: completedBatches.map(({ id }) => id),
      header: getMassUpdateResultsHeader(configuration),
      buildBatchRows: (resultRecords, batchId) => {
        const sourceRecords = getMassUpdateBatchSourceRecords(records, batchIdToIndex, batchId, batchSize);
        return buildMassUpdateCombinedResults(resultRecords, sourceRecords, { includeSuccesses: true });
      },
    });
  });
}

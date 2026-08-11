import { logger } from '@jetstream/shared/client-logger';
import { bulkApiGetRecords } from '@jetstream/shared/data';
import { BulkJobResultRecord, SalesforceOrgUi } from '@jetstream/types';
import { DataHistoryEntryHandle } from './data-history.service';

/**
 * Fetch a finished bulk job's per-record results and append them to a history entry, one batch at a
 * time. This is THE results-capture loop for bulk jobs (Load Records and Mass Update both run
 * through it) so its two policies are stated once:
 *
 * - ONE BATCH AT A TIME, never the combined all-batches endpoint the download buttons use. This
 *   runs proactively on every bulk load, so it has to stay bounded: peak memory is one batch's
 *   results, whatever the job size, and no URL ever carries more than one batch id.
 * - A batch whose results cannot be fetched is SKIPPED — logged, because the saved results file is
 *   then short by a batch with no other explanation — rather than abandoning the remaining batches.
 *   The caller still finishes the entry with the counts the UI shows, because the user's load
 *   itself succeeded.
 *
 * Row building is the caller's: each feature zips a batch's results with its own source records.
 */
export async function appendBulkJobBatchResults({
  handle,
  org,
  jobId,
  batchIds,
  header,
  buildBatchRows,
}: {
  handle: DataHistoryEntryHandle;
  org: SalesforceOrgUi;
  jobId: string;
  /** Ids of the job's COMPLETED batches — resolving which batches have results is the caller's */
  batchIds: string[];
  header: string[];
  /** Combine one fetched batch's results with the caller's source records; index is the batch's position in `batchIds` */
  buildBatchRows: (results: BulkJobResultRecord[], batchId: string, batchIndex: number) => Record<string, unknown>[];
}): Promise<void> {
  for (const [batchIndex, batchId] of batchIds.entries()) {
    try {
      const results = await bulkApiGetRecords<BulkJobResultRecord>(org, jobId, batchId, 'result');
      await handle.appendResultsRows(buildBatchRows(results, batchId, batchIndex), header);
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Failed to capture bulk results for batch', batchId, ex);
    }
  }
}

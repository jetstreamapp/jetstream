import { logger } from '@jetstream/shared/client-logger';
import { bulkApiGetRecords } from '@jetstream/shared/data';
import { BulkJobResultRecord, BulkJobWithBatches, DataHistoryCounts, SalesforceOrgUi } from '@jetstream/types';
import { DataHistoryEntryHandle } from './data-history.service';

/**
 * Counts for a bulk job's permanent record, anchored on how many records were SUBMITTED rather than
 * on what Salesforce reports back — THE one formula, shared by Load Records and Mass Update.
 * `numberRecordsProcessed`/`numberRecordsFailed` only cover batches Salesforce actually ran: a batch
 * that never uploaded (a client-side processing error, a consecutive-failure bail-out) or ended
 * `Failed`/`NotProcessed` contributes to neither, so an entry derived from those two numbers alone
 * would read as a clean success for a load that never touched most of its rows — a 1,000-row load
 * with 600 rows never sent would show 400/400 succeeded. Success is clamped to what was submitted
 * (and to zero) so an over-reporting job can never push the failure count negative.
 *
 * `submitted` — every record the run attempted, including those that failed client-side
 * pre-processing; `processingErrors` — how many of those never reached a batch.
 */
export function buildBulkJobHistoryCounts(
  jobInfo: Pick<BulkJobWithBatches, 'numberRecordsProcessed' | 'numberRecordsFailed'>,
  { submitted, processingErrors }: { submitted: number; processingErrors: number },
): DataHistoryCounts {
  const numFailed = jobInfo.numberRecordsFailed || 0;
  const numProcessed = jobInfo.numberRecordsProcessed || 0;
  const success = Math.min(submitted, Math.max(0, numProcessed - numFailed));
  return { total: submitted, success, failure: submitted - success, processingErrors };
}

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
  fetchBatchResults = (batchId) => bulkApiGetRecords<BulkJobResultRecord>(org, jobId, batchId, 'result'),
}: {
  handle: DataHistoryEntryHandle;
  org: SalesforceOrgUi;
  jobId: string;
  /** Ids of the job's COMPLETED batches — resolving which batches have results is the caller's */
  batchIds: string[];
  header: string[];
  /** Combine one fetched batch's results with the caller's source records; index is the batch's position in `batchIds` */
  buildBatchRows: (results: BulkJobResultRecord[], batchId: string, batchIndex: number) => Record<string, unknown>[];
  /**
   * Override the per-batch fetch — for a caller that downloads the same batches for another purpose
   * at the same time (Load Records' retry collector) and shares one memoized fetcher so each batch
   * is requested once. The one-batch-at-a-time bound above then holds only as far as that fetcher
   * retains results. Defaults to a plain `bulkApiGetRecords`.
   */
  fetchBatchResults?: (batchId: string) => Promise<BulkJobResultRecord[]>;
}): Promise<void> {
  for (const [batchIndex, batchId] of batchIds.entries()) {
    // Once the entry has failed (a write error marks it so), every further append is a no-op — the
    // remaining fetches would be network calls whose results go nowhere
    if (handle.didFail) {
      return;
    }
    try {
      const results = await fetchBatchResults(batchId);
      await handle.appendResultsRows(buildBatchRows(results, batchId, batchIndex), header);
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Failed to capture bulk results for batch', batchId, ex);
    }
  }
}

import { logger } from '@jetstream/shared/client-logger';
import { bulkApiGetRecords, bulkApiGetRecordsFromAllBatches } from '@jetstream/shared/data';
import { BULK_RESULTS_BASE_HEADER, decodeHtmlEntity, flattenRecord, pushAll, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  BulkJobBatchInfo,
  BulkJobResultRecord,
  BulkJobWithBatches,
  InsertUpdateUpsertDelete,
  LoadDataBulkApiStatusPayload,
  PrepareDataResponse,
  RecordResultWithRecord,
  SalesforceOrgUi,
} from '@jetstream/types';

/**
 * Shared assembly of the combined per-record result rows used by both the interactive download/view
 * flows and the Data History capture. The Bulk API row shape lives in `@jetstream/shared/utils`
 * (`buildBulkResultRow` / `BULK_RESULTS_BASE_HEADER`) because Mass Update produces the same files —
 * do not re-inline the shape here or there.
 */

/** Header for a results/failures export given the mapped target field headers */
export function getLoadResultsHeader(fields: string[]): string[] {
  return BULK_RESULTS_BASE_HEADER.concat(fields);
}

/**
 * Build a single result row for the Batch API from a processed record. `fields` are the mapped
 * target field headers (from `getFieldHeaderFromMapping`) used to flatten the record consistently.
 */
export function buildBatchApiResultRow(record: RecordResultWithRecord, fields: string[]): Record<string, unknown> {
  return {
    _id: record.success ? record.id : (record as { Id?: string }).Id || '',
    _success: record.success,
    _errors:
      record.success === false ? record.errors.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n') : '',
    ...flattenRecord(record.record, fields),
  };
}

export interface CompletedBatchSourceRecords {
  /** Ids of the batches whose results can be downloaded, in the order the combined download returns them */
  batchIds: string[];
  /** The source-record slice submitted in each of those batches, index-aligned with `batchIds` */
  recordsByBatch: any[][];
}

/**
 * Resolve which batches of a bulk job have downloadable results, paired with the source records
 * submitted in each. Batches that are not `Completed` — or that can't be mapped back to their
 * original submission position — contribute nothing, so their records never shift the pairing of a
 * later batch's results (Salesforce returns no result rows for them).
 *
 * `batchNumberById` maps batch id -> original submission index (from the upload's batch summary) and
 * `recordsByBatchNumber` holds the prepared records submitted in each batch, indexed by that same
 * submission index. Batches are capped by CSV size as well as by record count, so an oversized batch
 * gets split — the slices must come from the ranges the loader recorded, not from the batch size.
 */
export function getCompletedBatchSourceRecords(
  batches: Pick<BulkJobBatchInfo, 'id' | 'state'>[],
  batchNumberById: Map<string, number>,
  recordsByBatchNumber: any[][],
): CompletedBatchSourceRecords {
  const batchIds: string[] = [];
  const recordsByBatch: any[][] = [];
  batches.forEach((batch) => {
    if (batch.state !== 'Completed' || !batch.id) {
      return;
    }
    const originalBatchIndex = batchNumberById.get(batch.id);
    if (typeof originalBatchIndex !== 'number' || !recordsByBatchNumber[originalBatchIndex]) {
      return;
    }
    batchIds.push(batch.id);
    recordsByBatch.push(recordsByBatchNumber[originalBatchIndex]);
  });
  return { batchIds, recordsByBatch };
}

/**
 * Flatten the per-batch source slices into one array index-aligned with the combined batch results.
 * For delete loads Salesforce omits records without a mapped Id from the results — when the combined
 * result count matches the Id-only record count (and differs from the full count) the Id-only
 * records are used. Filtering is applied PER BATCH before flattening, so each batch's results stay
 * aligned with the records submitted in it.
 *
 * The combined download passes ALL batches at once, so the count comparison spans the whole job;
 * `collectFailedRecordsForRetry` and the history capture pass one batch at a time — the two agree
 * because Salesforce applies the omission uniformly, but do not assume per-batch semantics when
 * changing this.
 */
export function alignBatchSourceRecordsToResults(recordsByBatch: any[][], resultCount: number, isDelete: boolean): any[] {
  if (isDelete) {
    const recordsWithIdsByBatch = recordsByBatch.map((batchRecords) => batchRecords.filter((record) => !!record?.Id));
    const totalWithIds = recordsWithIdsByBatch.reduce((total, batchRecords) => total + batchRecords.length, 0);
    const totalRecords = recordsByBatch.reduce((total, batchRecords) => total + batchRecords.length, 0);
    if (resultCount === totalWithIds && totalWithIds !== totalRecords) {
      return recordsWithIdsByBatch.flat();
    }
  }
  return recordsByBatch.flat();
}

export function isDeleteLoadType(loadType: InsertUpdateUpsertDelete): boolean {
  return loadType === 'DELETE' || loadType === 'HARD_DELETE';
}

/**
 * Resolve a bulk job's downloadable batches paired with the source records submitted in each, from
 * the batch summary the loader recorded. Batches are capped by record count AND by CSV size, so an
 * oversized batch gets split and the records in a batch cannot be derived from `batchSize` — the
 * per-batch ranges must come from the summary.
 *
 * Shared by the combined "Download All"/"View All" fetch and the per-batch Data History capture, so
 * both pair results with the same records.
 */
export function getBulkJobCompletedBatches({
  jobInfo,
  batchSummary,
  preparedData,
}: {
  jobInfo: BulkJobWithBatches;
  batchSummary: LoadDataBulkApiStatusPayload;
  preparedData: PrepareDataResponse;
}): CompletedBatchSourceRecords {
  // Indexed by original batch number so it lines up with the batch number `batchNumberById` resolves
  const recordsByBatchNumber: any[][] = [];
  batchSummary.batchSummary.forEach(({ batchNumber, startIndex, recordCount }) => {
    recordsByBatchNumber[batchNumber] = preparedData.data.slice(startIndex, startIndex + recordCount);
  });
  const batchNumberById = new Map(
    batchSummary.batchSummary.filter((batch) => batch.id).map((batch) => [batch.id as string, batch.batchNumber]),
  );
  return getCompletedBatchSourceRecords(jobInfo.batches, batchNumberById, recordsByBatchNumber);
}

/**
 * Fetch the combined per-record results across all completed batches of a bulk job and pair each
 * batch's results with the source records submitted in THAT batch, so the returned
 * `results`/`records` arrays are index-aligned even when some batches are `Failed`/`NotProcessed`.
 *
 * This materializes EVERY result record in one array, which is why it backs only the user-initiated
 * "Download All"/"View All" actions. Background capture streams batch-by-batch instead — see
 * `captureBulkApiLoadResults`.
 *
 * `removedBatches` is true when any batch was excluded (drives the partial-results toast) — those
 * batches have no result rows and contribute no records. For delete operations only records with a
 * mapped Id are returned by Salesforce, so the source records are filtered to match.
 */
export async function fetchBulkApiAllBatchResults({
  selectedOrg,
  jobInfo,
  batchSummary,
  preparedData,
  loadType,
}: {
  selectedOrg: SalesforceOrgUi;
  jobInfo: BulkJobWithBatches;
  batchSummary: LoadDataBulkApiStatusPayload;
  preparedData: PrepareDataResponse;
  loadType: InsertUpdateUpsertDelete;
}): Promise<{ results: BulkJobResultRecord[]; records: any[]; removedBatches: boolean }> {
  const { batchIds, recordsByBatch } = getBulkJobCompletedBatches({ jobInfo, batchSummary, preparedData });
  const removedBatches = batchIds.length !== jobInfo.batches.length;
  const results =
    batchIds.length > 0 ? await bulkApiGetRecordsFromAllBatches<BulkJobResultRecord>(selectedOrg, jobInfo.id as string, batchIds) : [];
  const records = alignBatchSourceRecordsToResults(recordsByBatch, results.length, isDeleteLoadType(loadType));
  return { results, records, removedBatches };
}

/** Resolves one batch's per-record results — see `createBatchResultsFetcher` */
export type BatchResultsFetcher = (batchId: string) => Promise<BulkJobResultRecord[]>;

/**
 * Per-job memoized `bulkApiGetRecords(…, 'result')`. When a bulk job finishes, the retry-record
 * collector and the Data History capture BOTH need every completed batch's results, and they run
 * concurrently — without sharing, a 100-batch job with failures costs 100 extra Salesforce requests
 * and downloads every result twice. A rejected fetch is evicted so the other consumer's attempt is a
 * real retry rather than a cached rejection.
 *
 * Holds every fetched batch's results for as long as the fetcher itself is referenced, so create it
 * per job-completion and let it go out of scope with the consumers — do not park it in a ref.
 */
export function createBatchResultsFetcher(org: SalesforceOrgUi, jobId: string): BatchResultsFetcher {
  const resultsByBatchId = new Map<string, Promise<BulkJobResultRecord[]>>();
  return (batchId) => {
    let pending = resultsByBatchId.get(batchId);
    if (!pending) {
      pending = bulkApiGetRecords<BulkJobResultRecord>(org, jobId, batchId, 'result');
      resultsByBatchId.set(batchId, pending);
      pending.catch(() => resultsByBatchId.delete(batchId));
    }
    return pending;
  };
}

const FETCH_FAILED_RECORDS_CONCURRENCY = 5;

/**
 * Recover the original prepared records that failed during a Bulk API load so the user can retry
 * them. Resilient to per-batch fetch failures: any batch whose results can't be fetched is treated
 * as fully failed (all records included as "failed"), rather than losing the entire retry set due
 * to one transient error.
 *
 * Pairs results with source records through the same `getBulkJobCompletedBatches` /
 * `alignBatchSourceRecordsToResults` the download and Data History paths use, so all three agree on
 * which record a result row belongs to.
 */
export async function collectFailedRecordsForRetry({
  numFailure,
  jobInfo,
  batchSummary,
  preparedData,
  loadType,
  fetchBatchResults,
}: {
  numFailure: number;
  jobInfo: BulkJobWithBatches;
  batchSummary: LoadDataBulkApiStatusPayload;
  preparedData: PrepareDataResponse;
  loadType: InsertUpdateUpsertDelete;
  fetchBatchResults: BatchResultsFetcher;
}): Promise<any[]> {
  if (numFailure <= 0 || !jobInfo.id) {
    return [];
  }
  const isDelete = isDeleteLoadType(loadType);
  const { batchIds, recordsByBatch } = getBulkJobCompletedBatches({ jobInfo, batchSummary, preparedData });

  // No completed batches means either everything failed up-front or was unsubmitted/aborted.
  // Fall back to treating every record as failed.
  if (batchIds.length === 0) {
    return preparedData.data.slice();
  }

  // Fetch per-batch results, chunking concurrency to avoid overwhelming the SFDC API. Each batch
  // is wrapped in its own try/catch so a single transient failure doesn't discard already-fetched
  // results — the failed batch simply falls through to the "treat all records as failed" path.
  const resultsByBatchIndex = new Map<number, BulkJobResultRecord[]>();
  for (const batchIndexChunk of splitArrayToMaxSize(Array.from(batchIds.keys()), FETCH_FAILED_RECORDS_CONCURRENCY)) {
    await Promise.all(
      batchIndexChunk.map(async (batchIndex) => {
        try {
          resultsByBatchIndex.set(batchIndex, await fetchBatchResults(batchIds[batchIndex]));
        } catch (ex) {
          logger.warn('Failed to fetch results for batch; treating its records as failed', { batchId: batchIds[batchIndex], error: ex });
        }
      }),
    );
  }

  const failedRecords: any[] = [];
  // Records whose batch was resolved (fetched and paired) — every other record is conservatively retryable
  const resolvedRecords = new Set<unknown>();
  batchIds.forEach((_, batchIndex) => {
    const results = resultsByBatchIndex.get(batchIndex);
    if (!results) {
      return;
    }
    const recordsForBatch = recordsByBatch[batchIndex];
    const recordsForResults = alignBatchSourceRecordsToResults([recordsForBatch], results.length, isDelete);
    results.forEach((resultRecord, i) => {
      if (!resultRecord.Success && recordsForResults[i]) {
        failedRecords.push(recordsForResults[i]);
      }
    });
    // For delete batches where SFDC omitted records missing an Id, include them as failures here
    // since they'll never have a result row.
    if (recordsForResults.length !== recordsForBatch.length) {
      pushAll(
        failedRecords,
        recordsForBatch.filter((record) => !record?.Id),
      );
    }
    recordsForBatch.forEach((record) => resolvedRecords.add(record));
  });

  // Include all records from any batch we couldn't resolve (fetch failed, unmapped batch id,
  // state !== Completed, etc.). These are conservatively considered failed and retryable. Batches
  // are contiguous slices of the prepared data, so this walks the unresolved batches in order.
  // pushAll rather than `push(...spread)` - hundreds of thousands of records can be unresolved.
  pushAll(
    failedRecords,
    preparedData.data.filter((record) => !resolvedRecords.has(record)),
  );
  return failedRecords;
}

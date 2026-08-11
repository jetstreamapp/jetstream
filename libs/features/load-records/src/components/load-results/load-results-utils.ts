import { bulkApiGetRecordsFromAllBatches } from '@jetstream/shared/data';
import { BULK_RESULTS_BASE_HEADER, decodeHtmlEntity, flattenRecord } from '@jetstream/shared/utils';
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
 * Unlike `collectFailedRecordsForRetry`, which evaluates the same condition per batch, the count
 * comparison here is made across ALL batches at once — the two agree because Salesforce applies the
 * omission uniformly, but do not assume per-batch semantics when changing this.
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

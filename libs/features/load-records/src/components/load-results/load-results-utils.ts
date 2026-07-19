import { decodeHtmlEntity, flattenRecord } from '@jetstream/shared/utils';
import { BulkJobResultRecord, RecordResultWithRecord } from '@jetstream/types';

/**
 * Shared builders for the combined per-record result rows used by both the interactive
 * download/view flows and the Data History capture. The row shape (`{_id, _success, _errors,
 * ...record}`) and header (`['_id', '_success', '_errors', ...mappedFields]`) must stay identical
 * across those consumers, so this is the single source of truth — do not re-inline the shape.
 */

export const LOAD_RESULTS_BASE_HEADER = ['_id', '_success', '_errors'];

/** Header for a results/failures export given the mapped target field headers */
export function getLoadResultsHeader(fields: string[]): string[] {
  return LOAD_RESULTS_BASE_HEADER.concat(fields);
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

/**
 * Build a single result row for the Bulk API by combining the Salesforce result record with the
 * source record that was submitted for that position.
 */
export function buildBulkApiResultRow(resultRecord: BulkJobResultRecord, sourceRecord: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: resultRecord.Id || sourceRecord.Id || null,
    _success: resultRecord.Success,
    _errors: decodeHtmlEntity(resultRecord.Error),
    ...sourceRecord,
  };
}

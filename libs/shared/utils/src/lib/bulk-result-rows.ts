import { BulkJobResultRecord } from '@jetstream/types';
import { decodeHtmlEntity } from './utils';

/**
 * Canonical shape of a combined per-record Bulk API result row (`{_id, _success, _errors, ...record}`)
 * shared by Load Records and Mass Update (update-without-a-file / bulk-update-from-query). These rows
 * are what users download AND what Data History stores, and users re-load the files into Salesforce —
 * so the two features must build their result rows and headers from here and never re-inline the shape.
 */
export const BULK_RESULTS_BASE_HEADER = ['_id', '_success', '_errors'];

/** Combine one Salesforce bulk result record with the source record submitted for that position */
export function buildBulkResultRow(resultRecord: BulkJobResultRecord, sourceRecord: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: resultRecord.Id || (sourceRecord?.Id as string) || null,
    _success: resultRecord.Success,
    _errors: decodeHtmlEntity(resultRecord.Error),
    ...sourceRecord,
  };
}

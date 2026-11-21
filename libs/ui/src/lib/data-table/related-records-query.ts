import { ContextMenuItem, Field } from '@jetstream/types';
import { ColumnWithFilter, ContextAction } from './data-table-types';

/**
 * The related-records query puts every Id in the SOQL, and Salesforce caps how long a query sent to it
 * can be. This keeps the query comfortably inside that cap.
 */
export const MAX_RELATED_RECORD_IDS = 500;

const SALESFORCE_ID_LENGTHS = new Set([15, 18]);

export interface RelatedRecordsQueryTarget {
  /** The object the lookup column points at */
  sobject: string;
  /** Distinct Ids from the column, capped at {@link MAX_RELATED_RECORD_IDS} */
  recordIds: string[];
  /** Distinct Ids in the column before the cap was applied */
  totalIdCount: number;
}

/**
 * Works out what a "query the records this column points at" action would query.
 *
 * Returns null when the column is not a lookup to exactly one object - without the field describe there
 * is no way to know the target object, and a polymorphic lookup (e.g. OwnerId) has more than one.
 */
export function getRelatedRecordsQueryTarget<TRow extends object>(
  column: ColumnWithFilter<TRow, unknown>,
  rows: TRow[],
): RelatedRecordsQueryTarget | null {
  const field = column.meta?.field as Field | undefined;
  if (!field || field.type !== 'reference' || field.referenceTo?.length !== 1) {
    return null;
  }
  const distinctIds = new Set<string>();
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[column.key];
    if (typeof value === 'string' && SALESFORCE_ID_LENGTHS.has(value.length)) {
      distinctIds.add(value);
    }
  }
  return {
    sobject: field.referenceTo[0],
    recordIds: Array.from(distinctIds).slice(0, MAX_RELATED_RECORD_IDS),
    totalIdCount: distinctIds.size,
  };
}

export function getRelatedRecordsMenuItem({ sobject, recordIds, totalIdCount }: RelatedRecordsQueryTarget): ContextMenuItem<ContextAction> {
  const formatCount = (count: number) => count.toLocaleString();
  const isTruncated = totalIdCount > recordIds.length;
  const recordLabel = recordIds.length === 1 ? 'record' : 'records';
  return {
    label: isTruncated
      ? `Query first ${formatCount(recordIds.length)} of ${formatCount(totalIdCount)} related ${sobject} records`
      : `Query ${formatCount(recordIds.length)} related ${sobject} ${recordLabel}`,
    value: 'QUERY_RELATED_RECORDS',
    leadingDivider: true,
    disabled: recordIds.length === 0,
    title: isTruncated
      ? `Opens a new query for the first ${formatCount(recordIds.length)} records in this column. Filter the table to query a different set.`
      : 'Opens a new query in a new tab for the records in this column',
  };
}

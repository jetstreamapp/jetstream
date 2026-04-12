/**
 * WeakMap that associates a display row (rendered in the results modal or download) with the
 * original prepared record it was derived from. This lets the "Retry Selected" flow recover the
 * unmodified prepared record from a selected row without stashing it on the row object itself,
 * avoiding any risk of property-name collision with user data columns.
 *
 * The map is module-level so both the Batch API and Bulk API result components share a single
 * contract. Entries are automatically cleared when the row object is garbage collected.
 */
const retryRecordMap = new WeakMap<object, unknown>();

export function registerRetryRecord<TRow extends object, TRecord>(row: TRow, originalRecord: TRecord): TRow {
  retryRecordMap.set(row, originalRecord);
  return row;
}

export function getRetryRecord<TRecord = unknown>(row: object): TRecord | undefined {
  return retryRecordMap.get(row) as TRecord | undefined;
}

/**
 * Extract the original prepared records for a set of selected result rows. Rows without a
 * registered original record are skipped (and logged by the caller if needed).
 */
export function extractRetryRecords<TRecord = unknown>(rows: object[]): TRecord[] {
  const records: TRecord[] = [];
  for (const row of rows) {
    const original = retryRecordMap.get(row);
    if (original !== undefined) {
      records.push(original as TRecord);
    }
  }
  return records;
}

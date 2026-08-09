import { SELECT_COLUMN_KEY } from './grid/grid-constants';
import { ColumnWithFilter, RowWithKey } from './grid/grid-types';

/**
 * Text value for a cell in an exported file. Prefers the column's `getValue` (the same accessor the grid
 * uses for search/sort, which resolves friendly labels — e.g. a permission-set name instead of its Id) and
 * falls back to the raw field. Objects/arrays are skipped rather than serialized to `[object Object]`.
 */
function cellText<T extends object>(column: ColumnWithFilter<T>, row: T): string {
  if (column.getValue) {
    const value = column.getValue({ row, column });
    return value == null ? '' : String(value);
  }
  const raw = (row as Record<string, unknown>)[column.key as string];
  if (raw == null || typeof raw === 'object') {
    return '';
  }
  return String(raw);
}

export interface GridExportData {
  header: string[];
  data: Record<string, string>[];
}

/**
 * Flattens a {@link ColumnWithFilter}-based grid to `{ header, data }` suitable for `FileDownloadModal` /
 * `prepareCsvFile` / `prepareExcelFile`. Uses the visible data columns' labels as headers (skipping the
 * select column and label-less columns), in column order; grouping is not represented (leaf rows only).
 * The caller controls row ordering and which columns to include by passing the same `columns`/`rows` it
 * hands the grid.
 */
export function buildGridExportData<T extends object = RowWithKey>(columns: ColumnWithFilter<T>[], rows: readonly T[]): GridExportData {
  const exportColumns = columns.filter(
    (column) => !!column.key && column.key !== SELECT_COLUMN_KEY && typeof column.name === 'string' && column.name.trim().length > 0,
  );
  const header = exportColumns.map((column) => column.name as string);
  const data = rows.map((row) => {
    const record: Record<string, string> = {};
    exportColumns.forEach((column) => {
      record[column.name as string] = cellText(column, row);
    });
    return record;
  });
  return { header, data };
}

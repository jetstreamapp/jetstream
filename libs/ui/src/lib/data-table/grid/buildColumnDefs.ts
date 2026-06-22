/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnDef } from '@tanstack/react-table';
import { jetstreamColumnFilterFn } from './filterFns';
import { ACTION_COLUMN_KEY, DEFAULT_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH, SELECT_COLUMN_KEY } from './grid-constants';
import { CellKind, ColumnWithFilter, DefaultColumnOptions, JetstreamColumnMeta } from './grid-types';

/**
 * Map our author-facing `ColumnWithFilter[]` to TanStack `ColumnDef[]`.
 *
 * The presentational layer (GridHeader / GridCell / GridGroupRow) renders directly from the original
 * `ColumnWithFilter` carried on `meta.jetstream.column` rather than via `flexRender`, so this mapping
 * only needs to get the data model right: stable id, accessor (drives sort/group), sizing, sortability,
 * filterability, and meta. `cellKind` replaces the legacy `dataTableRenderFnMap` renderer-identity trick.
 */
export function buildColumnDefs<TRow, TSummaryRow = unknown>(
  columns: ColumnWithFilter<TRow, TSummaryRow>[],
  defaultColumnOptions?: DefaultColumnOptions<TRow, TSummaryRow>,
): ColumnDef<TRow, unknown>[] {
  return columns.map((column, index) => toColumnDef(column, index, defaultColumnOptions));
}

function resolveCellKind(key: string): CellKind {
  if (key === SELECT_COLUMN_KEY) {
    return 'select';
  }
  if (key === ACTION_COLUMN_KEY) {
    return 'action';
  }
  return 'data';
}

function toColumnDef<TRow, TSummaryRow>(
  column: ColumnWithFilter<TRow, TSummaryRow>,
  index: number,
  defaultColumnOptions?: DefaultColumnOptions<TRow, TSummaryRow>,
): ColumnDef<TRow, unknown> {
  const cellKind = resolveCellKind(column.key);
  const isDataColumn = cellKind === 'data';

  // TanStack throws a bare `Error` while building any column whose resolved id is falsy. `key` is typed
  // as a string but originates from `any` query-result data upstream, so fall back to a positional id
  // rather than crashing the whole grid when a malformed column slips through.
  const columnId = column.key != null && String(column.key).length > 0 ? String(column.key) : `__jgrid_col_${index}`;

  const resizable = column.resizable ?? defaultColumnOptions?.resizable ?? false;
  const sortable = isDataColumn && (column.sortable ?? defaultColumnOptions?.sortable ?? false);
  const hasFilters = isDataColumn && Array.isArray(column.filters) && column.filters.length > 0;

  const width = column.width ?? defaultColumnOptions?.width;
  const minWidth = column.minWidth ?? defaultColumnOptions?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const maxWidth = column.maxWidth ?? defaultColumnOptions?.maxWidth;

  const meta: JetstreamColumnMeta<TRow, TSummaryRow> = {
    column,
    cellKind,
    filters: column.filters,
    frozen: column.frozen,
    cellClass: column.cellClass,
    colSpan: column.colSpan,
    renderGroupCell: column.renderGroupCell,
    renderSummaryCell: column.renderSummaryCell,
    editor: column.renderEditCell,
    editable: column.editable,
    editorOptions: column.editorOptions,
  };

  const columnDef: ColumnDef<TRow, unknown> = {
    id: columnId,
    // Display (select/action) columns have no meaningful accessor. Data columns index by `columnId`
    // (not raw `column.key`) so a malformed/falsy key reads the unused fallback id — an empty column —
    // instead of the accidental `row['undefined']` lookup, keeping the accessor aligned with the id.
    ...(isDataColumn ? { accessorFn: (row: TRow) => (row as Record<string, unknown>)[columnId] } : {}),
    header: typeof column.name === 'string' ? column.name : columnId,
    enableSorting: sortable,
    enableResizing: resizable,
    enableColumnFilter: hasFilters,
    enableGlobalFilter: isDataColumn,
    enableGrouping: isDataColumn,
    size: typeof width === 'number' ? width : DEFAULT_COLUMN_WIDTH,
    minSize: minWidth,
    ...(typeof maxWidth === 'number' ? { maxSize: maxWidth } : {}),
    filterFn: jetstreamColumnFilterFn,
    meta: { jetstream: meta as JetstreamColumnMeta<TRow> },
  };

  return columnDef;
}

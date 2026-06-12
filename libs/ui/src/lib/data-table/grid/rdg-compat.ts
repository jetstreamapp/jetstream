/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Compatibility shims replacing the `react-data-grid` types/values that feature code imported directly.
 * At cutover, those imports are repointed from `'react-data-grid'` to `'@jetstream/ui'`, which re-exports
 * these. The runtime renderers receive the new grid's `DataTableCellProps` etc., so these are aliases.
 */
import {
  ColumnWithFilter,
  DataTableCellProps,
  DataTableEditorProps,
  DataTableGroupCellProps,
  DataTableHeaderProps,
  DataTableSummaryCellProps,
} from './grid-types';

export { SELECT_COLUMN_KEY } from './grid-constants';
export type { SortColumn } from './grid-types';
export { SelectColumn } from './renderers/CellRenderers';

export type Column<TRow, TSummaryRow = unknown> = ColumnWithFilter<TRow, TSummaryRow>;
export type CalculatedColumn<TRow, TSummaryRow = unknown> = ColumnWithFilter<TRow, TSummaryRow> & { readonly idx?: number };

export type RenderCellProps<TRow, TSummaryRow = unknown> = DataTableCellProps<TRow, TSummaryRow>;
export type RenderGroupCellProps<TRow, TSummaryRow = unknown> = DataTableGroupCellProps<TRow, TSummaryRow>;
export type RenderHeaderCellProps<TRow, TSummaryRow = unknown> = DataTableHeaderProps<TRow, TSummaryRow>;
export type RenderSummaryCellProps<TRow, TSummaryRow = unknown> = DataTableSummaryCellProps<TRow, TSummaryRow>;
export type RenderEditCellProps<TRow, TSummaryRow = unknown> = DataTableEditorProps<TRow, TSummaryRow>;

export interface RowsChangeData<TRow, TSummaryRow = unknown> {
  indexes: number[];
  column: ColumnWithFilter<TRow, TSummaryRow>;
}

export interface CellMouseArgs<TRow, TSummaryRow = unknown> {
  row: TRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  rowIdx?: number;
  selectCell?: () => void;
}

export interface CellKeyDownArgs<TRow, TSummaryRow = unknown> {
  row: TRow;
  column: ColumnWithFilter<TRow, TSummaryRow>;
  rowIdx: number;
  mode?: 'SELECT' | 'EDIT';
}

export type CellKeyboardEvent = React.KeyboardEvent<HTMLDivElement> & { preventGridDefault: () => void; isGridDefaultPrevented: () => boolean };
export type CellMouseEvent = React.MouseEvent<HTMLDivElement> & { preventGridDefault: () => void };

export interface RowHeightArgs<TRow> {
  type: 'ROW' | 'GROUP';
  row: TRow;
}

export interface RenderSortStatusProps {
  sortDirection: 'ASC' | 'DESC' | undefined;
  priority: number | undefined;
}

export interface Renderers<TRow, TSummaryRow = unknown> {
  renderSortStatus?: (props: RenderSortStatusProps) => React.ReactNode;
  renderCell?: (key: React.Key, props: DataTableCellProps<TRow, TSummaryRow>) => React.ReactNode;
}

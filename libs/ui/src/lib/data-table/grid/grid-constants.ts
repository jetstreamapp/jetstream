import { ContextMenuItem } from '@jetstream/types';
import { ContextAction } from './grid-types';

/** Placeholder used in SET filters to represent null/empty cell values. */
export const EMPTY_FIELD = '-BLANK-';

/**
 * Sentinel `rowId` for the column header row in the keyboard-navigation active-cell model. The header
 * isn't part of `table.getRowModel().rows`, so it's represented by this id — ArrowUp from the first body
 * row moves here (letting the keyboard reach select-all / header filters), ArrowDown returns to the body.
 */
export const HEADER_ROW_ID = '__jgrid_header__';

export const ACTION_COLUMN_KEY = '_actions';
export const RECORD_ERROR_COLUMN_KEY = '_saveError';

/**
 * Row-selection column key. Matches the value react-data-grid used (`'select-row'`) so any persisted
 * column orders / references created by the legacy grid remain valid after the migration.
 */
export const SELECT_COLUMN_KEY = 'select-row';

/** Columns that are not "data" columns (excluded from reorder persistence, copy, the ref column list). */
export const NON_DATA_COLUMN_KEYS = new Set<string>([SELECT_COLUMN_KEY, ACTION_COLUMN_KEY]);

export const TABLE_CONTEXT_MENU_ITEMS: ContextMenuItem<ContextAction>[] = [
  { label: 'Copy cell to clipboard', value: 'COPY_CELL', trailingDivider: true },
  { label: 'Copy row to clipboard (Excel)', value: 'COPY_ROW_EXCEL' },
  { label: 'Copy row to clipboard (JSON)', value: 'COPY_ROW_JSON', trailingDivider: true },
  { label: 'Copy column to values clipboard', value: 'COPY_COL_NO_HEADER' },
  { label: 'Copy column to clipboard (Excel)', value: 'COPY_COL' },
  { label: 'Copy column to clipboard (JSON)', value: 'COPY_COL_JSON', trailingDivider: true },
  { label: 'Copy table to clipboard (Excel)', value: 'COPY_TABLE' },
  { label: 'Copy table to clipboard (CSV)', value: 'COPY_TABLE_CSV' },
  { label: 'Copy table to clipboard (JSON)', value: 'COPY_TABLE_JSON' },
];

/** Default fixed row height (px) for non-wrapped rows; also the virtualizer seed estimate. */
export const DEFAULT_ROW_HEIGHT = 28.5;
export const DEFAULT_HEADER_ROW_HEIGHT = 35;
export const DEFAULT_SUMMARY_ROW_HEIGHT = 34;
export const DEFAULT_COLUMN_WIDTH = 200;
export const DEFAULT_MIN_COLUMN_WIDTH = 50;

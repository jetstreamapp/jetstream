import { ContextMenuItem } from '@jetstream/types';
import { describe, expect, test, vi } from 'vitest';
import { TABLE_CONTEXT_MENU_ITEMS } from '../grid-constants';
import { resolveHeaderContextMenuItems } from '../grid-context-menu';
import { ColumnWithFilter, ContextMenuActionData } from '../grid-types';

interface Row {
  _key: string;
  typeLabel: string;
  Name: string;
}

const column: ColumnWithFilter<Row> = { key: 'Name', name: 'Name' };

function actionData(rows: Row[]): ContextMenuActionData<Row> {
  return {
    row: rows[0],
    rows,
    rowIdx: rows.length ? 0 : -1,
    column,
    columns: [column],
  };
}

const rows: Row[] = [{ _key: '1', typeLabel: 'Apex Class', Name: 'One' }];

describe('resolveHeaderContextMenuItems', () => {
  test('keeps only the column/table-scoped actions from a static list', () => {
    const items = resolveHeaderContextMenuItems(TABLE_CONTEXT_MENU_ITEMS, actionData(rows));

    expect(items.map(({ value }) => value)).toEqual([
      'COPY_COL_NO_HEADER',
      'COPY_COL',
      'COPY_COL_JSON',
      'COPY_TABLE',
      'COPY_TABLE_CSV',
      'COPY_TABLE_JSON',
    ]);
  });

  test('evaluates a per-cell BUILDER against the header row and keeps its column-scoped items', () => {
    // Regression: builder-driven tables (Deploy, Manage Permissions fields) previously got no header
    // menu at all, because only a static array was considered.
    const builder = (data: ContextMenuActionData<Row>): ContextMenuItem[] => [
      { label: `Copy column (${data.row.typeLabel})`, value: 'COPY_COL_TYPE' },
      { label: 'Copy column (All Types)', value: 'COPY_COL' },
      { label: 'Copy row to clipboard (Excel)', value: 'COPY_ROW_EXCEL' },
      { label: 'Copy Table to clipboard (Excel)', value: 'COPY_TABLE' },
    ];

    const items = resolveHeaderContextMenuItems(builder, actionData(rows));

    // The row-scoped items ("this row's type", "this row") are dropped — a header has no single row.
    expect(items.map(({ value }) => value)).toEqual(['COPY_COL', 'COPY_TABLE']);
  });

  test('does not call a builder when the table has no rows to hand it', () => {
    // Builders dereference `data.row` (e.g. `data.row.typeLabel`), so calling one with no row would throw.
    const builder = vi.fn(() => []);

    expect(resolveHeaderContextMenuItems(builder, actionData([]))).toEqual([]);
    expect(resolveHeaderContextMenuItems(builder, null)).toEqual([]);
    expect(builder).not.toHaveBeenCalled();
  });

  test('a table that opts out with an empty list gets no header menu', () => {
    expect(resolveHeaderContextMenuItems([], actionData(rows))).toEqual([]);
  });
});

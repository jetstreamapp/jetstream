import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useJetstreamTable } from '../core/useJetstreamTable';
import { copyGenericTableDataToClipboard, copyGridDataToClipboard, copyGridGroupRowsToClipboard } from '../grid-clipboard';
import { ColumnWithFilter, TanstackTable } from '../grid-types';

const copyRecordsToClipboard = vi.hoisted(() => vi.fn());
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  copyRecordsToClipboard,
}));

interface Row {
  _key: string;
  Type: string;
  Name: string;
  'Account.Name': string;
  Detail: { count: number };
}

const columns: ColumnWithFilter<Row>[] = [
  { key: 'select-row', name: '' },
  { key: 'Type', name: 'Type' },
  { key: 'Name', name: 'Record Name' },
  { key: 'Account.Name', name: 'Account Name' },
  { key: 'Detail', name: 'Detail', getValue: ({ row }) => `${row.Detail.count} items` },
];

const data: Row[] = [
  { _key: '1', Type: 'Alpha', Name: 'One', 'Account.Name': 'Acme', Detail: { count: 1 } },
  { _key: '2', Type: 'Beta', Name: 'Two', 'Account.Name': 'Initech', Detail: { count: 2 } },
  { _key: '3', Type: 'Alpha', Name: 'Three', 'Account.Name': 'Hooli', Detail: { count: 3 } },
];

function setup(overrides: Partial<Parameters<typeof useJetstreamTable<Row>>[0]> = {}) {
  const { result } = renderHook(() => useJetstreamTable<Row>({ data, columns, getRowKey: (row) => row._key, ...overrides }));
  act(() => undefined);
  return result.current.table as TanstackTable<Row>;
}

/** The records handed to the clipboard, re-keyed by their header row so assertions stay readable. */
function copiedRecords() {
  const [records, , fields] = copyRecordsToClipboard.mock.calls[0];
  return { records, fields };
}

describe('copyGridDataToClipboard', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  test('COPY_CELL copies only the clicked cell, no header', () => {
    const table = setup();
    const result = copyGridDataToClipboard({
      table,
      action: 'COPY_CELL',
      row: table.getRowModel().rows[1],
      column: table.getColumn('Name'),
    });

    expect(result).toEqual({ rowCount: 1, columnCount: 1 });
    const { records, fields } = copiedRecords();
    expect(fields).toEqual(['c0']);
    expect(records).toEqual([{ c0: 'Two' }]);
  });

  test('COPY_ROW_EXCEL copies every data column with a display-name header, excluding the select column', () => {
    const table = setup();
    copyGridDataToClipboard({ table, action: 'COPY_ROW_EXCEL', row: table.getRowModel().rows[0] });

    const { records, fields } = copiedRecords();
    expect(fields).toEqual(['c0', 'c1', 'c2', 'c3']);
    expect(records).toEqual([
      { c0: 'Type', c1: 'Record Name', c2: 'Account Name', c3: 'Detail' },
      { c0: 'Alpha', c1: 'One', c2: 'Acme', c3: '1 items' },
    ]);
  });

  test('a column key containing a dot is copied as a literal key, not a nested lodash path', () => {
    const table = setup();
    copyGridDataToClipboard({ table, action: 'COPY_COL_NO_HEADER', column: table.getColumn('Account.Name') });

    const { records, fields } = copiedRecords();
    // Synthetic field names are the guard: passing 'Account.Name' downstream would resolve as a path.
    expect(fields).toEqual(['c0']);
    expect(records).toEqual([{ c0: 'Acme' }, { c0: 'Initech' }, { c0: 'Hooli' }]);
  });

  test('copies through the column getValue rather than the raw row property', () => {
    const table = setup();
    copyGridDataToClipboard({ table, action: 'COPY_COL_NO_HEADER', column: table.getColumn('Detail') });

    expect(copiedRecords().records).toEqual([{ c0: '1 items' }, { c0: '2 items' }, { c0: '3 items' }]);
  });

  test('COPY_TABLE follows the filtered + sorted row order the user is looking at', () => {
    const table = setup({
      initialSortColumns: [{ columnKey: 'Name', direction: 'ASC' }],
      includeQuickFilter: true,
      quickFilterText: 'Alpha',
    });
    const result = copyGridDataToClipboard({ table, action: 'COPY_TABLE' });

    expect(result).toEqual({ rowCount: 2, columnCount: 4 });
    expect(copiedRecords().records.slice(1)).toEqual([
      { c0: 'Alpha', c1: 'One', c2: 'Acme', c3: '1 items' },
      { c0: 'Alpha', c1: 'Three', c2: 'Hooli', c3: '3 items' },
    ]);
  });

  test('JSON keeps the real column ids and un-stringified values', () => {
    const table = setup();
    copyGridDataToClipboard({ table, action: 'COPY_ROW_JSON', row: table.getRowModel().rows[0] });

    const [records, format] = copyRecordsToClipboard.mock.calls[0];
    expect(format).toBe('json');
    expect(records).toEqual([{ Type: 'Alpha', Name: 'One', 'Account.Name': 'Acme', Detail: '1 items' }]);
  });

  test('an action with no row/column to act on copies nothing', () => {
    const table = setup();
    expect(copyGridDataToClipboard({ table, action: 'COPY_CELL' })).toBeNull();
    expect(copyRecordsToClipboard).not.toHaveBeenCalled();
  });
});

describe('copyGridGroupRowsToClipboard', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  test('copies only the rows beneath the group, optionally with a header', () => {
    const table = setup({ grouping: ['Type'] });
    const groupRow = table.getRowModel().rows.find((row) => row.getIsGrouped() && row.groupingValue === 'Alpha');

    const result = copyGridGroupRowsToClipboard(table, groupRow!, false);

    expect(result).toEqual({ rowCount: 2, columnCount: 4 });
    expect(copiedRecords().records).toEqual([
      { c0: 'Alpha', c1: 'One', c2: 'Acme', c3: '1 items' },
      { c0: 'Alpha', c1: 'Three', c2: 'Hooli', c3: '3 items' },
    ]);

    copyRecordsToClipboard.mockClear();
    copyGridGroupRowsToClipboard(table, groupRow!, true);
    expect(copiedRecords().records[0]).toEqual({ c0: 'Type', c1: 'Record Name', c2: 'Account Name', c3: 'Detail' });
  });
});

describe('copyGenericTableDataToClipboard', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  const detailColumn = columns.find(({ key }) => key === 'Detail')!;
  const nameColumn = columns.find(({ key }) => key === 'Name')!;
  const fields = columns.map(({ key }) => key);
  const actionData = (column: ColumnWithFilter<Row>) => ({ row: data[0], rows: data, rowIdx: 0, column, columns });

  test('copies a column through getValue so the clipboard matches the rendered cell', () => {
    copyGenericTableDataToClipboard('COPY_COL', fields, actionData(detailColumn));
    const [records, format, copiedFields] = copyRecordsToClipboard.mock.calls[0];
    expect(format).toBe('excel');
    expect(copiedFields).toEqual(['Detail']);
    expect(records).toEqual([{ Detail: '1 items' }, { Detail: '2 items' }, { Detail: '3 items' }]);
  });

  test('falls back to the raw row property for columns without getValue', () => {
    copyGenericTableDataToClipboard('COPY_CELL', fields, actionData(nameColumn));
    const [records, , copiedFields] = copyRecordsToClipboard.mock.calls[0];
    expect(copiedFields).toEqual(['Name']);
    expect(records).toEqual([{ Name: 'One' }]);
  });

  test('resolves getValue for every column when copying whole rows as text', () => {
    copyGenericTableDataToClipboard('COPY_ROW_EXCEL', fields, actionData(nameColumn));
    const [records, format] = copyRecordsToClipboard.mock.calls[0];
    expect(format).toBe('excel');
    expect(records[0]).toMatchObject({ Name: 'One', Detail: '1 items' });
  });

  test('keeps raw values for JSON copies', () => {
    copyGenericTableDataToClipboard('COPY_ROW_JSON', fields, actionData(nameColumn));
    expect(copyRecordsToClipboard.mock.calls[0][0][0]).toMatchObject({ Detail: { count: 1 } });

    copyRecordsToClipboard.mockClear();
    copyGenericTableDataToClipboard('COPY_COL_JSON', fields, actionData(detailColumn));
    expect(copyRecordsToClipboard.mock.calls[0][0]).toEqual([{ Detail: { count: 1 } }, { Detail: { count: 2 } }, { Detail: { count: 3 } }]);
  });
});

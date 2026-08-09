import { ContextMenuItem } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { DataTable, DataTableProps } from '../../DataTable';
import { DataTree } from '../../DataTree';
import { SELECT_COLUMN_KEY } from '../grid-constants';
import { ColumnWithFilter, ContextMenuActionData } from '../grid-types';
import { SelectColumn } from '../renderers/CellRenderers';

const copyRecordsToClipboard = vi.hoisted(() => vi.fn());
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  copyRecordsToClipboard,
}));

interface Row {
  _key: string;
  Type: string;
  Name: string;
}

const columns: ColumnWithFilter<Row>[] = [
  { key: 'Type', name: 'Type' },
  { key: 'Name', name: 'Record Name' },
];

const data: Row[] = [
  { _key: '1', Type: 'Alpha', Name: 'One' },
  { _key: '2', Type: 'Beta', Name: 'Two' },
  { _key: '3', Type: 'Alpha', Name: 'Three' },
];

// The row/column virtualizers measure the scroll container, which jsdom reports as 0x0 — nothing would
// render. Give every element a viewport-sized box so the grid mounts real rows to right-click.
beforeAll(() => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value: 600 });
  }
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

function renderTable(props: Partial<DataTableProps<Row>> = {}) {
  return render(<DataTable columns={columns} data={data} getRowKey={(row) => row._key} {...props} />);
}

function getCell(rowId: string, columnId: string): HTMLElement {
  const cell = document.querySelector(`[data-row-id="${rowId}"][data-col-id="${columnId}"]`);
  if (!cell) {
    throw new Error(`No cell rendered for row ${rowId} / column ${columnId}`);
  }
  return cell as HTMLElement;
}

/** Right-click the element and return the menu's item labels (empty when no menu opened). */
async function openMenu(element: HTMLElement): Promise<string[]> {
  fireEvent.contextMenu(element);
  try {
    const items = await screen.findAllByRole('menuitem', {}, { timeout: 250 });
    return items.map((item) => item.textContent ?? '');
  } catch {
    return [];
  }
}

describe('context menu — a table that supplies no items of its own', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  test('right-clicking a data cell offers the standard copy actions', async () => {
    renderTable();

    expect(await openMenu(getCell('1', 'Name'))).toEqual([
      'Copy cell to clipboard',
      'Copy row to clipboard (Excel)',
      'Copy row to clipboard (JSON)',
      'Copy column to values clipboard',
      'Copy column to clipboard (Excel)',
      'Copy column to clipboard (JSON)',
      'Copy table to clipboard (Excel)',
      'Copy table to clipboard (CSV)',
      'Copy table to clipboard (JSON)',
    ]);
  });

  test('picking an action copies the right cell, without a consumer handler', async () => {
    renderTable();
    await openMenu(getCell('2', 'Name'));

    fireEvent.click(screen.getByText('Copy cell to clipboard'));

    await waitFor(() => expect(copyRecordsToClipboard).toHaveBeenCalled());
    const [records] = copyRecordsToClipboard.mock.calls[0];
    expect(records).toEqual([{ c0: 'Two' }]);
  });

  test('a column header offers only the column/table-scoped actions', async () => {
    renderTable();

    expect(await openMenu(getCell('__jgrid_header__', 'Type'))).toEqual([
      'Copy column to values clipboard',
      'Copy column to clipboard (Excel)',
      'Copy column to clipboard (JSON)',
      'Copy table to clipboard (Excel)',
      'Copy table to clipboard (CSV)',
      'Copy table to clipboard (JSON)',
    ]);
  });

  test('the row-selection column keeps the native menu — it has no data to copy', async () => {
    renderTable({
      columns: [{ ...SelectColumn, key: SELECT_COLUMN_KEY }, ...columns],
      selectedRows: new Set<string>(),
      onSelectedRowsChange: vi.fn(),
    });

    expect(await openMenu(getCell('1', SELECT_COLUMN_KEY))).toEqual([]);
  });

  test('an explicit empty list opts out of the copy actions', async () => {
    renderTable({ contextMenuItems: [] });

    expect(await openMenu(getCell('1', 'Name'))).toEqual([]);
  });
});

describe('context menu — a table with its own items', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  test('a per-cell BUILDER still gets a column-scoped header menu', async () => {
    // Regression: header right-click previously required a static array, so builder-driven tables
    // (Deploy, Manage Permissions fields) had no header menu at all.
    const contextMenuItems = (actionData: ContextMenuActionData<Row>): ContextMenuItem[] => [
      { label: `Copy column (${actionData.row.Type})`, value: 'COPY_COL_TYPE' },
      { label: 'Copy column (All Types)', value: 'COPY_COL' },
    ];
    renderTable({ contextMenuItems, contextMenuAction: vi.fn() });

    expect(await openMenu(getCell('__jgrid_header__', 'Name'))).toEqual(['Copy column (All Types)']);
  });

  test('consumer items are dispatched to the consumer, not the grid', async () => {
    const contextMenuAction = vi.fn();
    renderTable({ contextMenuItems: [{ label: 'Do a thing', value: 'CUSTOM' }], contextMenuAction });
    await openMenu(getCell('1', 'Name'));

    fireEvent.click(screen.getByText('Do a thing'));

    expect(contextMenuAction).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'CUSTOM' }),
      expect.objectContaining({ row: data[0], rowIdx: 0 }),
    );
    expect(copyRecordsToClipboard).not.toHaveBeenCalled();
  });
});

describe('context menu — group header rows', () => {
  beforeEach(() => copyRecordsToClipboard.mockClear());

  test('offers to copy the group’s own rows, with or without a header', async () => {
    render(<DataTree columns={columns} data={data} getRowKey={(row) => row._key} groupBy={['Type']} defaultExpanded />);
    const groupCell = document.querySelector('.jgrid-group-cell') as HTMLElement;

    expect(await openMenu(groupCell)).toEqual(['Copy rows in group', 'Copy rows in group with header']);

    fireEvent.click(screen.getByText('Copy rows in group with header'));

    await waitFor(() => expect(copyRecordsToClipboard).toHaveBeenCalled());
    const [records] = copyRecordsToClipboard.mock.calls[0];
    expect(records).toEqual([
      { c0: 'Type', c1: 'Record Name' },
      { c0: 'Alpha', c1: 'One' },
      { c0: 'Alpha', c1: 'Three' },
    ]);
  });
});

import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { DataTable, DataTableProps } from '../../DataTable';
import { ColumnWithFilter } from '../grid-types';

interface Row {
  _key: string;
  Type: string;
  Name: string;
}

/** The permission manager's shape: the first column's summary cell renders a quick-filter text input. */
const columns: ColumnWithFilter<Row, any>[] = [
  {
    key: 'Type',
    name: 'Type',
    renderSummaryCell: () => <input aria-label="Filter" type="text" placeholder="Filter..." />,
  },
  { key: 'Name', name: 'Record Name', editable: true },
];

const data: Row[] = [
  { _key: '1', Type: 'Alpha', Name: 'One' },
  { _key: '2', Type: 'Beta', Name: 'Two' },
];

// The virtualizers measure the scroll container, which jsdom reports as 0x0 — nothing would render.
// Give every element a viewport-sized box so the grid mounts real rows and summary cells.
beforeAll(() => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value: 600 });
  }
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

function renderTable(props: Partial<DataTableProps<Row>> = {}) {
  return render(
    <DataTable columns={columns as any} data={data} getRowKey={(row) => row._key} topSummaryRows={[{}]} summaryRowHeight={38} {...props} />,
  );
}

function getCell(rowId: string, columnId: string): HTMLElement {
  const cell = document.querySelector(`[data-row-id="${rowId}"][data-col-id="${columnId}"]`);
  if (!cell) {
    throw new Error(`No cell rendered for row ${rowId} / column ${columnId}`);
  }
  return cell as HTMLElement;
}

/** Dispatches a real ClipboardEvent-shaped event and reports whether the default action survived. */
function pasteInto(element: HTMLElement, text: string): boolean {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { getData: () => text };
  return element.dispatchEvent(event);
}

describe('in-cell text inputs keep their own keyboard and clipboard behavior', () => {
  test('a grid whose summary row holds a filter input has no axe violations', async () => {
    const { baseElement } = renderTable();
    await axeScan(baseElement);
  });

  test('pasting into a summary row filter input is left to the input', () => {
    const onPaste = vi.fn();
    const { getByLabelText } = renderTable({ onPaste });
    const input = getByLabelText('Filter') as HTMLInputElement;

    // Clicking the input makes its summary cell the active cell — the state that used to make the
    // grid claim the paste and preventDefault it, so nothing ever landed in the input.
    fireEvent.mouseDown(input);
    input.focus();

    expect(pasteInto(input, 'hello world')).toBe(true);
    expect(onPaste).not.toHaveBeenCalled();
  });

  test('caret keys in a summary row filter input do not move the active cell', () => {
    const { getByLabelText } = renderTable({ onPaste: vi.fn() });
    const input = getByLabelText('Filter') as HTMLInputElement;

    fireEvent.mouseDown(input);
    input.focus();

    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
      expect(document.activeElement).toBe(input);
    }
  });

  // A cell whose only control is the filter input has nothing for Tab to cycle to, so Tab is the way
  // back to the cell — focus must stay inside the grid instead of escaping to the next page tab stop.
  test('Tab in actionable mode returns focus to the cell when there is only one control', () => {
    const { getByLabelText } = renderTable({ onPaste: vi.fn() });
    const input = getByLabelText('Filter') as HTMLInputElement;
    const cell = input.closest('[data-row-id]') as HTMLElement;

    fireEvent.mouseDown(cell);
    fireEvent.keyDown(cell, { key: 'Enter' });
    input.focus();

    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(cell);
  });

  test('pasting into a data cell still reaches the grid', () => {
    const onPaste = vi.fn();
    renderTable({ onPaste });
    const cell = getCell('1', 'Name');

    fireEvent.mouseDown(cell);
    expect(pasteInto(cell, 'pasted')).toBe(false);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });
});

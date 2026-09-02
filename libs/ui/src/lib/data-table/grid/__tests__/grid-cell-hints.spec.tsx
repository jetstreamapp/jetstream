import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, test } from 'vitest';
import { DataTable } from '../../DataTable';
import { ColumnWithFilter } from '../grid-types';

interface Row {
  _key: string;
  Name: string;
  Amount: string;
  Link: string;
}

const columns: ColumnWithFilter<Row>[] = [
  { key: 'Name', name: 'Name' },
  { key: 'Amount', name: 'Amount', editable: true, renderEditCell: () => null },
  { key: 'Link', name: 'Link', renderCell: ({ row }) => <button type="button">Open {row.Link}</button> },
];

const data: Row[] = [
  { _key: '1', Name: 'Alpha', Amount: '10', Link: 'one' },
  { _key: '2', Name: 'Bravo', Amount: '20', Link: 'two' },
];

// The virtualizers measure the scroll container, which jsdom reports as 0x0 — give every element a
// viewport-sized box so the grid mounts real rows.
beforeAll(() => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value: 600 });
  }
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

function getCell(rowId: string, columnId: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`[data-row-id="${rowId}"][data-col-id="${columnId}"]`);
  if (!cell) {
    throw new Error(`No cell rendered for row ${rowId} / column ${columnId}`);
  }
  return cell;
}

function describedByText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `<missing ${id}>`)
    .join(' ');
}

/** Land keyboard focus on a cell: a click sets the active cell, an arrow key move then drives cell focus. */
async function arrowTo(fromCell: HTMLElement, key: 'ArrowRight' | 'ArrowLeft', expectedCell: HTMLElement) {
  fireEvent.keyDown(fromCell, { key });
  await waitFor(() => expect(document.activeElement).toBe(expectedCell));
}

describe('grid cell keyboard hints', () => {
  test('a focused cell is described by what Enter does with it: editing, or its inner controls', async () => {
    render(<DataTable columns={columns} data={data} getRowKey={(row) => row._key} />);
    const nameCell = getCell('1', 'Name');
    const amountCell = getCell('1', 'Amount');
    const linkCell = getCell('1', 'Link');
    fireEvent.mouseDown(nameCell);

    await arrowTo(nameCell, 'ArrowRight', amountCell);
    expect(describedByText(amountCell)).toMatch(/editable\. press enter to edit/i);

    await arrowTo(amountCell, 'ArrowRight', linkCell);
    expect(describedByText(linkCell)).toMatch(/contains controls\. press enter/i);
    // the hint moved with focus
    expect(amountCell.hasAttribute('aria-describedby')).toBe(false);

    await arrowTo(linkCell, 'ArrowLeft', amountCell);
    await arrowTo(amountCell, 'ArrowLeft', nameCell);
    // a plain read-only cell gets no hint at all
    expect(nameCell.hasAttribute('aria-describedby')).toBe(false);
    expect(linkCell.hasAttribute('aria-describedby')).toBe(false);
  });
});

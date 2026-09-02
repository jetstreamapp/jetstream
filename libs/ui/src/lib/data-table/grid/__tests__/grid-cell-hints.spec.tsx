import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, test } from 'vitest';
import { DataTable } from '../../DataTable';
import { ColumnWithFilter } from '../grid-types';

interface Row {
  _key: string;
  Name: string;
  Amount: string;
  Link: string;
  Url: string;
  Both: string;
}

const columns: ColumnWithFilter<Row>[] = [
  { key: 'Name', name: 'Name' },
  { key: 'Amount', name: 'Amount', editable: true, renderEditCell: () => null },
  { key: 'Link', name: 'Link', renderCell: ({ row }) => <button type="button">Open {row.Link}</button> },
  {
    key: 'Url',
    name: 'Url',
    renderCell: ({ row }) => (
      <a href={row.Url} target="_blank" rel="noreferrer">
        View in Salesforce
      </a>
    ),
  },
  {
    key: 'Both',
    name: 'Both',
    renderCell: ({ row }) => (
      <>
        <button type="button">Expand</button>
        <a href={row.Both}>Open</a>
      </>
    ),
  },
];

const data: Row[] = [
  { _key: '1', Name: 'Alpha', Amount: '10', Link: 'one', Url: 'https://example.com/1', Both: 'https://example.com/a' },
  { _key: '2', Name: 'Bravo', Amount: '20', Link: 'two', Url: 'https://example.com/2', Both: 'https://example.com/b' },
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
  test('a focused cell is described by what Enter does with it: edit, activate, open a link, or enter the cell', async () => {
    const { baseElement } = render(<DataTable columns={columns} data={data} getRowKey={(row) => row._key} />);
    const nameCell = getCell('1', 'Name');
    const amountCell = getCell('1', 'Amount');
    const linkCell = getCell('1', 'Link');
    const urlCell = getCell('1', 'Url');
    const bothCell = getCell('1', 'Both');
    fireEvent.mouseDown(nameCell);

    await arrowTo(nameCell, 'ArrowRight', amountCell);
    expect(describedByText(amountCell)).toMatch(/editable\. press enter to edit/i);
    await axeScan(baseElement);

    await arrowTo(amountCell, 'ArrowRight', linkCell);
    expect(describedByText(linkCell)).toMatch(/contains a control\. press enter to activate it/i);
    // the hint moved with focus
    expect(amountCell.hasAttribute('aria-describedby')).toBe(false);

    await arrowTo(linkCell, 'ArrowRight', urlCell);
    expect(describedByText(urlCell)).toMatch(/contains a link\. press enter to open it/i);

    await arrowTo(urlCell, 'ArrowRight', bothCell);
    expect(describedByText(bothCell)).toMatch(/contains controls\. press enter to move to them/i);

    await arrowTo(bothCell, 'ArrowLeft', urlCell);
    await arrowTo(urlCell, 'ArrowLeft', linkCell);
    await arrowTo(linkCell, 'ArrowLeft', amountCell);
    await arrowTo(amountCell, 'ArrowLeft', nameCell);
    // a plain read-only cell gets no hint at all
    expect(nameCell.hasAttribute('aria-describedby')).toBe(false);
    expect(linkCell.hasAttribute('aria-describedby')).toBe(false);
  });
});

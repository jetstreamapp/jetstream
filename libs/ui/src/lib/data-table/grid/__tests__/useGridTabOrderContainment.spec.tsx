import { fireEvent, render, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeAll, describe, expect, test } from 'vitest';
import { DataTable } from '../../DataTable';
import { ColumnWithFilter } from '../grid-types';

interface Row {
  _key: string;
  Id: string;
  Name: string;
}

/** Mirrors SalesforceLogin: renders nothing until an async value resolves, then mounts a link. */
function LateMountedLink({ id }: { id: string }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => setHref(`https://example.com/${id}`), 0);
    return () => clearTimeout(timeout);
  }, [id]);
  if (!href) {
    return null;
  }
  return (
    <a href={href} data-testid={`late-link-${id}`}>
      {id}
    </a>
  );
}

const columns: ColumnWithFilter<Row>[] = [
  {
    key: 'Id',
    name: 'Id',
    renderCell: ({ row }) => (
      <span>
        <a href={`https://example.com/${row.Id}`} data-testid={`link-${row.Id}`}>
          {row.Id}
        </a>
        <button data-testid={`button-${row.Id}`} tabIndex={0}>
          act
        </button>
      </span>
    ),
  },
  {
    key: 'Name',
    name: 'Name',
    renderCell: ({ row }) => <LateMountedLink id={row.Id} />,
  },
];

const data: Row[] = [
  { _key: '1', Id: '001', Name: 'One' },
  { _key: '2', Id: '002', Name: 'Two' },
];

// The row/column virtualizers measure the scroll container, which jsdom reports as 0x0 — nothing would
// render. Give every element a viewport-sized box so the grid mounts real rows.
beforeAll(() => {
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value: 600 });
  }
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

function renderTable() {
  return render(<DataTable columns={columns} data={data} getRowKey={(row) => row._key} />);
}

describe('grid tab-order containment (single page tab stop)', () => {
  test('links and buttons rendered by consumer cell renderers are removed from the tab order', async () => {
    const { getByTestId } = renderTable();

    await waitFor(() => {
      expect((getByTestId('link-001') as HTMLElement).tabIndex).toBe(-1);
      expect((getByTestId('link-002') as HTMLElement).tabIndex).toBe(-1);
      expect((getByTestId('button-001') as HTMLElement).tabIndex).toBe(-1);
    });
  });

  test('a link that mounts after the cell (async href, like SalesforceLogin) is also removed', async () => {
    const { findByTestId } = renderTable();

    const lateLink = (await findByTestId('late-link-001')) as HTMLElement;
    await waitFor(() => expect(lateLink.tabIndex).toBe(-1));
  });

  test('the roving tabindex on the active cell is left alone', async () => {
    renderTable();

    const cell = document.querySelector('[data-row-id="1"][data-col-id="Id"]') as HTMLElement;
    expect(cell).toBeTruthy();
    fireEvent.mouseDown(cell);
    expect(cell.tabIndex).toBe(0);

    // Give the MutationObserver's microtask a chance to (incorrectly) sweep it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cell.tabIndex).toBe(0);
  });
});

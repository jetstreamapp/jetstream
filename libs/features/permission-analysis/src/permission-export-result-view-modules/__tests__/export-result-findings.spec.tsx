import type { ColumnWithFilter } from '@jetstream/ui';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { withFindingDetailsCell } from '../export-result-findings';

type Row = { Id: string; severity?: 'error' | 'warning' };

function renderCellOf(column: ColumnWithFilter<Row>, row: Row) {
  const renderCell = column.renderCell as unknown as (props: { row: Row; column: unknown }) => ReactNode;
  return render(<div>{renderCell({ row, column })}</div>);
}

describe('withFindingDetailsCell', () => {
  const baseColumn = {
    key: 'Id',
    renderCell: ({ row }: { row: Row }) => <a href={`/${row.Id}`}>{row.Id}</a>,
  } as unknown as ColumnWithFilter<Row>;

  test('adds a details button, hidden until focused, next to the cell content when the row has a finding', () => {
    const column = withFindingDetailsCell<Row>(baseColumn, (row) => row.severity, { columnLabel: 'Id' });
    renderCellOf(column, { Id: '001', severity: 'error' });

    expect(screen.getByRole('link', { name: '001' })).toBeTruthy();
    const button = screen.getByRole('button', { name: 'View error details for Id' });
    expect(button.className).toContain('slds-assistive-text');
    expect(button.className).toContain('slds-assistive-text_focus');
    expect(button.getAttribute('type')).toBe('button');
  });

  test('renders only the cell content when the row has no finding', () => {
    const column = withFindingDetailsCell<Row>(baseColumn, (row) => row.severity);
    renderCellOf(column, { Id: '002' });

    expect(screen.getByRole('link', { name: '002' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test("merges the severity cell class with the column's own class", () => {
    const column = withFindingDetailsCell<Row>({ ...baseColumn, cellClass: 'my-cell' } as ColumnWithFilter<Row>, (row) => row.severity);
    const cellClass = column.cellClass as (row: Row) => string | undefined;
    expect(cellClass({ Id: '003', severity: 'warning' })).toContain('my-cell');
    expect(cellClass({ Id: '003' })).toBe('my-cell');
  });
});

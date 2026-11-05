import { ListItem, QueryOrderByClause } from '@jetstream/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QueryOrderByContainer from '../QueryOrderBy';

const FIELDS: ListItem[] = [
  { id: 'Name', label: 'Name', value: 'Name' },
  { id: 'CreatedDate', label: 'Created Date', value: 'CreatedDate' },
  { id: 'Industry', label: 'Industry', value: 'Industry' },
];

const CLAUSES: QueryOrderByClause[] = [
  { key: 0, field: 'Name', fieldLabel: 'Name (Name)', order: 'ASC', nulls: null },
  { key: 1, field: 'CreatedDate', fieldLabel: 'CreatedDate (Created Date)', order: 'DESC', nulls: 'LAST' },
  { key: 2, field: 'Industry', fieldLabel: 'Industry (Industry)', order: 'ASC', nulls: 'FIRST' },
];

function renderOrderBy(orderByClauses: QueryOrderByClause[]) {
  const setOrderByClauses = vi.fn();
  render(
    <QueryOrderByContainer
      sobject="Account"
      fields={FIELDS}
      orderByClauses={orderByClauses}
      setOrderByClauses={setOrderByClauses}
      onLoadRelatedFields={async () => []}
    />,
  );
  return setOrderByClauses;
}

function getRowButton(rowNumber: number, title: string) {
  return within(screen.getByRole('group', { name: `Order by row ${rowNumber}` })).getByTitle(title) as HTMLButtonElement;
}

function isDisabled(button: HTMLButtonElement) {
  return button.getAttribute('aria-disabled') === 'true';
}

describe('QueryOrderByContainer reordering', () => {
  it('moves a clause up', () => {
    const setOrderByClauses = renderOrderBy(CLAUSES);
    fireEvent.click(getRowButton(2, 'Move Up'));
    expect(setOrderByClauses).toHaveBeenCalledWith([CLAUSES[1], CLAUSES[0], CLAUSES[2]]);
  });

  it('moves a clause down', () => {
    const setOrderByClauses = renderOrderBy(CLAUSES);
    fireEvent.click(getRowButton(2, 'Move Down'));
    expect(setOrderByClauses).toHaveBeenCalledWith([CLAUSES[0], CLAUSES[2], CLAUSES[1]]);
  });

  it('disables moving past either end of the list', () => {
    const setOrderByClauses = renderOrderBy(CLAUSES);
    // aria-disabled, not native disabled, so a button that disables itself keeps focus
    expect(isDisabled(getRowButton(1, 'Move Up'))).toBe(true);
    expect(isDisabled(getRowButton(1, 'Move Down'))).toBe(false);
    expect(isDisabled(getRowButton(3, 'Move Up'))).toBe(false);
    expect(isDisabled(getRowButton(3, 'Move Down'))).toBe(true);
    expect(getRowButton(1, 'Move Up').disabled).toBe(false);

    fireEvent.click(getRowButton(1, 'Move Up'));
    fireEvent.click(getRowButton(3, 'Move Down'));
    expect(setOrderByClauses).not.toHaveBeenCalled();
  });

  it('disables both directions when there is only one clause', () => {
    renderOrderBy([CLAUSES[0]]);
    expect(isDisabled(getRowButton(1, 'Move Up'))).toBe(true);
    expect(isDisabled(getRowButton(1, 'Move Down'))).toBe(true);
  });
});

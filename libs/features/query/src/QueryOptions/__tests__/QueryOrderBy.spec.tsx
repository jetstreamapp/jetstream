import { ListItem, QueryOrderByClause } from '@jetstream/types';
import { fromQueryState } from '@jetstream/ui-core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryOrderByContainer } from '../QueryOrderBy';

// The real app-state module fetches app info and the profile at module load; the ui-core barrel the
// component imports `fromQueryState` from reaches it, so stub the atoms it resolves at module load
vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ serverUrl: 'http://localhost' }),
    selectedOrgState: atom({ uniqueId: 'org-1', label: 'Org 1' }),
  };
});

const FIELDS: ListItem[] = [
  { id: 'Id', label: 'Record ID', value: 'Id' },
  { id: 'Name', label: 'Account Name', value: 'Name' },
];

/** Owns the clause list the same way the query builder / subquery panel does */
function OrderByHarness({ label, initialClauses }: { label: string; initialClauses: QueryOrderByClause[] }) {
  const [orderByClauses, setOrderByClauses] = useState(initialClauses);
  return (
    <section aria-label={label}>
      <QueryOrderByContainer
        sobject="Account"
        fields={FIELDS}
        orderByClauses={orderByClauses}
        setOrderByClauses={setOrderByClauses}
        onLoadRelatedFields={() => Promise.resolve([])}
      />
    </section>
  );
}

function buildClauses(count: number): QueryOrderByClause[] {
  return Array.from({ length: count }, (_, i) => fromQueryState.initOrderByClause(i));
}

/** Two instances side by side, as the app mounts one in the query builder and one in the subquery panel */
function setup({ parentRowCount = 2, subqueryRowCount = 2 }: { parentRowCount?: number; subqueryRowCount?: number } = {}) {
  render(
    <>
      <OrderByHarness label="Query order by" initialClauses={buildClauses(parentRowCount)} />
      <OrderByHarness label="Subquery order by" initialClauses={buildClauses(subqueryRowCount)} />
    </>,
  );
  return {
    parent: screen.getByRole('region', { name: 'Query order by' }),
    subquery: screen.getByRole('region', { name: 'Subquery order by' }),
  };
}

function getRows(instance: HTMLElement) {
  return within(instance).getAllByRole('group', { name: /^Order by row \d+$/ });
}

function getRowButton(instance: HTMLElement, rowNumber: number, title: string) {
  return within(within(instance).getByRole('group', { name: `Order by row ${rowNumber}` })).getByTitle(title);
}

function getDeleteButton(instance: HTMLElement, rowNumber: number) {
  return getRowButton(instance, rowNumber, 'Delete Condition');
}

describe('QueryOrderByContainer', () => {
  it('numbers the rows of each instance independently', () => {
    const { parent, subquery } = setup();

    expect(getRows(parent)).toHaveLength(2);
    expect(getRows(subquery)).toHaveLength(2);
  });

  it('moves focus to the previous row of the SAME instance after a row is deleted', async () => {
    const { parent, subquery } = setup();
    const deleteButton = getDeleteButton(subquery, 2);
    deleteButton.focus();

    fireEvent.click(deleteButton);

    await waitFor(() => expect(getRows(subquery)).toHaveLength(1));
    // the delete button unmounted with its row, so focus is handed to the previous row's delete button
    await waitFor(() => expect(document.activeElement).toBe(getDeleteButton(subquery, 1)));
    expect(parent.contains(document.activeElement)).toBe(false);
    expect(getRows(parent)).toHaveLength(2);
  });

  it('keeps focus in the instance when the only row is deleted, since the list refills with one row', async () => {
    const { parent, subquery } = setup({ subqueryRowCount: 1 });
    const deleteButton = getDeleteButton(subquery, 1);
    deleteButton.focus();

    fireEvent.click(deleteButton);

    await waitFor(() => expect(document.activeElement).toBe(getDeleteButton(subquery, 1)));
    expect(getRows(subquery)).toHaveLength(1);
    expect(subquery.contains(document.activeElement)).toBe(true);
    expect(parent.contains(document.activeElement)).toBe(false);
  });

  it('deleting the first of two rows lands on the row that is now first', async () => {
    const { subquery } = setup();
    const deleteButton = getDeleteButton(subquery, 1);
    deleteButton.focus();

    fireEvent.click(deleteButton);

    await waitFor(() => expect(getRows(subquery)).toHaveLength(1));
    await waitFor(() => expect(document.activeElement).toBe(getDeleteButton(subquery, 1)));
  });

  it('follows a row moved up with focus, on the same button, and announces its new position', async () => {
    const { parent, subquery } = setup({ subqueryRowCount: 3 });
    const moveUpButton = getRowButton(subquery, 3, 'Move Up');
    moveUpButton.focus();

    fireEvent.click(moveUpButton);

    await waitFor(() => expect(document.activeElement).toBe(getRowButton(subquery, 2, 'Move Up')));
    expect(parent.contains(document.activeElement)).toBe(false);
    await waitFor(() => expect(within(subquery).getByRole('status').textContent).toBe('Moved to position 2 of 3'));
  });

  it('lands on Move Down when a row is moved up into the first position, where Move Up is now disabled', async () => {
    const { subquery } = setup();
    const moveUpButton = getRowButton(subquery, 2, 'Move Up');
    moveUpButton.focus();

    fireEvent.click(moveUpButton);

    await waitFor(() => expect(document.activeElement).toBe(getRowButton(subquery, 1, 'Move Down')));
    expect(getRowButton(subquery, 1, 'Move Up').getAttribute('aria-disabled')).toBe('true');
    await waitFor(() => expect(within(subquery).getByRole('status').textContent).toBe('Moved to position 1 of 2'));
  });

  it('lands on Move Up when a row is moved down into the last position', async () => {
    const { subquery } = setup();
    const moveDownButton = getRowButton(subquery, 1, 'Move Down');
    moveDownButton.focus();

    fireEvent.click(moveDownButton);

    await waitFor(() => expect(document.activeElement).toBe(getRowButton(subquery, 2, 'Move Up')));
    await waitFor(() => expect(within(subquery).getByRole('status').textContent).toBe('Moved to position 2 of 2'));
  });

  it('adds a row and caps the list at five', () => {
    const { subquery } = setup({ subqueryRowCount: 4 });
    const addButton = within(subquery).getByRole('button', { name: 'Add Order By' });

    addButton.focus();
    fireEvent.click(addButton);

    expect(getRows(subquery)).toHaveLength(5);
    // The click disables the button — through aria-disabled, so focus stays on it instead of falling to body
    expect(addButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(addButton);
    fireEvent.click(addButton);
    expect(getRows(subquery)).toHaveLength(5);
  });
});

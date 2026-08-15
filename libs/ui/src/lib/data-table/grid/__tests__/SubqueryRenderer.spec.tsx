/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { GridSubqueryContext } from '../grid-context';
import { ColumnWithFilter, SubqueryContext, SubqueryLevel } from '../grid-types';
import { SubqueryRenderer } from '../renderers/SubqueryRenderer';

function makeColumns(keys: string[]): ColumnWithFilter<any>[] {
  return keys.map((key) => ({ key, name: key })) as ColumnWithFilter<any>[];
}

function makeQueryResult(count: number) {
  return {
    done: true,
    totalSize: count,
    records: Array.from({ length: count }, (_, index) => ({
      Id: `00${index}`,
      attributes: { type: 'Case', url: `/services/data/v66.0/sobjects/Case/00${index}` },
    })),
  };
}

function renderCell({ columnKey, row, context }: { columnKey: string; row: any; context: Partial<SubqueryContext> }) {
  const fullContext = {
    serverUrl: '',
    skipFrontdoorLogin: false,
    org: {} as any,
    isTooling: false,
    hasGoogleDriveAccess: false,
    googleShowUpgradeToPro: false,
    google_apiKey: '',
    google_appId: '',
    google_clientId: '',
    ...context,
  } as SubqueryContext;

  return render(
    <GridSubqueryContext.Provider value={fullContext}>
      <SubqueryRenderer column={{ key: columnKey } as any} row={row} {...({} as any)} />
    </GridSubqueryContext.Provider>,
  );
}

describe('SubqueryRenderer', () => {
  test('renders nothing when the subquery returned no records', () => {
    renderCell({ columnKey: 'Cases', row: { Cases: { done: true, totalSize: 0, records: [] } }, context: {} });

    expect(screen.queryByRole('button')).toBeNull();
  });

  test('renders nothing when no column definitions exist for the relationship', () => {
    renderCell({ columnKey: 'Cases', row: { Cases: makeQueryResult(2) }, context: { columnDefinitions: {} } });

    expect(screen.queryByRole('button')).toBeNull();
  });

  test('shows the record count when column definitions resolve', () => {
    renderCell({
      columnKey: 'Cases',
      row: { Cases: makeQueryResult(2) },
      context: { columnDefinitions: { cases: makeColumns(['Id']) } },
    });

    expect(screen.getByRole('button', { name: /2 Records/ })).toBeTruthy();
  });

  test('drills down instead of opening its own modal when rendered inside the subquery modal', async () => {
    const onDrillDown = vi.fn();
    const row = { Cases: makeQueryResult(3) };
    renderCell({
      columnKey: 'Cases',
      row,
      // A nested render resolves its columns under the parent path, not the bare relationship name
      context: {
        columnDefinitions: { 'contacts.cases': makeColumns(['Id', 'Subject']) },
        nestedRender: { relationshipPath: 'Contacts', onDrillDown },
      },
    });

    await userEvent.click(screen.getByRole('button', { name: /3 Records/ }));

    expect(onDrillDown).toHaveBeenCalledTimes(1);
    const level: SubqueryLevel = onDrillDown.mock.calls[0][0];
    expect(level.relationshipPath).toBe('Contacts.Cases');
    expect(level.columnKey).toBe('Cases');
    expect(level.parentRecord).toBe(row);
    // No modal is opened - the parent modal navigates instead
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('a nested cell stays blank when the nested path has no column definitions', () => {
    renderCell({
      columnKey: 'Cases',
      row: { Cases: makeQueryResult(1) },
      // Only the top level `cases` is defined, which must not satisfy the nested `contacts.cases` lookup
      context: {
        columnDefinitions: { cases: makeColumns(['Id']) },
        nestedRender: { relationshipPath: 'Contacts', onDrillDown: vi.fn() },
      },
    });

    expect(screen.queryByRole('button')).toBeNull();
  });

  test('resolves the relationship path case-insensitively against the column definitions', () => {
    renderCell({
      columnKey: 'Cases',
      row: { Cases: makeQueryResult(1) },
      context: {
        columnDefinitions: { 'contacts.cases': makeColumns(['Id']) },
        nestedRender: { relationshipPath: 'contacts', onDrillDown: vi.fn() },
      },
    });

    expect(screen.getByRole('button', { name: /1 Records/ })).toBeTruthy();
  });
});

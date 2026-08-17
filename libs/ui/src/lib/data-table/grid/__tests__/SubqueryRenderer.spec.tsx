/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockedQueryRemainingSubqueryResults } = vi.hoisted(() => ({ mockedQueryRemainingSubqueryResults: vi.fn() }));

vi.mock('@jetstream/shared/data', async () => {
  const actual = await vi.importActual<typeof import('@jetstream/shared/data')>('@jetstream/shared/data');
  return { ...actual, queryRemainingSubqueryResults: mockedQueryRemainingSubqueryResults };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridSubqueryContext } from '../grid-context';
import { ColumnWithFilter, SubqueryContext, SubqueryLevel } from '../grid-types';
import { SubqueryRenderer } from '../renderers/SubqueryRenderer';

function makeColumns(keys: string[]): ColumnWithFilter<any>[] {
  return keys.map((key) => ({ key, name: key })) as ColumnWithFilter<any>[];
}

function makeRecords(count: number, type = 'Case', extra: (index: number) => Record<string, unknown> = () => ({})) {
  return Array.from({ length: count }, (_, index) => ({
    Id: `00${index}`,
    attributes: { type, url: `/services/data/v66.0/sobjects/${type}/00${index}` },
    ...extra(index),
  }));
}

function makeQueryResult(count: number, { done = true, nextRecordsUrl = undefined as string | undefined, totalSize = count } = {}) {
  return { done, totalSize, records: makeRecords(count), ...(nextRecordsUrl ? { nextRecordsUrl } : {}) };
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

const WARNING_NAME = /Some related records were not loaded/;

describe('SubqueryRenderer', () => {
  beforeEach(() => {
    mockedQueryRemainingSubqueryResults.mockReset();
  });

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

  describe('truncated child records', () => {
    test('shows no warning when Salesforce returned every child record', () => {
      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(2) },
        context: { columnDefinitions: { cases: makeColumns(['Id']) } },
      });

      expect(screen.queryByRole('button', { name: WARNING_NAME })).toBeNull();
    });

    test('warns with the loaded and total counts when the subquery itself was truncated', async () => {
      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(2, { done: false, nextRecordsUrl: '/next', totalSize: 2317 }) },
        context: { columnDefinitions: { cases: makeColumns(['Id']) }, onSubqueryRecordsLoaded: vi.fn() },
      });

      await userEvent.click(screen.getByRole('button', { name: WARNING_NAME }));

      expect(screen.getByText(/Salesforce returned 2 of 2,317 Cases records/)).toBeTruthy();
    });

    test('warns when only a subquery nested inside the child records was truncated', () => {
      const casesWithTruncatedComments = {
        done: true,
        totalSize: 1,
        records: makeRecords(1, 'Case', () => ({
          CaseComments: { done: false, totalSize: 500, records: [], nextRecordsUrl: '/next/comments' },
        })),
      };
      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: casesWithTruncatedComments },
        context: { columnDefinitions: { cases: makeColumns(['Id']) } },
      });

      expect(screen.getByRole('button', { name: WARNING_NAME })).toBeTruthy();
    });

    test('loads the remaining records and hands them back to the record that owns them', async () => {
      const onSubqueryRecordsLoaded = vi.fn();
      const completed = makeQueryResult(3);
      mockedQueryRemainingSubqueryResults.mockResolvedValue(completed);

      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(1, { done: false, nextRecordsUrl: '/next', totalSize: 3 }) },
        context: { columnDefinitions: { cases: makeColumns(['Id']) }, onSubqueryRecordsLoaded },
      });

      await userEvent.click(screen.getByRole('button', { name: WARNING_NAME }));
      await userEvent.click(screen.getByRole('button', { name: 'Load remaining records' }));

      await waitFor(() => expect(onSubqueryRecordsLoaded).toHaveBeenCalledWith('001A', 'Cases', completed));
      // The popover closes itself once the records are handed off
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Load remaining records' })).toBeNull());
    });

    test('does not load anything when the owner refuses to replace its records', async () => {
      const onSubqueryRecordsLoaded = vi.fn();
      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(1, { done: false, nextRecordsUrl: '/next', totalSize: 3 }) },
        context: {
          columnDefinitions: { cases: makeColumns(['Id']) },
          onSubqueryRecordsLoaded,
          confirmReplaceRecords: () => Promise.resolve(false),
        },
      });

      await userEvent.click(screen.getByRole('button', { name: WARNING_NAME }));
      await userEvent.click(screen.getByRole('button', { name: 'Load remaining records' }));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Load remaining records' })).toBeNull());
      expect(mockedQueryRemainingSubqueryResults).not.toHaveBeenCalled();
      expect(onSubqueryRecordsLoaded).not.toHaveBeenCalled();
    });

    test("the modal's own load action asks before replacing records too", async () => {
      const onSubqueryRecordsLoaded = vi.fn();
      const confirmReplaceRecords = vi.fn().mockResolvedValue(false);

      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(1, { done: false, nextRecordsUrl: '/next', totalSize: 3 }) },
        context: { columnDefinitions: { cases: makeColumns(['Id']) }, onSubqueryRecordsLoaded, confirmReplaceRecords },
      });

      await userEvent.click(screen.getByRole('button', { name: /1 Records/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Load Remaining' }));

      await waitFor(() => expect(confirmReplaceRecords).toHaveBeenCalled());
      expect(mockedQueryRemainingSubqueryResults).not.toHaveBeenCalled();
      expect(onSubqueryRecordsLoaded).not.toHaveBeenCalled();
    });

    test('omits the load action when there is nowhere to put the records', async () => {
      renderCell({
        columnKey: 'Cases',
        row: { _key: '001A', Cases: makeQueryResult(1, { done: false, nextRecordsUrl: '/next', totalSize: 3 }) },
        context: { columnDefinitions: { cases: makeColumns(['Id']) } },
      });

      await userEvent.click(screen.getByRole('button', { name: WARNING_NAME }));

      expect(screen.queryByRole('button', { name: 'Load remaining records' })).toBeNull();
    });
  });
});

import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, test } from 'vitest';
import { ColumnWithFilter, DataTableRef } from '../data-table-types';
import { useDataTable } from '../useDataTable';

interface Row {
  _key: string;
  Id: string;
  Name: string;
  Notes: string;
}

function buildProps(overrides: Partial<Parameters<typeof useDataTable>[0]> = {}) {
  const columns: ColumnWithFilter<Row>[] = [
    { key: 'Id', name: 'Id' },
    { key: 'Name', name: 'Name' },
    { key: 'Notes', name: 'Notes' },
  ];
  const data: Row[] = [
    { _key: '1', Id: '001', Name: 'Alpha', Notes: 'hello world' },
    { _key: '2', Id: '002', Name: 'Bravo', Notes: 'foo bar' },
  ];
  return {
    data,
    columns,
    includeQuickFilter: true,
    getRowKey: (row: Row) => row._key,
    ref: { current: null } as React.RefObject<DataTableRef<Row>>,
    ...overrides,
  };
}

describe('useDataTable quick filter', () => {
  test('matches rows case-insensitively with a simple search', () => {
    const props = buildProps({ quickFilterText: 'ALPHA' });
    const { result } = renderHook(() => useDataTable(props));
    // rowFilterText is populated via useEffect; flush once data is ready
    act(() => {});
    expect(result.current.filteredRows).toHaveLength(1);
    expect((result.current.filteredRows[0] as Row).Name).toBe('Alpha');
  });

  test('does not throw on very large pasted input with regex metacharacters', () => {
    // Simulate a user pasting an entire tab-separated row including regex-sensitive characters.
    // Reproduces the production crash where building `new RegExp(escapeRegExp(...))` threw
    // "Invalid regular expression" during the first `.test()` call on massive input.
    const giantPaste =
      'Id\tName\tNotes\t' + '2026-04-17T11:46:03.000+0000 | V4 - step.failed (see error) . | '.repeat(400);
    const props = buildProps({ quickFilterText: giantPaste });
    expect(() => {
      const { result } = renderHook(() => useDataTable(props));
      act(() => {});
      // Force evaluation of filteredRows (the crash site)
      void result.current.filteredRows.length;
    }).not.toThrow();
  });

  test('returns no rows when the filter text does not match', () => {
    const props = buildProps({ quickFilterText: 'nonexistent-text-xyz' });
    const { result } = renderHook(() => useDataTable(props));
    act(() => {});
    expect(result.current.filteredRows).toHaveLength(0);
  });
});

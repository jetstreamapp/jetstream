import { RowSelectionState } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { useJetstreamTable, UseJetstreamTableOptions } from '../core/useJetstreamTable';
import { ColumnWithFilter } from '../grid-types';

/**
 * Row selection + expansion moved from React state to external atoms (v9 `atoms` option). These specs
 * pin the dual-mode contract that the move must preserve:
 * - consumer callbacks fire EXACTLY once per interaction, even under StrictMode double-invocation;
 * - internal mode: the table owns the state (atom written directly);
 * - controlled mode: the consumer is the single authority — a consumer that ignores the callback
 *   vetoes the change, and applying it flows back through the prop→atom mirror.
 */

interface Row {
  _key: string;
  Name: string;
  children?: Row[];
}

const columns: ColumnWithFilter<Row>[] = [{ key: 'Name', name: 'Name', sortable: true }];

const flatData: Row[] = [
  { _key: '1', Name: 'Alpha' },
  { _key: '2', Name: 'Bravo' },
  { _key: '3', Name: 'Charlie' },
];

const treeData: Row[] = [
  { _key: 'parent', Name: 'Parent', children: [{ _key: 'child', Name: 'Child' }] },
  { _key: 'solo', Name: 'Solo' },
];

function setupHook(overrides: Partial<UseJetstreamTableOptions<Row>> = {}, useStrictMode = true) {
  const result = renderHook(
    () =>
      useJetstreamTable<Row>({
        data: flatData,
        columns,
        getRowKey: (row) => row._key,
        enableRowSelection: true,
        ...overrides,
      }),
    useStrictMode ? { wrapper: StrictMode } : undefined,
  );
  act(() => undefined);
  return result;
}

describe('rowSelection atom (dual-mode)', () => {
  test('internal mode: toggle updates the table and fires the callback exactly once (StrictMode)', () => {
    const onRowSelectionChange = vi.fn();
    const { result } = setupHook({ onRowSelectionChange });

    act(() => result.current.table.getRow('2', true).toggleSelected(true));

    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
    expect(onRowSelectionChange).toHaveBeenCalledWith({ '2': true });
    expect(result.current.table.store.state.rowSelection).toEqual({ '2': true });
    expect(result.current.table.getRow('2', true).getIsSelected()).toBe(true);
  });

  test('controlled mode: a consumer that ignores the callback vetoes the change', () => {
    const onRowSelectionChange = vi.fn();
    const { result } = setupHook({ rowSelection: {}, onRowSelectionChange });

    act(() => result.current.table.getRow('2', true).toggleSelected(true));

    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
    expect(onRowSelectionChange).toHaveBeenCalledWith({ '2': true });
    // The consumer never updated the prop, so the table selection must NOT change.
    expect(result.current.table.store.state.rowSelection).toEqual({});
    expect(result.current.table.getRow('2', true).getIsSelected()).toBe(false);
  });

  test('controlled mode: applying the callback flows back through the prop→atom mirror (StrictMode)', () => {
    const callCounts: RowSelectionState[] = [];
    const { result } = renderHook(
      () => {
        const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
        const hook = useJetstreamTable<Row>({
          data: flatData,
          columns,
          getRowKey: (row) => row._key,
          enableRowSelection: true,
          rowSelection,
          onRowSelectionChange: (next) => {
            callCounts.push(next);
            setRowSelection(next);
          },
        });
        return hook;
      },
      { wrapper: StrictMode },
    );
    act(() => undefined);

    act(() => result.current.table.getRow('1', true).toggleSelected(true));
    expect(callCounts).toEqual([{ '1': true }]);
    expect(result.current.table.store.state.rowSelection).toEqual({ '1': true });

    act(() => result.current.table.getRow('3', true).toggleSelected(true));
    expect(callCounts).toEqual([{ '1': true }, { '1': true, '3': true }]);
    expect(result.current.table.store.state.rowSelection).toEqual({ '1': true, '3': true });
  });

  test('select-all routes through the handler exactly once', () => {
    const onRowSelectionChange = vi.fn();
    const { result } = setupHook({ onRowSelectionChange });

    act(() => result.current.table.toggleAllRowsSelected(true));

    expect(onRowSelectionChange).toHaveBeenCalledTimes(1);
    expect(result.current.table.store.state.rowSelection).toEqual({ '1': true, '2': true, '3': true });
  });
});

describe('expanded atom (dual-mode)', () => {
  test('internal mode: expanding a tree row updates the row model and fires the callback once (StrictMode)', () => {
    const onExpandedChange = vi.fn();
    const { result } = setupHook({
      data: treeData,
      getSubRows: (row) => row.children,
      onExpandedChange,
    });

    expect(result.current.table.getRowModel().rows).toHaveLength(2);

    act(() => result.current.table.getRow('parent', true).toggleExpanded());

    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect(onExpandedChange).toHaveBeenCalledWith({ parent: true });
    // The expanded row model now includes the child row.
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual(['parent', 'child', 'solo']);
  });

  test('controlled mode: a consumer that ignores the callback vetoes expansion', () => {
    const onExpandedChange = vi.fn();
    const { result } = setupHook({
      data: treeData,
      getSubRows: (row) => row.children,
      expanded: {},
      onExpandedChange,
    });

    act(() => result.current.table.getRow('parent', true).toggleExpanded());

    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect(result.current.table.getRowModel().rows).toHaveLength(2);
  });

  test('defaultExpanded=true expands everything in internal mode', () => {
    const { result } = setupHook({
      data: treeData,
      getSubRows: (row) => row.children,
      defaultExpanded: true,
    });
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual(['parent', 'child', 'solo']);
  });
});

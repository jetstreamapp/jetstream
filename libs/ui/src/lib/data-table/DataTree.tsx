/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExpandedState } from '@tanstack/react-table';
import { forwardRef, useMemo } from 'react';
import { DataTableProps, useMappedV2Props } from './DataTable';
import { DataTableV2 } from './grid/DataTableV2';
import { DataTableRef, RowWithKey } from './grid/grid-types';

/**
 * Public tree/grouped data table. Bridges the legacy `groupBy` / `expandedGroupIds` (Set of group
 * values) API to the new grid's TanStack grouping + expanded state.
 */
export interface DataTreeProps<T extends object = RowWithKey, TContext = Record<string, any>> extends DataTableProps<T, TContext> {
  groupBy: readonly (keyof T)[];
  /** Accepted for API compatibility; the grid groups internally so this is not used. */
  rowGrouper?: (rows: readonly T[], columnKey: keyof T) => Record<string, readonly T[]>;
  expandedGroupIds?: ReadonlySet<unknown>;
  onExpandedGroupIdsChange?: (expandedGroupIds: Set<unknown>) => void;
}

function DataTreeInner<T extends object = RowWithKey>(props: DataTreeProps<T>, ref: React.Ref<DataTableRef<T>>) {
  const { groupBy, expandedGroupIds, onExpandedGroupIdsChange, rowGrouper, ...rest } = props;
  // Callers commonly pass an inline `groupBy` array. Key on its contents so a new array identity with the same
  // columns does not rebuild the table's grouping state (which re-publishes the sorted rows to consumers and can loop).
  const groupingKey = groupBy.map((key) => String(key)).join('\u001f');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- groupingKey is the content-derived key for groupBy
  const grouping = useMemo(() => groupBy.map((key) => String(key)), [groupingKey]);
  const groupColumnId = grouping[0];

  // Bridge: a group row's TanStack id is `${columnId}:${groupingValue}` for single-level grouping.
  const expanded = useMemo<ExpandedState | undefined>(() => {
    if (!expandedGroupIds) {
      return undefined;
    }
    const state: Record<string, boolean> = {};
    expandedGroupIds.forEach((value) => (state[`${groupColumnId}:${value}`] = true));
    return state;
  }, [expandedGroupIds, groupColumnId]);

  const onExpandedChange = useMemo(() => {
    if (!onExpandedGroupIdsChange) {
      return undefined;
    }
    return (state: ExpandedState) => {
      if (state === true) {
        return;
      }
      const prefix = `${groupColumnId}:`;
      const next = new Set<unknown>(
        Object.keys(state)
          .filter((key) => state[key])
          .map((key) => (key.startsWith(prefix) ? key.slice(prefix.length) : key)),
      );
      onExpandedGroupIdsChange(next);
    };
  }, [onExpandedGroupIdsChange, groupColumnId]);

  const mapped = useMappedV2Props(rest as DataTableProps<T>);
  return (
    <DataTableV2<T> {...mapped} grouping={grouping} expanded={expanded} onExpandedChange={onExpandedChange} ref={ref} role="treegrid" />
  );
}

export const DataTree = forwardRef(DataTreeInner) as unknown as <T extends object = RowWithKey>(
  props: DataTreeProps<T> & { ref?: React.Ref<DataTableRef<T>> },
) => React.ReactElement;

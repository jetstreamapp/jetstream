import {
  cellSelectionFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';

/**
 * Every TanStack feature any Jetstream grid can use — all tables flow through the single
 * `useJetstreamTable` hook, so this is the one place features are registered (tree-shaking: only
 * what is listed here is bundled).
 *
 * Non-obvious registrations:
 * - `columnVisibilityFeature` is required even though Jetstream never hides columns — it owns
 *   `table.getVisibleLeafColumns()` and `row.getVisibleCells()`.
 * - Grouped/expanded row models are registered unconditionally: they early-return when their state
 *   is empty, so flat tables stay lean without the v8-era conditional `getGroupedRowModel()` spread.
 * - `sortFns` must contain exactly the functions `'auto'` sort resolution can request
 *   (text/alphanumeric/datetime); unregistered names silently degrade to the basic sort.
 * - No `filterFns` registry: every Jetstream column carries a direct function `filterFn`, and the
 *   global filter is a function ref — string-name lookup never happens.
 */
export const jetstreamTableFeatures = tableFeatures({
  cellSelectionFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
});

export type JetstreamTableFeatures = typeof jetstreamTableFeatures;

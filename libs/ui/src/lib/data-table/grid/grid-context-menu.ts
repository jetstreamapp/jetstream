import { ContextMenuItem } from '@jetstream/types';
import { TABLE_CONTEXT_MENU_ITEMS } from './grid-constants';
import { ContextMenuActionData, ContextMenuItems } from './grid-types';

/**
 * The right-click menu's grid-owned pieces: the sentinel action values the grid dispatches itself, and
 * the pure item-resolution rules. `GridContainer` owns the interaction; this owns what ends up in the list.
 */

/** Sentinel values for actions the grid implements itself (never routed to a `contextMenuAction`). */
export const COPY_RANGE_ACTION = '__COPY_RANGE__';
export const COPY_RANGE_WITH_HEADER_ACTION = '__COPY_RANGE_WITH_HEADER__';
export const COPY_GROUP_ACTION = '__COPY_GROUP__';
export const COPY_GROUP_WITH_HEADER_ACTION = '__COPY_GROUP_WITH_HEADER__';
export const PASTE_RANGE_ACTION = '__PASTE_RANGE__';
export const REVERT_RANGE_ACTION = '__REVERT_RANGE__';

/** Grid-owned actions on a group header row: the group's own data rows, with or without a header line.
 * Consumer items never appear here — their `ContextMenuActionData` is leaf-row-scoped. */
export const GROUP_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  { label: 'Copy rows in group', value: COPY_GROUP_ACTION },
  { label: 'Copy rows in group with header', value: COPY_GROUP_WITH_HEADER_ACTION },
];

/** Item values the grid dispatches itself when it owns the menu (i.e. the table supplied no items). */
export const GRID_OWNED_COPY_ACTIONS = new Set<unknown>(TABLE_CONTEXT_MENU_ITEMS.map(({ value }) => value));

/** Context-menu actions that operate on a column/table (no specific row) — the subset offered when
 * right-clicking a column HEADER. Matches the `ContextAction` values used by the standard
 * TABLE_CONTEXT_MENU_ITEMS; items outside this set are cell-scoped and excluded. */
const COLUMN_SCOPED_CONTEXT_ACTIONS = new Set<unknown>([
  'COPY_COL',
  'COPY_COL_JSON',
  'COPY_COL_NO_HEADER',
  'COPY_TABLE',
  'COPY_TABLE_JSON',
  'COPY_TABLE_CSV',
]);

/**
 * The items to show when a column HEADER is right-clicked.
 *
 * A per-cell builder is evaluated against the header's own action data (anchored on the first data row)
 * so builder-driven tables get a header menu too; the column-scoped filter then drops whatever items it
 * produced for that row specifically. Builders read the row they are handed, so one is only called when
 * the table actually has a row to give it.
 */
export function resolveHeaderContextMenuItems<TRow extends object>(
  items: ContextMenuItems<TRow>,
  actionData: ContextMenuActionData<TRow> | null,
): ContextMenuItem[] {
  if (typeof items !== 'function') {
    return items.filter((item) => COLUMN_SCOPED_CONTEXT_ACTIONS.has(item.value));
  }
  if (!actionData || actionData.rowIdx < 0) {
    return [];
  }
  return items(actionData).filter((item) => COLUMN_SCOPED_CONTEXT_ACTIONS.has(item.value));
}

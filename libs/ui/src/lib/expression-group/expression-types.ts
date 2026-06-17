export interface DraggableRow {
  rowKey: number;
  groupKey?: number;
}

/**
 * Data attached to expression drop targets, read in the DragDropProvider onDragEnd handler.
 * A `group` target moves the row into that group; a `root` target moves it out to the top level.
 */
export type RowDropTarget = { type: 'group'; groupKey: number } | { type: 'root' };

/** @dnd-kit collisionPriority — a nested group drop zone must win over the outer root drop zone. */
export const ROW_DROP_PRIORITY_GROUP = 3;
export const ROW_DROP_PRIORITY_ROOT = 1;

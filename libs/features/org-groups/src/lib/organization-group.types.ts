export interface DraggableSfdcCard {
  uniqueId: string;
  organizationId: string | null;
}

/**
 * Data attached to org-group drop targets, read in the DragDropProvider onDragEnd handler.
 * `add` targets carry the destination group id; `remove` targets clear the org's group.
 */
export type SfdcCardDropTarget = { action: 'add'; orgGroupId: string } | { action: 'remove' };

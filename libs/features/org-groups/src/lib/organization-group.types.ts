export interface DraggableSfdcCard {
  uniqueId: string;
  organizationId: string | null;
  /** Announced to screen readers in place of the uniqueId while the card is dragged */
  label: string;
}

/** Drop-target label for the card that holds orgs outside any group */
export const UNASSIGNED_ORGS_DROP_LABEL = 'Orgs without a group';

/**
 * Data attached to org-group drop targets, read in the DragDropProvider onDragEnd handler.
 * `add` targets carry the destination group id; `remove` targets clear the org's group.
 * `label` is announced to screen readers in place of the droppable id.
 */
export type SfdcCardDropTarget = ({ action: 'add'; orgGroupId: string } | { action: 'remove' }) & { label: string };

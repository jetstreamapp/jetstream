import { Accessibility, type DragDropManagerInput, defaultPreset } from '@dnd-kit/dom';
import type { DragOverEvent, DragStartEvent } from '@dnd-kit/react';
import { DraggableSfdcCard, SfdcCardDropTarget } from './organization-group.types';

type AccessibilityOptions = NonNullable<ConstructorParameters<typeof Accessibility>[1]>;
type DragAnnouncements = NonNullable<AccessibilityOptions['announcements']>;

type DragSource = DragStartEvent['operation']['source'];
type DropTarget = DragOverEvent['operation']['target'];

function getSourceLabel(source: DragSource) {
  return (source?.data as DraggableSfdcCard | undefined)?.label || 'Salesforce org';
}

function getTargetLabel(target: DropTarget) {
  return (target?.data as SfdcCardDropTarget | undefined)?.label || 'group';
}

/**
 * dnd-kit's default announcements interpolate the draggable and droppable ids, which are UUIDs on this page,
 * so a screen reader user heard "Picked up draggable item 3f2a…". These resolve to the org label and the group
 * name that the cards carry in their drag/drop `data`.
 */
export const ORG_GROUP_DRAG_ANNOUNCEMENTS: DragAnnouncements = {
  dragstart: ({ operation: { source } }) => {
    if (!source) {
      return undefined;
    }
    return `Picked up ${getSourceLabel(source)}.`;
  },
  dragover: ({ operation: { source, target } }) => {
    if (!source) {
      return undefined;
    }
    if (!target) {
      return `${getSourceLabel(source)} is not over a group.`;
    }
    return `${getSourceLabel(source)} is over ${getTargetLabel(target)}.`;
  },
  dragend: ({ operation: { source, target }, canceled }) => {
    if (!source) {
      return undefined;
    }
    const sourceLabel = getSourceLabel(source);
    if (canceled) {
      return `Move cancelled. ${sourceLabel} was not moved.`;
    }
    if (!target) {
      return `${sourceLabel} was dropped outside a group and was not moved.`;
    }
    return `${sourceLabel} was moved to ${getTargetLabel(target)}.`;
  },
};

/** Read (via aria-describedby) when a drag handle receives focus */
export const ORG_GROUP_DRAG_INSTRUCTIONS = {
  draggable:
    'To move this org to another group, press Space or Enter to pick it up, use the arrow keys to move it over the destination group, then press Space or Enter to drop it. Press Escape to cancel.',
} satisfies AccessibilityOptions['screenReaderInstructions'];

/**
 * dnd-kit's default plugin set with its Accessibility plugin configured for this page.
 * Module-level so DragDropProvider, which compares the list by reference, never re-installs the plugins.
 * (Annotated because the inferred type reaches into @dnd-kit/abstract, which this repo does not depend on directly.)
 */
export const ORG_GROUP_DRAG_PLUGINS: NonNullable<DragDropManagerInput['plugins']> = [
  Accessibility.configure({
    announcements: ORG_GROUP_DRAG_ANNOUNCEMENTS,
    screenReaderInstructions: ORG_GROUP_DRAG_INSTRUCTIONS,
  } satisfies AccessibilityOptions),
  ...defaultPreset.plugins.filter((plugin) => plugin !== Accessibility),
];

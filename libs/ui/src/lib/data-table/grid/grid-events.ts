import type { SyntheticEvent } from 'react';

/**
 * React bubbles synthetic events through portals along the component tree, not the DOM tree. A popover opened from
 * a cell (e.g. the record lookup popover) is portaled to the body, yet its clicks, double-clicks and right-clicks
 * still reach the cell's handlers. Those interactions belong to the popover, so grid handlers should ignore them.
 */
export function isEventFromPortal(event: SyntheticEvent): boolean {
  return !event.currentTarget.contains(event.target as Node);
}

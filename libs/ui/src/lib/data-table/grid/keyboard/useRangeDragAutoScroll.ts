import { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveCell } from '../components/GridRow';
import { computeEdgeScrollVelocity, createEdgeAutoScroller, EdgeScrollBox } from '../grid-auto-scroll';
import { HEADER_ROW_ID, isSummaryRowId } from '../grid-constants';

export interface UseRangeDragAutoScrollOptions {
  /** The `.jgrid-scroller` element — it owns BOTH the vertical and horizontal scroll. */
  getScrollElement: () => HTMLElement | null;
  /** The `.jgrid` root. Hit-test results belonging to a different grid (a portaled overlay, a nested
   * grid) are ignored — their foreign row ids would make the whole selection rectangle unresolvable. */
  getRootElement: () => HTMLElement | null;
  /** Width (px) of the sticky-left frozen band at the START of the grid. It overlays the scroller's
   * left edge, so both the ramp and the hit test begin after it: a band wider than the ramp would
   * swallow it, and a hit landing on the band resolves to a far-left column — snapping the rectangle's
   * edge there and selecting every column in between, when what the pointer is actually reaching for is
   * the scrolled-away content underneath. */
  getLeftInset: () => number;
  /** The current focus corner — used to skip extends that wouldn't change anything (one render each). */
  getActiveCell: () => ActiveCell | null;
  /** Extend the active selection range to the cell resolved under the pointer. */
  onExtendToCell: (rowId: string, columnId: string) => void;
  /** The pointer was released (or the window lost focus) — the caller clears its own drag state. */
  onDragEnd: () => void;
  /** Test seam: jsdom does not implement `document.elementFromPoint`. */
  hitTest?: (clientX: number, clientY: number) => Element | null;
}

export interface RangeDragAutoScroll {
  /** Begin pointer tracking + edge auto-scrolling for a range drag. Idempotent. */
  start: () => void;
  /** Detach listeners and cancel any in-flight frame. Idempotent. */
  stop: () => void;
}

const defaultHitTest = (clientX: number, clientY: number): Element | null => document.elementFromPoint?.(clientX, clientY) ?? null;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * The drag lifecycle, built once per grid and driven through `getOptions` (which always resolves to the
 * latest render's callbacks). Kept outside the component body so the listeners have stable identities
 * without a web of `useCallback`s.
 */
function createRangeDragAutoScroller(getOptions: () => UseRangeDragAutoScrollOptions): RangeDragAutoScroll {
  let isActive = false;
  let pointer: { x: number; y: number } | null = null;
  let pointerMoved = false;

  /** The content viewport the pointer is measured against, with the sticky overlays subtracted. */
  const getScrollBox = (element: HTMLElement): EdgeScrollBox => {
    const { getRootElement, getLeftInset } = getOptions();
    const rect = element.getBoundingClientRect();
    const headerRect = getRootElement()?.querySelector('.jgrid-header')?.getBoundingClientRect();
    return {
      top: headerRect ? headerRect.bottom : rect.top,
      left: rect.left + getLeftInset(),
      // clientWidth/clientHeight rather than the rect, so a classic (non-overlay) scrollbar track —
      // which the pointer can never hover — doesn't sit inside the ramp.
      right: rect.left + element.clientWidth,
      bottom: rect.top + element.clientHeight,
    };
  };

  /**
   * The hit landed on (or behind) the sticky-left band, so it names a column the drag isn't reaching
   * for. Walk right through the same row to the first cell the band isn't covering. Resolving this
   * geometrically rather than trusting the hit point's clamp matters with a wide pinned band: a
   * sub-pixel column boundary can still return a pinned cell, and the drag would then scroll without
   * ever selecting anything (nothing under the pointer is a legal target).
   */
  const resolveUncoveredCell = (cellEl: Element, box: EdgeScrollBox): Element | null => {
    if (cellEl.getBoundingClientRect().left >= box.left - 0.5) {
      return cellEl;
    }
    const siblings = cellEl.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-row-id][data-col-id]') ?? [];
    for (const sibling of siblings) {
      if (sibling.getBoundingClientRect().left >= box.left - 0.5) {
        return sibling;
      }
    }
    return null;
  };

  /** Resolve the cell under the pointer and extend to it, skipping redundant and invalid targets. */
  const extendToPointerCell = (element: HTMLElement, box: EdgeScrollBox) => {
    const { getRootElement, getActiveCell, onExtendToCell, hitTest = defaultHitTest } = getOptions();
    const root = getRootElement();
    if (!pointer || !root) {
      return;
    }
    const rect = element.getBoundingClientRect();
    // Clamp into the region a range can actually cover: below the sticky header and to the right of the
    // sticky-left band (see the hook doc), and inside the scroller on both axes. Pushing past the band
    // is what makes a leftward drag march column by column instead of jumping to the first column.
    const hitX = clamp(clamp(pointer.x, box.left + 1, rect.left + element.clientWidth - 1), 0, window.innerWidth - 1);
    const hitY = clamp(clamp(pointer.y, box.top + 1, rect.top + element.clientHeight - 1), 0, window.innerHeight - 1);
    const hitEl = hitTest(hitX, hitY)?.closest('[data-row-id][data-col-id]');
    if (!hitEl || hitEl.closest('.jgrid') !== root) {
      return;
    }
    const cellEl = resolveUncoveredCell(hitEl, box);
    if (!cellEl) {
      return;
    }
    const rowId = cellEl.getAttribute('data-row-id');
    const columnId = cellEl.getAttribute('data-col-id');
    if (!rowId || !columnId || rowId === HEADER_ROW_ID || isSummaryRowId(rowId)) {
      return;
    }
    const activeCell = getActiveCell();
    if (activeCell?.rowId === rowId && activeCell.columnId === columnId) {
      return;
    }
    onExtendToCell(rowId, columnId);
  };

  const scroller = createEdgeAutoScroller({
    getScrollElement: () => getOptions().getScrollElement(),
    onFrame: (applied) => {
      const element = getOptions().getScrollElement();
      if (!element) {
        return;
      }
      // Nothing moved and the pointer is where it was — the cell under it can't have changed.
      if (applied.x === 0 && applied.y === 0 && !pointerMoved) {
        return;
      }
      pointerMoved = false;
      extendToPointerCell(element, getScrollBox(element));
    },
  });

  const stop = () => {
    if (!isActive) {
      return;
    }
    isActive = false;
    pointer = null;
    pointerMoved = false;
    scroller.stop();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('blur', handleWindowBlur);
  };

  function handleMouseMove(event: MouseEvent) {
    // A `mouseup` over browser chrome or an OS menu never reaches us, but the released button does.
    if (event.buttons === 0) {
      stop();
      getOptions().onDragEnd();
      return;
    }
    const element = getOptions().getScrollElement();
    if (!element) {
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    pointerMoved = true;
    const box = getScrollBox(element);
    scroller.setVelocity(computeEdgeScrollVelocity({ box, clientX: event.clientX, clientY: event.clientY }));
  }

  function handleWindowBlur() {
    stop();
    getOptions().onDragEnd();
  }

  return {
    start() {
      if (isActive) {
        return;
      }
      isActive = true;
      pointer = null;
      pointerMoved = false;
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('blur', handleWindowBlur);
    },
    stop,
  };
}

/**
 * Edge auto-scroll for mouse range drag-selection.
 *
 * Cell-range extension is normally driven by each cell's `onMouseEnter`, which stops working the moment
 * the cursor leaves the scroll viewport — there are no more cells under it. While a drag is active this
 * hook tracks the pointer on `window`, scrolls the container when the pointer nears (or passes) an edge,
 * and after each frame's scroll resolves whichever cell has moved under the pointer and extends to it.
 * Nothing is listening or looping while no drag is in progress.
 *
 * The hit point is clamped into the region a selection rectangle can actually cover, which is what keeps
 * this path in agreement with `onMouseEnter` (neither the header nor the action/select columns have a
 * meaningful hover target). Both clamps are load-bearing:
 *  - Above: a header/summary sentinel row id as the focus corner makes `getCellSelectionBounds()` drop
 *    the range entirely (unresolvable corners are omitted, not clamped) — the selection would vanish.
 *  - Left: the sticky-left frozen band covers the scrolled-away columns the drag is reaching for, so
 *    resolving onto it snaps the rectangle's left edge to a far-left column and selects everything in
 *    between.
 */
export function useRangeDragAutoScroll(options: UseRangeDragAutoScrollOptions): RangeDragAutoScroll {
  // Live mirror so the drag controller (built once) always reads the current callbacks.
  const optionsRef = useRef(options);
  // eslint-disable-next-line react-hooks/refs
  optionsRef.current = options;
  const getOptions = useCallback(() => optionsRef.current, []);

  // False positive: the initializer only stores `getOptions` on closures that run from event handlers
  // and rAF frames — nothing reads the ref during render.
  // eslint-disable-next-line react-hooks/refs
  const [autoScroll] = useState(() => createRangeDragAutoScroller(getOptions));

  // Never leave a rAF loop or a window listener behind if the grid unmounts mid-drag.
  useEffect(() => autoScroll.stop, [autoScroll]);

  return autoScroll;
}

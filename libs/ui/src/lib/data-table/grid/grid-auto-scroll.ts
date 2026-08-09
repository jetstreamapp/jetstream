/**
 * Edge auto-scroll primitives shared by the grid's drag interactions (range drag-select, column
 * reorder): a pure velocity ramp plus a single time-based rAF loop that applies it to a scroll
 * container.
 *
 * Velocity is expressed in px/SECOND and applied against the real frame delta, so the scroll speed is
 * identical on a 60Hz and a 120Hz display (a fixed px-per-frame step scrolls twice as fast on
 * ProMotion hardware).
 */

/** Ramp width (px) measured inward from each edge of the content viewport. */
export const DEFAULT_EDGE_SIZE = 48;
/** Speed (px/sec) reached at — and beyond — the outer edge of the ramp (≈32 rows/sec at the default row height). */
export const DEFAULT_MAX_SPEED = 900;
/** Frame deltas are clamped to this so a tab-switch/GC pause can't scroll the grid in one giant jump. */
const MAX_FRAME_SECONDS = 0.05;

/**
 * The client-coordinate box the pointer is measured against — the scroll container's CONTENT viewport.
 * Callers exclude scrollbar tracks (via clientWidth/clientHeight) and any sticky overlay that would
 * otherwise swallow the whole ramp (the grid's sticky header block, the frozen column band).
 */
export interface EdgeScrollBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface EdgeScrollVelocityOptions {
  box: EdgeScrollBox;
  clientX: number;
  clientY: number;
  edgeSize?: number;
  maxSpeed?: number;
}

/** Linear 0→maxSpeed ramp over the last `edgeSize` px before `edgeStart`, clamped past the edge. */
function axisVelocity(position: number, start: number, end: number, edgeSize: number, maxSpeed: number): number {
  const size = end - start;
  if (size <= 0) {
    return 0;
  }
  // Never let opposing ramps overlap in a box narrower than two full ramps — each takes half.
  const ramp = Math.min(edgeSize, size / 2);
  if (ramp <= 0) {
    return 0;
  }
  const distanceFromStart = position - start;
  if (distanceFromStart < ramp) {
    return -maxSpeed * Math.min(1, (ramp - distanceFromStart) / ramp);
  }
  const distanceFromEnd = end - position;
  if (distanceFromEnd < ramp) {
    return maxSpeed * Math.min(1, (ramp - distanceFromEnd) / ramp);
  }
  return 0;
}

/**
 * Scroll velocity (px/sec, positive = right/down) for a pointer measured against `box`: zero in the
 * middle, ramping linearly to `maxSpeed` at the edge and staying pinned there once the pointer is
 * outside the box entirely.
 */
export function computeEdgeScrollVelocity({
  box,
  clientX,
  clientY,
  edgeSize = DEFAULT_EDGE_SIZE,
  maxSpeed = DEFAULT_MAX_SPEED,
}: EdgeScrollVelocityOptions): { x: number; y: number } {
  return {
    x: axisVelocity(clientX, box.left, box.right, edgeSize, maxSpeed),
    y: axisVelocity(clientY, box.top, box.bottom, edgeSize, maxSpeed),
  };
}

/** Injectable clock/scheduler — the loop uses rAF + performance.now() unless a test supplies its own. */
export interface AutoScrollScheduler {
  now: () => number;
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

export interface EdgeAutoScrollerOptions {
  getScrollElement: () => HTMLElement | null;
  /** Fired after each frame's write with the px actually applied per axis (0 when clamped at either end). */
  onFrame?: (applied: { x: number; y: number }) => void;
  scheduler?: AutoScrollScheduler;
}

export interface EdgeAutoScroller {
  /** px/sec. A non-zero velocity starts the loop; `{ x: 0, y: 0 }` cancels the pending frame. */
  setVelocity: (velocity: { x: number; y: number }) => void;
  stop: () => void;
}

const defaultScheduler: AutoScrollScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * A single rAF loop that scrolls an element at a settable velocity.
 *
 * Sub-pixel movement is accumulated in a carry rather than truncated, so slow ramp velocities still
 * scroll (assigning a fractional delta to `scrollTop` rounds away in some engines). The loop keeps
 * running while the velocity is non-zero even once the element is clamped at 0 or at its maximum —
 * the pointer may move back toward the middle, and `onFrame` reports the zero movement so callers can
 * skip per-frame work.
 */
export function createEdgeAutoScroller({
  getScrollElement,
  onFrame,
  scheduler = defaultScheduler,
}: EdgeAutoScrollerOptions): EdgeAutoScroller {
  let frameHandle: number | null = null;
  let lastFrameTime = 0;
  let velocity = { x: 0, y: 0 };
  let carryX = 0;
  let carryY = 0;

  const cancelFrame = () => {
    if (frameHandle !== null) {
      scheduler.cancel(frameHandle);
      frameHandle = null;
    }
  };

  const runFrame = () => {
    frameHandle = null;
    const element = getScrollElement();
    if (!element || (velocity.x === 0 && velocity.y === 0)) {
      return;
    }
    const now = scheduler.now();
    const deltaSeconds = Math.min((now - lastFrameTime) / 1000, MAX_FRAME_SECONDS);
    lastFrameTime = now;

    carryX += velocity.x * deltaSeconds;
    carryY += velocity.y * deltaSeconds;
    const stepX = Math.trunc(carryX);
    const stepY = Math.trunc(carryY);
    carryX -= stepX;
    carryY -= stepY;

    const beforeLeft = element.scrollLeft;
    const beforeTop = element.scrollTop;
    if (stepX !== 0) {
      element.scrollLeft = beforeLeft + stepX;
    }
    if (stepY !== 0) {
      element.scrollTop = beforeTop + stepY;
    }
    // Schedule before notifying so an `onFrame` callback that calls `stop()` cancels the next frame
    // instead of being overwritten by it.
    frameHandle = scheduler.request(runFrame);
    onFrame?.({ x: element.scrollLeft - beforeLeft, y: element.scrollTop - beforeTop });
  };

  return {
    setVelocity(next) {
      velocity = next;
      if (next.x === 0 && next.y === 0) {
        cancelFrame();
        carryX = 0;
        carryY = 0;
        return;
      }
      if (frameHandle === null) {
        lastFrameTime = scheduler.now();
        frameHandle = scheduler.request(runFrame);
      }
    },
    stop() {
      cancelFrame();
      velocity = { x: 0, y: 0 };
      carryX = 0;
      carryY = 0;
    },
  };
}

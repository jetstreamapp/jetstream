import { describe, expect, test, vi } from 'vitest';
import {
  AutoScrollScheduler,
  computeEdgeScrollVelocity,
  createEdgeAutoScroller,
  DEFAULT_EDGE_SIZE,
  DEFAULT_MAX_SPEED,
  EdgeScrollBox,
} from '../grid-auto-scroll';

const box: EdgeScrollBox = { top: 100, right: 900, bottom: 500, left: 100 };

describe('computeEdgeScrollVelocity', () => {
  test('is idle in the middle of the box', () => {
    expect(computeEdgeScrollVelocity({ box, clientX: 500, clientY: 300 })).toEqual({ x: 0, y: 0 });
  });

  test('ramps linearly from the edge inward', () => {
    // Half of the ramp width in from the bottom edge → half speed.
    const halfway = computeEdgeScrollVelocity({ box, clientX: 500, clientY: box.bottom - DEFAULT_EDGE_SIZE / 2 });
    expect(halfway.y).toBeCloseTo(DEFAULT_MAX_SPEED / 2);
    expect(halfway.x).toBe(0);
  });

  test('clamps at max speed once the pointer is outside the box', () => {
    expect(computeEdgeScrollVelocity({ box, clientX: 500, clientY: box.bottom + 5000 }).y).toBe(DEFAULT_MAX_SPEED);
    expect(computeEdgeScrollVelocity({ box, clientX: box.right + 5000, clientY: 300 }).x).toBe(DEFAULT_MAX_SPEED);
  });

  test('scrolls back toward the origin above/left of the box', () => {
    expect(computeEdgeScrollVelocity({ box, clientX: 500, clientY: box.top - 20 }).y).toBe(-DEFAULT_MAX_SPEED);
    expect(computeEdgeScrollVelocity({ box, clientX: box.left - 20, clientY: 300 }).x).toBe(-DEFAULT_MAX_SPEED);
  });

  test('drives both axes in the corners', () => {
    const corner = computeEdgeScrollVelocity({ box, clientX: box.right - 1, clientY: box.bottom - 1 });
    expect(corner.x).toBeGreaterThan(0);
    expect(corner.y).toBeGreaterThan(0);
  });

  test('splits a box narrower than two ramps so the opposing ramps never overlap', () => {
    // A 40px-tall box with a 48px ramp: each half owns 20px, so the exact centre is still idle.
    const narrow: EdgeScrollBox = { top: 0, right: 1000, bottom: 40, left: 0 };
    expect(computeEdgeScrollVelocity({ box: narrow, clientX: 500, clientY: 20 }).y).toBe(0);
    expect(computeEdgeScrollVelocity({ box: narrow, clientX: 500, clientY: 35 }).y).toBeGreaterThan(0);
    expect(computeEdgeScrollVelocity({ box: narrow, clientX: 500, clientY: 5 }).y).toBeLessThan(0);
  });

  test('is idle for a degenerate (zero-size) box', () => {
    expect(computeEdgeScrollVelocity({ box: { top: 0, right: 0, bottom: 0, left: 0 }, clientX: 0, clientY: 0 })).toEqual({ x: 0, y: 0 });
  });
});

/** rAF/clock stand-in: frames only advance when the test says so, each by `frameMs`. */
function createTestScheduler() {
  let time = 0;
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  const scheduler: AutoScrollScheduler = {
    now: () => time,
    request: vi.fn((callback: () => void) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    }),
    cancel: vi.fn((handle: number) => {
      pending.delete(handle);
    }),
  };
  return {
    scheduler,
    /** Run every queued frame, advancing the clock by `frameMs` first (mirrors rAF's timestamp). */
    advanceFrames(count: number, frameMs: number) {
      for (let index = 0; index < count; index++) {
        const callbacks = Array.from(pending.values());
        pending.clear();
        time += frameMs;
        callbacks.forEach((callback) => callback());
      }
    },
    hasPendingFrame: () => pending.size > 0,
  };
}

describe('createEdgeAutoScroller', () => {
  test('scrolls at the requested px/sec regardless of frame rate', () => {
    const element = document.createElement('div');
    const slow = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => element, scheduler: slow.scheduler }).setVelocity({ x: 0, y: 1000 });
    slow.advanceFrames(3, 16);
    expect(element.scrollTop).toBe(48);

    // The same elapsed time at 120Hz must cover the same distance — a fixed px-per-frame step doubles it.
    const element120 = document.createElement('div');
    const fast = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => element120, scheduler: fast.scheduler }).setVelocity({ x: 0, y: 1000 });
    fast.advanceFrames(6, 8);
    expect(element120.scrollTop).toBe(48);
  });

  test('accumulates sub-pixel movement instead of truncating it away', () => {
    const element = document.createElement('div');
    const { scheduler, advanceFrames } = createTestScheduler();
    // 32px/sec over a 16ms frame is ~0.5px — a naive `scrollTop += 0.5` would never move at all.
    createEdgeAutoScroller({ getScrollElement: () => element, scheduler }).setVelocity({ x: 0, y: 32 });
    advanceFrames(1, 16);
    expect(element.scrollTop).toBe(0);
    advanceFrames(1, 16);
    expect(element.scrollTop).toBe(1);
  });

  test('clamps a long frame gap so a background tab does not jump the scroll position', () => {
    const element = document.createElement('div');
    const { scheduler, advanceFrames } = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => element, scheduler }).setVelocity({ x: 0, y: 900 });
    advanceFrames(1, 2000);
    // 900px/sec × the 0.05s cap, not × the 2s that actually elapsed.
    expect(element.scrollTop).toBe(45);
  });

  test('scrolls horizontally and negatively', () => {
    const element = document.createElement('div');
    element.scrollLeft = 500;
    const { scheduler, advanceFrames } = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => element, scheduler }).setVelocity({ x: -1000, y: 0 });
    advanceFrames(3, 16);
    expect(element.scrollLeft).toBe(452);
  });

  test('reports the px actually applied to onFrame', () => {
    const element = document.createElement('div');
    const onFrame = vi.fn();
    const { scheduler, advanceFrames } = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => element, onFrame, scheduler }).setVelocity({ x: 0, y: 1000 });
    advanceFrames(1, 16);
    expect(onFrame).toHaveBeenCalledWith({ x: 0, y: 16 });
  });

  test('a zero velocity and stop() both cancel the pending frame', () => {
    const element = document.createElement('div');
    const { scheduler, advanceFrames, hasPendingFrame } = createTestScheduler();
    const scroller = createEdgeAutoScroller({ getScrollElement: () => element, scheduler });

    scroller.setVelocity({ x: 0, y: 600 });
    expect(hasPendingFrame()).toBe(true);
    scroller.setVelocity({ x: 0, y: 0 });
    expect(hasPendingFrame()).toBe(false);

    scroller.setVelocity({ x: 0, y: 600 });
    advanceFrames(1, 16);
    const scrolled = element.scrollTop;
    scroller.stop();
    advanceFrames(2, 16);
    expect(element.scrollTop).toBe(scrolled);
  });

  test('stops quietly when the scroll element goes away', () => {
    const { scheduler, advanceFrames, hasPendingFrame } = createTestScheduler();
    createEdgeAutoScroller({ getScrollElement: () => null, scheduler }).setVelocity({ x: 0, y: 600 });
    expect(() => advanceFrames(1, 1000 / 60)).not.toThrow();
    expect(hasPendingFrame()).toBe(false);
  });
});

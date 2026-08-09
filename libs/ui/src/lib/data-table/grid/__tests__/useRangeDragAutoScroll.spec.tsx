import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ActiveCell } from '../components/GridRow';
import { getSummaryRowId, HEADER_ROW_ID } from '../grid-constants';
import { useRangeDragAutoScroll, UseRangeDragAutoScrollOptions } from '../keyboard/useRangeDragAutoScroll';

const SCROLLER_RECT = { top: 100, left: 200, width: 600, height: 400 };
const HEADER_HEIGHT = 60;
const FROZEN_WIDTH = 120;

/**
 * jsdom reports 0 for every layout measurement, so the scroller's geometry is stubbed. It does keep
 * whatever number is assigned to scrollTop/scrollLeft (unclamped), which is exactly what the rAF loop
 * writes — so the scrolling itself is observable.
 */
function renderFixture(overrides: Partial<UseRangeDragAutoScrollOptions> = {}) {
  const scroller = document.createElement('div');
  scroller.className = 'jgrid-scroller';
  const root = document.createElement('div');
  root.className = 'jgrid';
  const header = document.createElement('div');
  header.className = 'jgrid-header';
  const body = document.createElement('div');
  body.className = 'jgrid-body';
  root.append(header, body);
  scroller.append(root);
  document.body.append(scroller);

  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
    ...SCROLLER_RECT,
    right: SCROLLER_RECT.left + SCROLLER_RECT.width,
    bottom: SCROLLER_RECT.top + SCROLLER_RECT.height,
  } as DOMRect);
  Object.defineProperty(scroller, 'clientWidth', { value: SCROLLER_RECT.width });
  Object.defineProperty(scroller, 'clientHeight', { value: SCROLLER_RECT.height });
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
    top: SCROLLER_RECT.top,
    bottom: SCROLLER_RECT.top + HEADER_HEIGHT,
    left: SCROLLER_RECT.left,
    right: SCROLLER_RECT.left + SCROLLER_RECT.width,
    height: HEADER_HEIGHT,
    width: SCROLLER_RECT.width,
  } as DOMRect);

  /** A cell that belongs to the fixture's grid. `left` defaults to inside the scrollable area — cells
   * positioned left of the frozen band stand in for the sticky columns overlaying it. */
  const makeCell = (rowId: string, columnId: string, container: HTMLElement = body, left = SCROLLER_RECT.left + FROZEN_WIDTH + 50) => {
    const cell = document.createElement('div');
    cell.setAttribute('data-row-id', rowId);
    cell.setAttribute('data-col-id', columnId);
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({ left, right: left + 100, top: 0, bottom: 20 } as DOMRect);
    container.append(cell);
    return cell;
  };

  const hitTest = vi.fn<(clientX: number, clientY: number) => Element | null>(() => makeCell('r5', 'Name'));
  const onExtendToCell = vi.fn();
  const onDragEnd = vi.fn();
  let activeCell: ActiveCell | null = null;

  const { result, unmount } = renderHook(() =>
    useRangeDragAutoScroll({
      getScrollElement: () => scroller,
      getRootElement: () => root,
      getLeftInset: () => FROZEN_WIDTH,
      getActiveCell: () => activeCell,
      onExtendToCell,
      onDragEnd,
      hitTest,
      ...overrides,
    }),
  );

  return {
    autoScroll: result.current,
    scroller,
    root,
    body,
    makeCell,
    hitTest,
    onExtendToCell,
    onDragEnd,
    unmount,
    setActiveCell: (cell: ActiveCell | null) => {
      activeCell = cell;
    },
  };
}

/** Dispatch a drag-in-progress pointer move (button still held). */
function moveMouseTo(clientX: number, clientY: number, buttons = 1) {
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, buttons }));
  });
}

function advanceFrames(count: number) {
  for (let index = 0; index < count; index++) {
    act(() => {
      vi.advanceTimersByTime(16);
    });
  }
}

describe('useRangeDragAutoScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('does nothing until a drag starts', () => {
    const { scroller, onExtendToCell } = renderFixture();
    moveMouseTo(400, 495);
    advanceFrames(3);

    expect(scroller.scrollTop).toBe(0);
    expect(onExtendToCell).not.toHaveBeenCalled();
  });

  test('scrolls down and extends to the cell that moves under the pointer', () => {
    const { autoScroll, scroller, onExtendToCell } = renderFixture();
    act(() => autoScroll.start());
    // 5px above the scroller's bottom edge — deep inside the ramp.
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(3);

    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(onExtendToCell).toHaveBeenCalledWith('r5', 'Name');
  });

  test('scrolls up when the pointer sits over the sticky header, hit-testing below it', () => {
    const { autoScroll, scroller, hitTest } = renderFixture();
    scroller.scrollTop = 500;
    act(() => autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + 10);
    advanceFrames(3);

    expect(scroller.scrollTop).toBeLessThan(500);
    // Load-bearing clamp: a hit on a header cell would write a sentinel row id as the range's focus
    // corner, and the whole rectangle would resolve to nothing.
    const [, hitY] = hitTest.mock.calls[hitTest.mock.calls.length - 1];
    expect(hitY).toBe(SCROLLER_RECT.top + HEADER_HEIGHT + 1);
  });

  test('scrolls left, hit-testing past the unselectable frozen band', () => {
    const { autoScroll, scroller, hitTest } = renderFixture();
    scroller.scrollLeft = 500;
    act(() => autoScroll.start());
    moveMouseTo(SCROLLER_RECT.left + 10, 300);
    advanceFrames(3);

    expect(scroller.scrollLeft).toBeLessThan(500);
    // The frozen action/select columns sit at index 0 and can never join a range — resolving onto one
    // would snap the rectangle's left edge there and select every column in between.
    const [hitX] = hitTest.mock.calls[hitTest.mock.calls.length - 1];
    expect(hitX).toBe(SCROLLER_RECT.left + FROZEN_WIDTH + 1);
  });

  test('walks past a hit that landed on the sticky-left band to the first uncovered cell', () => {
    const fixture = renderFixture();
    // One row: a pinned cell overlaying the band, then the scrollable cell the drag is reaching for.
    const row = document.createElement('div');
    fixture.body.append(row);
    const pinnedCell = fixture.makeCell('r5', 'tableLabel', row, SCROLLER_RECT.left + 10);
    fixture.makeCell('r5', 'Permission', row, SCROLLER_RECT.left + FROZEN_WIDTH);
    fixture.hitTest.mockImplementation(() => pinnedCell);

    act(() => fixture.autoScroll.start());
    moveMouseTo(SCROLLER_RECT.left + 10, 300);
    advanceFrames(3);

    // Without the walk the pinned cell would be rejected downstream and the drag would scroll forever
    // without ever selecting anything — which is what a wide pinned band (permission manager) produces.
    expect(fixture.onExtendToCell).toHaveBeenCalledWith('r5', 'Permission');
  });

  test('scrolls both axes at once in a corner', () => {
    const { autoScroll, scroller } = renderFixture();
    act(() => autoScroll.start());
    moveMouseTo(SCROLLER_RECT.left + SCROLLER_RECT.width - 2, SCROLLER_RECT.top + SCROLLER_RECT.height - 2);
    advanceFrames(3);

    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(scroller.scrollLeft).toBeGreaterThan(0);
  });

  test('stays idle while the pointer is in the middle of the grid', () => {
    const { autoScroll, scroller, onExtendToCell } = renderFixture();
    act(() => autoScroll.start());
    moveMouseTo(SCROLLER_RECT.left + 300, SCROLLER_RECT.top + 200);
    advanceFrames(3);

    expect(scroller.scrollTop).toBe(0);
    expect(onExtendToCell).not.toHaveBeenCalled();
  });

  test('never re-extends to the cell that is already the focus corner', () => {
    const { autoScroll, onExtendToCell, setActiveCell } = renderFixture();
    setActiveCell({ rowId: 'r5', columnId: 'Name' });
    act(() => autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(5);

    expect(onExtendToCell).not.toHaveBeenCalled();
  });

  test('ignores header and summary sentinel rows', () => {
    const fixture = renderFixture();
    fixture.hitTest.mockImplementation(() => fixture.makeCell(HEADER_ROW_ID, 'Name'));
    act(() => fixture.autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(2);
    expect(fixture.onExtendToCell).not.toHaveBeenCalled();

    fixture.hitTest.mockImplementation(() => fixture.makeCell(getSummaryRowId(0), 'Name'));
    advanceFrames(2);
    expect(fixture.onExtendToCell).not.toHaveBeenCalled();
  });

  test('ignores cells belonging to another grid', () => {
    const fixture = renderFixture();
    const otherGrid = document.createElement('div');
    otherGrid.className = 'jgrid';
    document.body.append(otherGrid);
    fixture.hitTest.mockImplementation(() => fixture.makeCell('r5', 'Name', otherGrid));

    act(() => fixture.autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(3);

    expect(fixture.onExtendToCell).not.toHaveBeenCalled();
  });

  test('ends the drag when the button is released outside the window', () => {
    const { autoScroll, scroller, onDragEnd } = renderFixture();
    act(() => autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(2);
    const scrolled = scroller.scrollTop;

    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5, 0);
    advanceFrames(3);

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(scroller.scrollTop).toBe(scrolled);
  });

  test('stop() detaches the pointer listener and halts the loop', () => {
    const { autoScroll, scroller } = renderFixture();
    act(() => autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(2);
    const scrolled = scroller.scrollTop;

    act(() => autoScroll.stop());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(3);

    expect(scroller.scrollTop).toBe(scrolled);
  });

  test('unmounting mid-drag cancels the loop', () => {
    const { autoScroll, scroller, unmount } = renderFixture();
    act(() => autoScroll.start());
    moveMouseTo(400, SCROLLER_RECT.top + SCROLLER_RECT.height - 5);
    advanceFrames(2);
    const scrolled = scroller.scrollTop;

    unmount();
    expect(() => advanceFrames(3)).not.toThrow();
    expect(scroller.scrollTop).toBe(scrolled);
  });
});

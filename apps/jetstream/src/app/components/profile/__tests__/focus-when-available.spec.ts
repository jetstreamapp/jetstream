import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusWhenAvailable } from '../focus-when-available';

describe('focusWhenAvailable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('focuses a target that is already rendered', () => {
    document.body.innerHTML = '<button id="target">Go</button>';
    focusWhenAvailable(() => document.getElementById('target'));
    vi.advanceTimersByTime(20);
    expect(document.activeElement?.id).toBe('target');
  });

  it('keeps looking until a target renders in a later commit', () => {
    focusWhenAvailable(() => document.getElementById('late'));
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(document.body);

    document.body.innerHTML = '<button id="late">Late</button>';
    vi.advanceTimersByTime(40);
    expect(document.activeElement?.id).toBe('late');
  });

  it('gives up instead of polling forever', () => {
    const findTarget = vi.fn(() => null);
    focusWhenAvailable(findTarget);
    vi.advanceTimersByTime(2000);
    const callsAfterGivingUp = findTarget.mock.calls.length;
    vi.advanceTimersByTime(2000);
    expect(findTarget).toHaveBeenCalledTimes(callsAfterGivingUp);
    expect(callsAfterGivingUp).toBeLessThanOrEqual(20);
  });

  it('stops when cancelled', () => {
    const findTarget = vi.fn(() => null);
    const cancel = focusWhenAvailable(findTarget);
    cancel();
    vi.advanceTimersByTime(500);
    expect(findTarget).not.toHaveBeenCalled();
  });
});

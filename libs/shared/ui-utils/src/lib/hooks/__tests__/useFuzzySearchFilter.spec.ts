import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useFuzzySearchFilter } from '../useFuzzySearchFilter';

const ITEMS = [
  { label: 'Account', value: 'Account' },
  { label: 'Contact', value: 'Contact' },
  { label: 'Opportunity', value: 'Opportunity' },
];

function getLabels(items: { label: string }[]) {
  return items.map(({ label }) => label);
}

describe('useFuzzySearchFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('debounces a filter before applying it', () => {
    const { result, rerender } = renderHook(({ filter }) => useFuzzySearchFilter(ITEMS, filter), { initialProps: { filter: '' } });

    rerender({ filter: 'Contact' });
    expect(getLabels(result.current)).toEqual(['Account', 'Contact', 'Opportunity']);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(getLabels(result.current)[0]).toBe('Contact');
    expect(result.current.length).toBeLessThan(ITEMS.length);
  });

  test('applies a cleared filter immediately', () => {
    const { result, rerender } = renderHook(({ filter }) => useFuzzySearchFilter(ITEMS, filter), {
      initialProps: { filter: 'Contact' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.length).toBeLessThan(ITEMS.length);

    rerender({ filter: '' });
    expect(getLabels(result.current)).toEqual(['Account', 'Contact', 'Opportunity']);
  });

  test('does not revive the previous filter when typing right after clearing', () => {
    const { result, rerender } = renderHook(({ filter }) => useFuzzySearchFilter(ITEMS, filter), {
      initialProps: { filter: 'Contact' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ filter: '' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    rerender({ filter: 'Opp' });
    // Unfiltered until the new text settles — never the results for the cleared 'Contact'
    expect(getLabels(result.current)).toEqual(['Account', 'Contact', 'Opportunity']);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(getLabels(result.current)[0]).toBe('Opportunity');
  });
});

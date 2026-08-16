import { act, renderHook } from '@testing-library/react';
import { ChangeEvent } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { useIntegerInput } from '../hooks/useIntegerInput';

function changeEvent(value: string) {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

describe('useIntegerInput', () => {
  test('deleting the leading digit keeps the remaining characters visible', () => {
    // Regression: `value={batchSize || ''}` turned "0000" into 0, which is falsy, which blanked the field.
    const onChange = vi.fn();
    const { result } = renderHook(() => useIntegerInput(10000, onChange));

    expect(result.current.inputValue).toBe('10000');

    act(() => result.current.handleChange(changeEvent('0000')));

    expect(result.current.inputValue).toBe('0000');
    expect(onChange).toHaveBeenCalledWith(0);
  });

  test('reports null when the field does not hold a number', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useIntegerInput(10000, onChange));

    act(() => result.current.handleChange(changeEvent('')));

    expect(result.current.inputValue).toBe('');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('normalizes the displayed value on blur', () => {
    const { result } = renderHook(() => useIntegerInput(10000, vi.fn()));

    act(() => result.current.handleChange(changeEvent('0000')));
    act(() => result.current.handleBlur());

    expect(result.current.inputValue).toBe('0');
  });

  test('adopts values changed outside the input', () => {
    const { result, rerender } = renderHook(({ value }) => useIntegerInput(value, vi.fn()), { initialProps: { value: 10000 } });

    rerender({ value: 200 });

    expect(result.current.inputValue).toBe('200');
  });

  test('does not overwrite in-progress typing when the committed value already matches', () => {
    const { result, rerender } = renderHook(({ value }) => useIntegerInput(value, vi.fn()), { initialProps: { value: 10000 } });

    act(() => result.current.handleChange(changeEvent('0000')));
    // The parent commits the parsed value back; the raw text must survive so the user can keep typing.
    rerender({ value: 0 });

    expect(result.current.inputValue).toBe('0000');
  });
});

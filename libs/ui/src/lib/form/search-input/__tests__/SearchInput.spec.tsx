import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import SearchInput from '../SearchInput';

function renderSearchInput() {
  const onArrowKeyUpDown = vi.fn();
  const result = render(<SearchInput id="filter" placeholder="Filter fields" onChange={vi.fn()} onArrowKeyUpDown={onArrowKeyUpDown} />);
  return { ...result, onArrowKeyUpDown, input: screen.getByPlaceholderText('Filter fields') as HTMLInputElement };
}

describe('SearchInput', () => {
  test('an arrow press on the input fires the hand-off once, on the key release', async () => {
    const { input, onArrowKeyUpDown, baseElement } = renderSearchInput();
    await axeScan(baseElement);
    input.focus();
    expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(false);
    expect(onArrowKeyUpDown).not.toHaveBeenCalled();
    fireEvent.keyUp(input, { key: 'ArrowDown' });
    expect(onArrowKeyUpDown).toHaveBeenCalledTimes(1);
    expect(onArrowKeyUpDown).toHaveBeenCalledWith('DOWN');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyUp(input, { key: 'ArrowUp' });
    expect(onArrowKeyUpDown).toHaveBeenLastCalledWith('UP');
  });

  test('a key release that arrives without its press (focus moved here mid-press) does not fire the hand-off', () => {
    const { input, onArrowKeyUpDown } = renderSearchInput();
    input.focus();
    fireEvent.keyUp(input, { key: 'ArrowUp' });
    fireEvent.keyUp(input, { key: 'ArrowDown' });
    expect(onArrowKeyUpDown).not.toHaveBeenCalled();
  });
});

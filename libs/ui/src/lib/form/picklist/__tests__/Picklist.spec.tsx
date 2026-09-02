import { axeScan } from '@jetstream/test-utils';
import { ListItem } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Picklist } from '../Picklist';

const items: ListItem[] = [
  { id: 'a', label: 'Alpha', value: 'a' },
  { id: 'b', label: 'Bravo', value: 'b' },
];

function renderPicklist() {
  const onChange = vi.fn();
  const result = render(<Picklist label="Letter" items={items} onChange={onChange} />);
  return { ...result, onChange, input: screen.getByRole('combobox') as HTMLInputElement };
}

describe('Picklist', () => {
  test('selecting an option with Enter closes the list and the key release does not reopen it', async () => {
    const { input, onChange, baseElement } = renderPicklist();
    input.focus();
    // The input opens on key release (its handler is bound to keyup)
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await axeScan(baseElement);

    fireEvent.keyUp(input, { key: 'ArrowDown' });
    const firstOption = screen.getAllByRole('option')[0];
    await waitFor(() => expect(document.activeElement).toBe(firstOption));

    // Enter is pressed on the option: the list handles the keydown, closes and focuses the input...
    fireEvent.keyDown(firstOption, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((item: ListItem) => item.id)).toEqual(['a']);
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.getAttribute('aria-expanded')).toBe('false');

    // ...so the browser delivers the matching keyup to the input, which must not count as "open"
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('false');

    // A fresh press on the input still opens the list
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});

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
    // Enter opens on keydown; the release of that same press must not act on the list
    fireEvent.keyDown(input, { key: 'Enter' });
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
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
  test('Enter on the closed input opens the list on keydown and never submits a wrapping form', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Picklist label="Letter" items={items} onChange={onChange} />
        <button type="submit">Save</button>
      </form>,
    );
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    // fireEvent returns false when the handler called preventDefault — the browser's implicit form
    // submission is a default action of that keydown
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a key release that arrives without its press (focus moved onto the input mid-press) does not open the list', () => {
    const { input } = renderPicklist();
    input.focus();
    fireEvent.keyUp(input, { key: 'Enter' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyUp(input, { key: ' ' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  test('a modified Enter (page-level shortcut) on the closed input is left alone', () => {
    const { input } = renderPicklist();
    input.focus();
    expect(fireEvent.keyDown(input, { key: 'Enter', metaKey: true })).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});

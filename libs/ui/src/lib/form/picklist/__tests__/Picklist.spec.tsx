import { axeScan } from '@jetstream/test-utils';
import { ListItem } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Picklist } from '../Picklist';

const ITEMS: ListItem[] = [
  { id: 'one', value: 'one', label: 'First option' },
  { id: 'two', value: 'two', label: 'Second option' },
];

const items: ListItem[] = [
  { id: 'a', label: 'Alpha', value: 'a' },
  { id: 'b', label: 'Bravo', value: 'b' },
];

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

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

  test.each([false, true])('selects an item with usePortal=%s', async (usePortal) => {
    const onChange = vi.fn();
    render(
      <Picklist
        label="Choices"
        items={ITEMS}
        selectedItemIds={['one']}
        allowDeselection={false}
        usePortal={usePortal}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Second option'));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'two' })]);
    expect(screen.queryByText('Second option')).toBeNull();
  });

  test('renders the list outside of the component when usePortal is set', async () => {
    const { container } = render(
      <Picklist label="Choices" items={ITEMS} selectedItemIds={['one']} allowDeselection={false} usePortal onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    const option = await screen.findByText('Second option');

    expect(container.contains(option)).toBe(false);
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

  test('describes the combobox with its help text', async () => {
    const { baseElement } = render(<Picklist label="Letter" items={items} helpText="Pick the first letter" onChange={vi.fn()} />);
    expect(getDescription(screen.getByRole('combobox', { name: 'Letter' }))).toBe('Pick the first letter');
    await axeScan(baseElement);
  });

  describe('usePortal', () => {
    // Stands in for a hosting modal or popover, which would close on an Escape that reaches it
    const onOuterKeyDown = vi.fn();
    beforeEach(() => {
      onOuterKeyDown.mockClear();
      document.addEventListener('keydown', onOuterKeyDown);
    });
    afterEach(() => {
      document.removeEventListener('keydown', onOuterKeyDown);
    });

    function renderPortalPicklist() {
      const result = render(<Picklist label="Letter" items={items} usePortal onChange={vi.fn()} />);
      return { ...result, input: screen.getByRole('combobox') as HTMLInputElement };
    }

    test('ArrowDown moves focus into the portaled list, and Escape closes only the list', async () => {
      const { input, container, baseElement } = renderPortalPicklist();
      input.focus();
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyUp(input, { key: 'Enter' });
      fireEvent.keyUp(input, { key: 'ArrowDown' });

      const firstOption = screen.getAllByRole('option')[0];
      expect(container.contains(firstOption)).toBe(false);
      await waitFor(() => expect(document.activeElement).toBe(firstOption));
      await axeScan(baseElement);

      fireEvent.keyDown(firstOption, { key: 'ArrowDown' });
      await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('option')[1]));

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(input);
      // The press was consumed by the list, so a hosting modal or popover never sees it
      expect(onOuterKeyDown.mock.calls.some(([event]) => (event as KeyboardEvent).key === 'Escape')).toBe(false);
    });

    test('a press on the portaled list itself (padding or scrollbar) does not count as an outside click', () => {
      const { input } = renderPortalPicklist();
      fireEvent.click(input);
      const listbox = screen.getByRole('listbox');

      fireEvent.mouseDown(listbox);
      fireEvent.mouseUp(listbox);
      expect(input.getAttribute('aria-expanded')).toBe('true');

      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(document.body);
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });
  });
});

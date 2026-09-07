import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { Combobox } from '../Combobox';
import { ComboboxListItem } from '../ComboboxListItem';
import { ComboboxWithItems } from '../ComboboxWithItems';

const NOOP = () => undefined;

function getInput(container: HTMLElement) {
  return container.querySelector('input') as HTMLInputElement;
}

function getListbox(container: HTMLElement) {
  return container.querySelector('[role="listbox"]');
}

function renderOpen(extra: Record<string, unknown>) {
  const result = render(
    <Combobox label="Orgs" onKeyboardNavigation={NOOP} {...extra}>
      <ComboboxListItem id="a" label="one" selected={false} onSelection={NOOP} />
    </Combobox>,
  );
  fireEvent.click(getInput(result.container));
  return getListbox(result.container) as HTMLElement;
}

/** Owns the selection the way every app-level wrapper does, so selecting an option closes the list */
function SelectableHarness() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  return (
    <ComboboxWithItems
      comboboxProps={{ label: 'Orgs' }}
      items={[
        { id: 'a', label: 'one', value: 'a' },
        { id: 'b', label: 'two', value: 'b' },
      ]}
      selectedItemId={selectedItemId}
      onSelected={(item) => setSelectedItemId(item.id)}
    />
  );
}

describe('Combobox dropdownWidth', () => {
  test('defaults to fluid (panel pinned to input width)', () => {
    const listbox = renderOpen({});
    expect(listbox.className).toContain('slds-dropdown_fluid');
  });

  test('drops fluid and applies the provided widths', () => {
    const listbox = renderOpen({ dropdownWidth: { minWidth: '100%', maxWidth: '32rem' } });
    expect(listbox.className).not.toContain('slds-dropdown_fluid');
    // jsdom resolves absolute lengths against the 16px default root font size, so the 32rem handed
    // to the component reads back as 512px. Percentages have no layout to resolve against, so
    // minWidth comes back verbatim.
    const styles = getComputedStyle(listbox);
    expect(styles.minWidth).toBe('100%');
    expect(styles.maxWidth).toBe('512px');
  });
});

describe('Combobox Enter key', () => {
  function renderClosed() {
    const onInputEnter = vi.fn();
    const result = render(
      <Combobox label="Orgs" onKeyboardNavigation={NOOP} onInputEnter={onInputEnter}>
        <ComboboxListItem id="a" label="one" selected={false} onSelection={NOOP} />
      </Combobox>,
    );
    return { ...result, onInputEnter, input: getInput(result.container) };
  }

  function pressEnter(element: HTMLElement) {
    fireEvent.keyDown(element, { key: 'Enter' });
    fireEvent.keyUp(element, { key: 'Enter' });
  }

  test('opens the closed list without picking an option, keeping focus on the input', async () => {
    const { container, baseElement, input, onInputEnter } = renderClosed();
    input.focus();
    expect(getListbox(container)).toBeNull();

    // fireEvent returns false when a handler called preventDefault — the press never reaches a wrapping form
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    fireEvent.keyUp(input, { key: 'Enter' });

    expect(getListbox(container)).not.toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(onInputEnter).not.toHaveBeenCalled();

    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });

  test('a second Enter picks the first option', () => {
    const { input, onInputEnter } = renderClosed();
    pressEnter(input);
    pressEnter(input);
    expect(onInputEnter).toHaveBeenCalledTimes(1);
  });

  test('leaves a modified Enter to page-level shortcuts', () => {
    const { container, input, onInputEnter } = renderClosed();
    expect(fireEvent.keyDown(input, { key: 'Enter', metaKey: true })).toBe(true);
    fireEvent.keyUp(input, { key: 'Enter', metaKey: true });
    expect(getListbox(container)).toBeNull();
    expect(onInputEnter).not.toHaveBeenCalled();
  });

  test('selecting an option with Enter in the list does not reopen it', () => {
    const { container } = render(<SelectableHarness />);
    const input = getInput(container);
    fireEvent.click(input);
    fireEvent.keyUp(input, { key: 'ArrowDown' });
    const option = screen.getByRole('option', { name: 'one' });
    expect(document.activeElement).toBe(option);

    // Selection happens on keydown in the list and hands focus back to the input, so the same
    // press's keyup lands on the closed input
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(getListbox(container)).toBeNull();
    expect(document.activeElement).toBe(input);
    fireEvent.keyUp(input, { key: 'Enter' });

    expect(getListbox(container)).toBeNull();
    expect(input.value).toBe('one');
  });
});

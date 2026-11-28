import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { DuelingPicklist, DuelingPicklistProps } from '../dueling-picklist/DuelingPicklist';

const ITEMS = ['Apple', 'Banana', 'Cherry', 'Date'].map((label) => ({ label, value: label.toLowerCase() }));

function TestPicklist({ initialSelectedItems = [], ...props }: Partial<DuelingPicklistProps> & { initialSelectedItems?: string[] }) {
  const [selectedItems, setSelectedItems] = useState(initialSelectedItems);
  return (
    <DuelingPicklist
      label="Fruit"
      labelLeft="Available"
      labelRight="Selected"
      items={ITEMS}
      selectedItems={selectedItems}
      onChange={setSelectedItems}
      {...props}
    />
  );
}

function getOptionLabels(listName: string) {
  return within(screen.getByRole('listbox', { name: listName }))
    .queryAllByRole('option')
    .map((option) => option.textContent);
}

function getSelectedLabels(listName: string) {
  return within(screen.getByRole('listbox', { name: listName }))
    .queryAllByRole('option', { selected: true })
    .map((option) => option.textContent);
}

/**
 * Keyboard model from the SLDS dueling picklist blueprint:
 * https://v1.lightningdesignsystem.com/components/dueling-picklist/#Accessibility
 */
describe('DuelingPicklist', () => {
  test('renders two multi-select listboxes with nothing selected and one tab stop each', () => {
    render(<TestPicklist initialSelectedItems={['cherry']} />);

    ['Available', 'Selected'].forEach((listName) => {
      const listbox = screen.getByRole('listbox', { name: listName });
      expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
      expect(listbox.getAttribute('aria-describedby')).toBeTruthy();
      const options = within(listbox).getAllByRole('option');
      options.forEach((option) => expect(option.getAttribute('aria-selected')).toBe('false'));
      expect(options.map((option) => option.tabIndex)).toEqual([0, ...options.slice(1).map(() => -1)]);
    });
    expect(getOptionLabels('Available')).toEqual(['Apple', 'Banana', 'Date']);
    expect(getOptionLabels('Selected')).toEqual(['Cherry']);
  });

  test('focusing a list selects the focused option and arrows move focus with the selection', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.tab();
    expect(document.activeElement?.textContent).toBe('Apple');
    expect(getSelectedLabels('Available')).toEqual(['Apple']);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Banana');
    expect(getSelectedLabels('Available')).toEqual(['Banana']);

    await user.keyboard('{End}');
    expect(getSelectedLabels('Available')).toEqual(['Date']);
    await user.keyboard('{ArrowDown}');
    expect(getSelectedLabels('Available')).toEqual(['Apple']);
  });

  test('shift extends the selection, ctrl moves focus only, ctrl+space toggles and ctrl+a selects all', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.tab();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana']);

    await user.keyboard('{Control>}{ArrowDown}{/Control}');
    expect(document.activeElement?.textContent).toBe('Cherry');
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana']);

    await user.keyboard('{Control>} {/Control}');
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana', 'Cherry']);
    await user.keyboard('{Control>} {/Control}');
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana']);

    await user.keyboard('{Control>}a{/Control}');
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);
  });

  test('ctrl+arrow moves the selection to the other list and focus follows it', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.tab();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await user.keyboard('{Control>}{ArrowRight}{/Control}');

    expect(getOptionLabels('Available')).toEqual(['Cherry', 'Date']);
    expect(getOptionLabels('Selected')).toEqual(['Apple', 'Banana']);
    expect(getSelectedLabels('Selected')).toEqual(['Apple', 'Banana']);
    expect(getSelectedLabels('Available')).toEqual([]);
    expect(document.activeElement?.textContent).toBe('Apple');

    await user.keyboard('{Control>}{ArrowLeft}{/Control}');
    expect(getOptionLabels('Selected')).toEqual([]);
    expect(getSelectedLabels('Available')).toEqual(['Apple', 'Banana']);
    expect(document.activeElement?.textContent).toBe('Apple');
  });

  test('the move button moves the selection, clears it and keeps focus on the button', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.click(screen.getByText('Banana'));
    const moveButton = screen.getByTitle('Move selection to Selected');
    await user.click(moveButton);

    expect(getOptionLabels('Selected')).toEqual(['Banana']);
    expect(getSelectedLabels('Selected')).toEqual([]);
    expect(document.activeElement).toBe(moveButton);
  });

  test('ctrl/cmd click starts a selection and toggles options in it', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.keyboard('{Meta>}');
    await user.click(screen.getByText('Banana'));
    expect(getSelectedLabels('Available')).toEqual(['Banana']);
    await user.click(screen.getByText('Date'));
    expect(getSelectedLabels('Available')).toEqual(['Banana', 'Date']);
    await user.click(screen.getByText('Banana'));
    expect(getSelectedLabels('Available')).toEqual(['Date']);
    await user.keyboard('{/Meta}');
  });

  test('ctrl+arrow does not select the option it moves to when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<TestPicklist />);

    await user.tab();
    await user.keyboard('{Control>} {/Control}');
    expect(getSelectedLabels('Available')).toEqual([]);
    await user.keyboard('{Control>}{ArrowDown}{/Control}');
    expect(document.activeElement?.textContent).toBe('Banana');
    expect(getSelectedLabels('Available')).toEqual([]);
  });

  test('space toggles reorder mode, where the arrows move the selection within the list', async () => {
    const user = userEvent.setup();
    render(<TestPicklist initialSelectedItems={['apple', 'banana', 'cherry']} />);

    act(() => screen.getByText('Cherry').closest<HTMLElement>('[role="option"]')?.focus());
    await user.keyboard(' ');
    await user.keyboard('{ArrowUp}');
    expect(getOptionLabels('Selected')).toEqual(['Apple', 'Cherry', 'Banana']);
    expect(document.activeElement?.textContent).toBe('Cherry');

    await user.keyboard(' ');
    await user.keyboard('{ArrowUp}');
    expect(getOptionLabels('Selected')).toEqual(['Apple', 'Cherry', 'Banana']);
    expect(getSelectedLabels('Selected')).toEqual(['Apple']);
  });

  test('double-click moves an option and the filter narrows the available list', async () => {
    const user = userEvent.setup();
    render(<TestPicklist allowFilter />);

    await user.type(screen.getByRole('searchbox', { name: 'Filter Available' }), 'an');
    expect(getOptionLabels('Available')).toEqual(['Banana']);

    await user.dblClick(screen.getByText('Banana'));
    expect(getOptionLabels('Selected')).toEqual(['Banana']);
    expect(getOptionLabels('Available')).toEqual([]);
  });
});

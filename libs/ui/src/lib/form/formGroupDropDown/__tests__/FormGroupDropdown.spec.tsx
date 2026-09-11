import { axeScan } from '@jetstream/test-utils';
import { FormGroupDropdownItem } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { FormGroupDropdown, FormGroupDropdownProps } from '../FormGroupDropdown';

const items: FormGroupDropdownItem[] = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'leads', label: 'Leads' },
];

function renderDropdown(props: Partial<FormGroupDropdownProps> = {}) {
  const onSelected = vi.fn();
  const result = render(
    <FormGroupDropdown comboboxId="object-combobox" label="Filter by object" items={items} onSelected={onSelected} {...props} />,
  );
  const trigger = screen.getByRole('combobox', { name: 'Filter by object' });
  return { ...result, onSelected, trigger };
}

describe('FormGroupDropdown', () => {
  describe('opening', () => {
    test('starts closed on the first item, without aria-controls', () => {
      const { trigger } = renderDropdown();
      expect(trigger.textContent).toBe('Accounts');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBeNull();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    test('honors initialSelectedItemId', () => {
      const { trigger } = renderDropdown({ initialSelectedItemId: 'contacts' });
      expect(trigger.textContent).toBe('Contacts');
    });

    test('click opens a listbox named by the label and points aria-controls at it', () => {
      const { trigger } = renderDropdown();
      fireEvent.click(trigger);

      const listbox = screen.getByRole('listbox', { name: 'Filter by object' });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Accounts', 'Contacts', 'Leads']);
      expect(screen.getByRole('option', { selected: true })).toBe(screen.getByRole('option', { name: 'Accounts' }));
    });

    test.each(['Enter', ' '])('%j on the closed trigger opens the list', (key) => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key });
      expect(screen.getByRole('listbox', { name: 'Filter by object' })).toBeTruthy();
    });
  });

  describe('keyboard navigation', () => {
    test('ArrowDown on the closed trigger opens the list and moves focus onto an li that itself carries role="option"', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      expect(fireEvent.keyDown(trigger, { key: 'ArrowDown' })).toBe(false);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const focused = document.activeElement as HTMLElement;
      expect(focused.tagName).toBe('LI');
      expect(focused.getAttribute('role')).toBe('option');
      expect(focused).toBe(screen.getByRole('option', { name: 'Accounts' }));
    });

    test('ArrowUp on the closed trigger opens the list on the last option', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Leads' }));
    });

    test('arrow keys move between options and wrap at both ends', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const [accounts, contacts, leads] = screen.getAllByRole('option');

      fireEvent.keyDown(accounts, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(contacts);
      fireEvent.keyDown(contacts, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(leads);
      fireEvent.keyDown(leads, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(accounts);
      fireEvent.keyDown(accounts, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(leads);
    });

    test('Escape closes the list, drops aria-controls and returns focus to the trigger', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const accounts = screen.getByRole('option', { name: 'Accounts' });
      expect(document.activeElement).toBe(accounts);

      fireEvent.keyDown(accounts, { key: 'Escape' });

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    test('Tab closes the list without trapping focus', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      // Default is not prevented so the browser continues sequential navigation
      expect(fireEvent.keyDown(screen.getByRole('option', { name: 'Accounts' }), { key: 'Tab' })).toBe(true);
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('selection', () => {
    test('Enter on a focused option selects it, closes the list and calls onSelected', () => {
      const { trigger, onSelected } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const accounts = screen.getByRole('option', { name: 'Accounts' });
      fireEvent.keyDown(accounts, { key: 'ArrowDown' });
      const contacts = screen.getByRole('option', { name: 'Contacts' });
      expect(document.activeElement).toBe(contacts);

      fireEvent.keyDown(contacts, { key: 'Enter' });

      expect(onSelected).toHaveBeenCalledTimes(1);
      expect(onSelected).toHaveBeenCalledWith(items[1]);
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger.textContent).toBe('Contacts');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    test('clicking an option selects it and closes the list', () => {
      const { trigger, onSelected } = renderDropdown();
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('option', { name: 'Leads' }));

      expect(onSelected).toHaveBeenCalledTimes(1);
      expect(onSelected).toHaveBeenCalledWith(items[2]);
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger.textContent).toBe('Leads');

      fireEvent.click(trigger);
      expect(screen.getByRole('option', { selected: true })).toBe(screen.getByRole('option', { name: 'Leads' }));
    });

    test('selecting an option returns focus to the trigger instead of letting it fall to body', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const contacts = screen.getByRole('option', { name: 'Contacts' });
      contacts.focus();
      fireEvent.keyDown(contacts, { key: 'Enter' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('option', { name: 'Leads' }));
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('iconOnly variant', () => {
    test('renders a read-only combobox input showing the selected label and supports arrow navigation', () => {
      const { trigger } = renderDropdown({ iconOnly: true });
      expect(trigger.tagName).toBe('INPUT');
      expect((trigger as HTMLInputElement).readOnly).toBe(true);
      expect((trigger as HTMLInputElement).value).toBe('Accounts');
      expect(trigger.getAttribute('aria-controls')).toBeNull();

      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(trigger.getAttribute('aria-controls')).toBe(screen.getByRole('listbox', { name: 'Filter by object' }).id);
      expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Accounts' }));
    });
  });

  describe('accessibility', () => {
    test('has no axe violations closed or open (with a heading)', async () => {
      const { trigger, baseElement } = renderDropdown({ headingLabel: 'Objects' });
      expect((await axeScan(baseElement)).violations).toEqual([]);

      fireEvent.click(trigger);
      expect(screen.getByRole('listbox', { name: 'Filter by object' })).toBeTruthy();
      expect(screen.getByText('Objects')).toBeTruthy();
      expect((await axeScan(baseElement)).violations).toEqual([]);
    });

    test('has no axe violations in the iconOnly variant while open', async () => {
      const { trigger, baseElement } = renderDropdown({ iconOnly: true });
      fireEvent.click(trigger);
      expect(screen.getByRole('listbox')).toBeTruthy();
      expect((await axeScan(baseElement)).violations).toEqual([]);
    });
  });

  describe('review-round regressions', () => {
    test('Tab from a focused option hands focus to the trigger and closes without preventDefault', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const contacts = screen.getByRole('option', { name: 'Contacts' });
      contacts.focus();
      expect(fireEvent.keyDown(contacts, { key: 'Tab' })).toBe(true);
      expect(document.activeElement).toBe(trigger);
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    test('Space on a focused option selects it like Enter', () => {
      const { trigger, onSelected } = renderDropdown();
      trigger.focus();
      // ArrowDown twice: the component's focused index (not the DOM-focused li) is what selection reads
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByRole('option', { name: 'Accounts' }), { key: 'ArrowDown' });
      const contacts = screen.getByRole('option', { name: 'Contacts' });
      fireEvent.keyDown(contacts, { key: ' ' });
      expect(onSelected).toHaveBeenCalledWith(items[1]);
      expect(document.activeElement).toBe(trigger);
    });

    test('modified keys on the trigger are left to the browser and page shortcuts', () => {
      const { trigger } = renderDropdown();
      trigger.focus();
      expect(fireEvent.keyDown(trigger, { key: 'Enter', metaKey: true })).toBe(true);
      expect(fireEvent.keyDown(trigger, { key: 'r', metaKey: true })).toBe(true);
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });
});

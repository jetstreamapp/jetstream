import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { TimePicker, TimePickerProps } from '../TimePicker';

// 24 hours at the default 15 minute step
const OPTION_COUNT_AT_DEFAULT_STEP = 96;

function getInput() {
  return screen.getByRole('combobox', { name: 'Start time' }) as HTMLInputElement;
}

/** The option's inner div is keyed by the item id, which for the TimePicker is the "HH:mm:ss.SSS" value */
function getSelectedOptionValue() {
  return screen.getByRole('option', { selected: true }).querySelector('[id]')?.id;
}

function renderTimePicker(props: Partial<TimePickerProps> = {}) {
  const onChange = vi.fn();
  const result = render(<TimePicker label="Start time" onChange={onChange} {...props} />);
  return { ...result, onChange };
}

/** Owns the selected time the way app-level forms do, so clearing and selecting update what is rendered */
function StatefulHarness({ initialTime, onChange }: { initialTime: string | null; onChange: (value: string | null) => void }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(initialTime);
  return (
    <TimePicker
      label="Start time"
      selectedItem={selectedItem}
      onChange={(value) => {
        setSelectedItem(value);
        onChange(value);
      }}
    />
  );
}

describe('TimePicker', () => {
  describe('initial time normalization', () => {
    test.each([
      // remainder below half a step rounds down
      ['20:18', '20:15:00.000', '8:15 PM'],
      // seconds and milliseconds are stripped before rounding
      ['20:18:38.000', '20:15:00.000', '8:15 PM'],
      // rounding up past :59 carries into the next hour
      ['20:59', '21:00:00.000', '9:00 PM'],
      // ...and past 23:59 wraps to midnight
      ['23:59', '00:00:00.000', '12:00 AM'],
      // remainder 7 is below the 7.5 midpoint, remainder 8 is above it
      ['09:07', '09:00:00.000', '9:00 AM'],
      ['09:08', '09:15:00.000', '9:15 AM'],
      // already on a step boundary is left alone
      ['09:30:00.000', '09:30:00.000', '9:30 AM'],
    ])('normalizes %s to %s at the default 15 minute step (shown as %s)', (initialTime, expectedValue, expectedLabel) => {
      renderTimePicker({ selectedItem: initialTime });
      const input = getInput();
      expect(input.value).toBe(expectedLabel);

      fireEvent.click(input);
      expect(getSelectedOptionValue()).toBe(expectedValue);
    });

    test('rounds to the configured step size', () => {
      // remainder 20 of a 30 minute step is past the midpoint, so 09:50 rounds up to 10:00
      renderTimePicker({ selectedItem: '09:50', stepInMinutes: 30 });
      const input = getInput();
      expect(input.value).toBe('10:00 AM');

      fireEvent.click(input);
      expect(getSelectedOptionValue()).toBe('10:00:00.000');
      expect(screen.getAllByRole('option')).toHaveLength(48);
    });

    test('renders empty without a selected time', () => {
      renderTimePicker();
      expect(getInput().value).toBe('');
      expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
    });
  });

  describe('selection', () => {
    test('clicking an option calls onChange with the HH:mm:ss.SSS value', () => {
      const { onChange } = renderTimePicker();
      fireEvent.click(getInput());
      fireEvent.click(screen.getByRole('option', { name: '8:15 PM' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('20:15:00.000');
    });

    test('ArrowDown moves focus onto the first option and Enter selects it', async () => {
      const { onChange } = renderTimePicker();
      const input = getInput();
      fireEvent.click(input);
      fireEvent.keyUp(input, { key: 'ArrowDown' });

      const firstOption = screen.getByRole('option', { name: '12:00 AM' });
      await waitFor(() => expect(document.activeElement).toBe(firstOption));

      fireEvent.keyDown(firstOption, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('00:00:00.000');
      await waitFor(() => expect(document.activeElement).toBe(input));
    });

    test('typing filters the options and Enter picks the first match', async () => {
      const { onChange } = renderTimePicker();
      const input = getInput();
      fireEvent.click(input);
      expect(screen.getAllByRole('option')).toHaveLength(OPTION_COUNT_AT_DEFAULT_STEP);

      fireEvent.change(input, { target: { value: '9:30' } });
      fireEvent.keyUp(input, { key: '0', keyCode: 48 });

      // The (debounced) fuzzy filter ranks rather than prunes for a short pattern like this, so the
      // observable effect is the best match moving to the top of the list
      // Generous timeout: the filter is debounced and re-ranks 96 options, which can take longer than
      // waitFor's default under a fully parallel test run
      await waitFor(() => expect(screen.getAllByRole('option')[0]).toBe(screen.getByRole('option', { name: '9:30 AM' })), {
        timeout: 4000,
      });

      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyUp(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('09:30:00.000');
    });
  });

  describe('clear button', () => {
    test('clears the selection, calls onChange(null) and reopens the list for a replacement', async () => {
      const onChange = vi.fn();
      render(<StatefulHarness initialTime="20:18" onChange={onChange} />);
      const input = getInput();
      expect(input.value).toBe('8:15 PM');

      fireEvent.click(screen.getByRole('button', { name: /clear/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(null);
      await waitFor(() => expect(input.value).toBe(''));
      expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
      expect(input.getAttribute('aria-expanded')).toBe('true');
      await waitFor(() => expect(document.activeElement).toBe(input));
    });
  });

  describe('accessibility', () => {
    test('the input is a combobox and the focusable list items carry role="option" while open', () => {
      renderTimePicker({ selectedItem: '20:15' });
      const input = getInput();
      expect(input.tagName).toBe('INPUT');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('aria-controls')).toBeNull();
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(screen.queryAllByRole('option')).toHaveLength(0);

      fireEvent.click(input);

      expect(input.getAttribute('aria-expanded')).toBe('true');
      const listbox = screen.getByRole('listbox', { name: 'Start time' });
      expect(input.getAttribute('aria-controls')).toBe(listbox.id);
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(OPTION_COUNT_AT_DEFAULT_STEP);
      expect(options.every((option) => option.tagName === 'LI')).toBe(true);
      expect(screen.getByRole('option', { selected: true })).toBe(screen.getByRole('option', { name: '8:15 PM' }));
    });

    test('applies the id prop to the input so an external htmlFor can target it', () => {
      renderTimePicker({ id: 'start-time' });
      expect(getInput().id).toBe('start-time');
    });

    test('has no axe violations closed or open', async () => {
      const { baseElement } = renderTimePicker({ selectedItem: '20:15' });
      expect((await axeScan(baseElement)).violations).toEqual([]);

      fireEvent.click(getInput());
      expect(screen.getByRole('listbox')).toBeTruthy();
      expect((await axeScan(baseElement)).violations).toEqual([]);
    });
  });
});

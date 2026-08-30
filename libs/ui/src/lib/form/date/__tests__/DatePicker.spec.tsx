import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../DatePicker';

function openCalendar() {
  render(<DatePicker id="close-date" label="Close Date" initialSelectedDate={new Date(2026, 8, 18)} onChange={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Select a date for Close Date' });
  fireEvent.click(trigger);
  return { trigger, calendar: screen.getByRole('dialog') };
}

function getFocusableControls(calendar: HTMLElement) {
  return Array.from(calendar.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]'));
}

describe('DatePicker', () => {
  it('should have no axe violations with the calendar open', async () => {
    const { calendar } = openCalendar();

    const results = await axeScan(calendar);

    expect(results.violations).toEqual([]);
  });

  // The calendar is not modal: someone who opened it and decided against picking a date tabs on, as they
  // always could. Wrapping instead left Escape as the only way out.
  it('closes the calendar and hands Tab on from the trigger when Tab leaves the last control', () => {
    const { trigger, calendar } = openCalendar();
    const lastControl = getFocusableControls(calendar).at(-1) as HTMLElement;
    lastControl.focus();

    const wasNotPrevented = fireEvent.keyDown(lastControl, { key: 'Tab' });

    // Not prevented: the browser's own Tab then moves on from the trigger
    expect(wasNotPrevented).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the calendar when Shift+Tab leaves the first control', () => {
    const { trigger, calendar } = openCalendar();
    const firstControl = getFocusableControls(calendar)[0];
    firstControl.focus();

    fireEvent.keyDown(firstControl, { key: 'Tab', shiftKey: true });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab inside the calendar between its controls', () => {
    const { calendar } = openCalendar();
    const firstControl = getFocusableControls(calendar)[0];
    firstControl.focus();

    fireEvent.keyDown(firstControl, { key: 'Tab' });

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

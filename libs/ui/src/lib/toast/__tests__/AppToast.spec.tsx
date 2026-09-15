import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppToast, fireToast } from '../AppToast';

const DEFAULT_DURATION = 5000;

function setup() {
  const result = render(<AppToast />);
  return { ...result, container: screen.getByTestId('toast-notify-container') };
}

/** Non-error string toasts render their text as a heading, which the announcer never does */
function queryToast(message: string) {
  return screen.queryByRole('heading', { name: message });
}

/** The one persistent polite region non-error toasts are announced through */
function getAnnouncer() {
  const announcer = document.querySelector<HTMLElement>('span.slds-assistive-text[role="status"]');
  if (!announcer) {
    throw new Error('Announcer region is not mounted');
  }
  return announcer;
}

function fire(message: React.ReactNode, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration?: number) {
  act(() => fireToast({ type, message, duration }));
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

describe('AppToast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have no axe violations', async () => {
    const { baseElement } = setup();
    // kept open so the scan is not racing the dismiss timer
    fire('Saved', 'success', 0);
    fire('Something went wrong', 'error');

    const results = await axeScan(baseElement);

    expect(results.violations).toEqual([]);
  });

  it('auto-dismisses a non-error toast after its duration', () => {
    vi.useFakeTimers();
    setup();

    fire('Saved', 'success');
    expect(queryToast('Saved')).toBeTruthy();

    advance(DEFAULT_DURATION - 1);
    expect(queryToast('Saved')).toBeTruthy();

    advance(1);
    expect(queryToast('Saved')).toBeNull();
  });

  it('does not auto-dismiss a toast that arrives while the pointer is over the toasts, until the pointer leaves', () => {
    vi.useFakeTimers();
    const { container } = setup();
    fire('First');
    fireEvent.mouseEnter(container);

    fire('Second');
    // well past the duration: neither the paused toast nor the one that arrived during the pause may dismiss
    advance(DEFAULT_DURATION * 3);
    expect(queryToast('First')).toBeTruthy();
    expect(queryToast('Second')).toBeTruthy();

    fireEvent.mouseLeave(container);
    advance(DEFAULT_DURATION - 1);
    expect(queryToast('First')).toBeTruthy();
    expect(queryToast('Second')).toBeTruthy();

    advance(1);
    expect(queryToast('First')).toBeNull();
    expect(queryToast('Second')).toBeNull();
  });

  it('renders an error toast as an alert that stays until dismissed', () => {
    vi.useFakeTimers();
    setup();

    fire('Something went wrong', 'error');

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Something went wrong');
    expect(alert.getAttribute('aria-live')).toBe('assertive');

    advance(DEFAULT_DURATION * 10);
    expect(screen.getByRole('alert')).toBeTruthy();
    // errors are announced on insertion by the alert itself, so they are not mirrored to the announcer
    advance(100);
    expect(getAnnouncer().textContent).toBe('');

    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('gives a non-error toast with a JSX message its own status region, since it cannot go through the announcer', () => {
    vi.useFakeTimers();
    setup();

    fire(
      <span>
        Loaded <strong>42</strong> records
      </span>,
    );

    const toast = screen.getByText('42').closest('[role="status"]');
    expect(toast).toBeTruthy();
    expect(toast?.getAttribute('aria-live')).toBe('polite');
    expect(toast).not.toBe(getAnnouncer());
    advance(100);
    expect(getAnnouncer().textContent).toBe('');
  });

  it('announces a plain-string non-error toast through the shared announcer instead of a live region on the toast', () => {
    vi.useFakeTimers();
    setup();

    fire('Saved', 'success');

    const toastBox = queryToast('Saved')?.closest('.slds-notify');
    expect(toastBox).toBeTruthy();
    expect(toastBox?.hasAttribute('role')).toBe(false);
    // clear-then-set: the text lands in the region a beat after the toast so repeated messages re-announce
    expect(getAnnouncer().textContent).toBe('');
    advance(100);
    expect(getAnnouncer().textContent).toBe('Saved');
  });
});

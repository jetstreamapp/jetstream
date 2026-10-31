/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// The `@jetstream/ui` barrel pulls in a drag-and-drop dependency that reads `ResizeObserver` at module evaluation
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock('@jetstream/ui/app-state', () => ({ applicationCookieState: {}, googleDriveAccessState: {} }));
vi.mock('@jetstream/ui-core', () => ({
  fromJetstreamEvents: { emit: vi.fn() },
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutomationPackageDropDown } from '../AutomationControlPackageDownload';

function PackageDropDown({ isPreparing, onSelected = vi.fn() }: { isPreparing: boolean; onSelected?: (variant: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return <AutomationPackageDropDown isPreparing={isPreparing} triggerRef={triggerRef} onSelected={onSelected} />;
}

describe('AutomationPackageDropDown', () => {
  it('announces that the package is being prepared', () => {
    const { rerender } = render(<PackageDropDown isPreparing={false} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');

    rerender(<PackageDropDown isPreparing />);

    expect(status.textContent).toBe('Preparing package');
  });

  it('returns focus to the trigger when preparing ends without opening a download (e.g. it failed)', async () => {
    const user = userEvent.setup();
    const onSelected = vi.fn();
    const { rerender } = render(<PackageDropDown isPreparing={false} onSelected={onSelected} />);
    const trigger = screen.getByRole('button', { name: /Download Package/ });

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Before these changes' }));
    expect(onSelected).toHaveBeenCalledWith('before');

    // A browser drops focus from a button that becomes disabled (jsdom does not, and cannot blur a disabled button)
    act(() => trigger.blur());
    rerender(<PackageDropDown isPreparing onSelected={onSelected} />);
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(document.body);

    rerender(<PackageDropDown isPreparing={false} onSelected={onSelected} />);

    expect(document.activeElement).toBe(trigger);
  });

  it('does not take focus back when the user moved on while the package was prepared', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <PackageDropDown isPreparing={false} />
        <input aria-label="Elsewhere" />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /Download Package/ });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'After these changes' }));

    rerender(
      <>
        <PackageDropDown isPreparing />
        <input aria-label="Elsewhere" />
      </>,
    );
    const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' });
    act(() => elsewhere.focus());

    rerender(
      <>
        <PackageDropDown isPreparing={false} />
        <input aria-label="Elsewhere" />
      </>,
    );

    expect(document.activeElement).toBe(elsewhere);
  });
});

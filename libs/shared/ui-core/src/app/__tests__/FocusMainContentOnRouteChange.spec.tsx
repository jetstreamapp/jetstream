import { MAIN_CONTENT_ID } from '@jetstream/ui';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { describe, expect, test } from 'vitest';
import { FocusMainContentOnRouteChange } from '../FocusMainContentOnRouteChange';

type NavigateFn = (to: string) => void;

/**
 * A minimal app shell: persistent header controls (a nav button and an org switcher combobox), the
 * main landmark, and a way for tests to trigger a navigation that no control initiated (the app's
 * redirect-on-load).
 */
function Shell({ navigateRef }: { navigateRef: { current: NavigateFn | null } }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate, navigateRef]);
  return (
    <>
      <FocusMainContentOnRouteChange />
      <header>
        <button type="button" onClick={() => navigate('/load')}>
          Load Records
        </button>
        <input aria-label="Orgs" role="combobox" aria-expanded="true" aria-controls="orgs-listbox" readOnly />
        <ul id="orgs-listbox" role="listbox" aria-label="Org list" />
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        <button type="button">Inside main</button>
        <Routes>
          <Route path="/home" element={<h1>Home</h1>} />
          <Route path="/load" element={<h1>Load</h1>} />
          <Route
            path="/settings"
            element={
              <section id="data-history" tabIndex={-1}>
                Data history
              </section>
            }
          />
          <Route path="*" element={<h1>Other</h1>} />
        </Routes>
      </main>
    </>
  );
}

function renderShell(initialPath: string) {
  const navigateRef = { current: null as NavigateFn | null };
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Shell navigateRef={navigateRef} />
    </MemoryRouter>,
  );
  return {
    mainContent: document.getElementById(MAIN_CONTENT_ID) as HTMLElement,
    navigate: (to: string) =>
      act(() => {
        navigateRef.current?.(to);
      }),
  };
}

// The component remembers the first user interaction in module state, so the "before any interaction"
// case has to run first in this file.
describe('FocusMainContentOnRouteChange', () => {
  test('leaves focus alone on the redirect that happens before the user has interacted (app load)', () => {
    const { navigate, mainContent } = renderShell('/');
    navigate('/home');
    expect(document.activeElement).not.toBe(mainContent);
    expect(document.activeElement).toBe(document.body);
  });

  test('leaves an expanded control alone: the org switcher opened while the app was still redirecting on load', () => {
    const { navigate, mainContent } = renderShell('/');
    const orgSwitcher = screen.getByRole('combobox', { name: 'Orgs' });
    fireEvent.pointerDown(orgSwitcher);
    orgSwitcher.focus();

    navigate('/home');

    expect(document.activeElement).toBe(orgSwitcher);
    expect(document.activeElement).not.toBe(mainContent);
  });

  test('moves focus to the main landmark after a navigation the user initiated', () => {
    const { mainContent } = renderShell('/home');
    const navButton = screen.getByRole('button', { name: 'Load Records' });
    fireEvent.pointerDown(navButton);
    act(() => {
      fireEvent.click(navButton);
    });
    expect(screen.getByRole('heading', { name: 'Load' })).toBeTruthy();
    expect(document.activeElement).toBe(mainContent);
  });

  test('does not yank focus that is already inside the main content', () => {
    const { navigate, mainContent } = renderShell('/home');
    const insideMain = screen.getByRole('button', { name: 'Inside main' });
    fireEvent.pointerDown(insideMain);
    insideMain.focus();

    navigate('/load');

    expect(document.activeElement).toBe(insideMain);
    expect(document.activeElement).not.toBe(mainContent);
  });

  test('a #hash deep link lands on that section instead of the top of the page', () => {
    const { navigate } = renderShell('/home');
    fireEvent.pointerDown(document.body);

    navigate('/settings#data-history');

    expect(document.activeElement).toBe(screen.getByText('Data history'));
  });
});

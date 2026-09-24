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
      <main id={MAIN_CONTENT_ID}>
        <button type="button">Inside main</button>
        <Routes>
          <Route path="/home" element={<h1>Home</h1>} />
          <Route path="/load" element={<h1>Load</h1>} />
          <Route path="/settings" element={<section id="data-history">Data history</section>} />
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

describe('FocusMainContentOnRouteChange', () => {
  test('leaves an expanded control alone: the org switcher opened while the app was still redirecting on load', () => {
    const { navigate, mainContent } = renderShell('/');
    const orgSwitcher = screen.getByRole('combobox', { name: 'Orgs' });
    fireEvent.pointerDown(orgSwitcher);
    orgSwitcher.focus();

    navigate('/home');

    expect(document.activeElement).toBe(orgSwitcher);
    expect(document.activeElement).not.toBe(mainContent);
  });

  test('moves focus to the main landmark after a click on a navbar menu item, which the menu only hides', () => {
    const { navigate, mainContent } = renderShell('/home');
    // The navbar menus stay mounted and hide with CSS; Firefox and Safari still report the clicked item as
    // focused when the route effect runs
    const menu = document.createElement('ul');
    menu.setAttribute('role', 'menu');
    const menuItem = document.createElement('li');
    menuItem.setAttribute('role', 'menuitem');
    menuItem.tabIndex = -1;
    menuItem.checkVisibility = () => false;
    menu.appendChild(menuItem);
    document.body.appendChild(menu);
    fireEvent.pointerDown(menuItem);
    menuItem.focus();

    navigate('/load');

    expect(document.activeElement).toBe(mainContent);
    menu.remove();
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

  test('does not yank focus from a control inside the content that the browser did not focus on click (Safari)', () => {
    const { navigate, mainContent } = renderShell('/home');
    // Safari leaves focus on <body> when a button is clicked
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inside main' }));

    navigate('/load');

    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(mainContent);
  });

  test('a key press after that click means focus, not the old click, says where the user is', () => {
    const { navigate, mainContent } = renderShell('/home');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inside main' }));
    // Keyboard from here on: a link the user activated with Enter unmounted and focus fell to <body>
    fireEvent.keyDown(document.body, { key: 'Enter' });

    navigate('/load');

    expect(document.activeElement).toBe(mainContent);
  });

  test('a click on the main landmark itself, not a control in it, does not hold focus back', () => {
    const { navigate, mainContent } = renderShell('/home');
    fireEvent.pointerDown(mainContent);

    navigate('/load');

    expect(document.activeElement).toBe(mainContent);
  });

  test('the main landmark is focusable only while the navigation hands it focus', () => {
    const { mainContent } = renderShell('/home');
    const navButton = screen.getByRole('button', { name: 'Load Records' });
    fireEvent.pointerDown(navButton);
    act(() => {
      fireEvent.click(navButton);
    });
    expect(document.activeElement).toBe(mainContent);

    screen.getByRole('button', { name: 'Inside main' }).focus();

    expect(mainContent.hasAttribute('tabindex')).toBe(false);
  });

  test('a #hash deep link lands on that section instead of the top of the page', () => {
    const { navigate } = renderShell('/home');
    fireEvent.pointerDown(document.body);

    navigate('/settings#data-history');

    expect(document.activeElement).toBe(screen.getByText('Data history'));
  });

  // Deliberately last: the "has the user interacted yet?" record is per-mount, so the interactions
  // every test above performs must not leak into this one.
  test('leaves focus alone on the redirect that happens before the user has interacted (app load)', () => {
    const { navigate, mainContent } = renderShell('/');
    navigate('/home');
    expect(document.activeElement).not.toBe(mainContent);
    expect(document.activeElement).toBe(document.body);
  });
});

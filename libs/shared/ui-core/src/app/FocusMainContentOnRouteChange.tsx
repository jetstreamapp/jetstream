import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/** The app shell's main content container — the element focused after route navigation. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * Moves keyboard focus to the main content container (`#main-content`) after route navigation, so a
 * keyboard user lands at the top of the new page instead of staying on the nav link — or worse, losing
 * focus to `<body>` when the element they activated (a dropdown menu item) unmounts, which restarts
 * tabbing from the top of the document.
 *
 * Focus is NOT reset when the navigation was initiated from within the content itself and that control
 * is still mounted (e.g. switching sub-routes inside a feature) — yanking focus to the top there would
 * lose the user's place.
 *
 * Render once per app shell, inside the router provider. The shell must give its content container
 * `id={MAIN_CONTENT_ID}` and `tabIndex={-1}`.
 */
export function FocusMainContentOnRouteChange() {
  const { pathname } = useLocation();
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    const container = document.getElementById(MAIN_CONTENT_ID);
    if (!container) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && container.contains(activeElement)) {
      return;
    }
    container.focus();
  }, [pathname]);

  return null;
}

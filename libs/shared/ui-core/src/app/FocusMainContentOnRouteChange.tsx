import { MAIN_CONTENT_ID } from '@jetstream/ui';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

// Re-exported so existing `import { MAIN_CONTENT_ID } from '@jetstream/ui-core'` call sites keep
// working — the constant itself lives in @jetstream/ui next to SkipToContent, which targets it.
export { MAIN_CONTENT_ID };

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
 * When the navigation carries a `#hash`, focus (and scroll to) the element with that id instead —
 * this is how in-app deep links (e.g. Settings#data-history) land the user on the right section.
 * The target must have `tabIndex={-1}`, and may mount after async data loads, so it is polled for
 * briefly.
 *
 * Render once per app shell, inside the router provider. The shell must give its content container
 * `id={MAIN_CONTENT_ID}` and `tabIndex={-1}`.
 */
export function FocusMainContentOnRouteChange() {
  const { pathname, hash } = useLocation();
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      // The plain-pathname focus reset below must not run on app load (it would steal focus for no
      // navigation), but a #hash deep link on a HARD load is exactly a request to land on that
      // section — and the browser's native fragment scroll misses targets that mount after async
      // data loads, which the polling below exists to handle. So only skip when there is no hash.
      if (!hash) {
        return;
      }
    }

    if (hash) {
      let attemptsRemaining = 20;
      let cancelled = false;
      const tryFocusHashTarget = () => {
        if (cancelled) {
          return;
        }
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView?.({ block: 'start' });
          target.focus();
          return;
        }
        attemptsRemaining--;
        if (attemptsRemaining > 0) {
          window.setTimeout(tryFocusHashTarget, 50);
        }
      };
      tryFocusHashTarget();
      return () => {
        cancelled = true;
      };
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
  }, [pathname, hash]);

  return null;
}

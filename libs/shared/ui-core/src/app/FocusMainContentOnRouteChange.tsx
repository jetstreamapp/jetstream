import { MAIN_CONTENT_ID } from '@jetstream/ui';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

// Whether the user has interacted with the page yet. `navigator.userActivation` is the browser's own
// record (Chrome 72+, Safari 16.4+, Firefox 120+); the listeners cover older browsers and are attached
// lazily from the first mount so this module has no top-level side effects.
let userInteracted = false;
let interactionListenersAttached = false;
function trackUserInteraction() {
  if (interactionListenersAttached) {
    return;
  }
  interactionListenersAttached = true;
  const markInteracted = () => {
    userInteracted = true;
  };
  window.addEventListener('pointerdown', markInteracted, { capture: true, once: true });
  window.addEventListener('keydown', markInteracted, { capture: true, once: true });
}
function hasUserInteracted() {
  const userActivation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return userInteracted || userActivation?.hasBeenActive === true;
}

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

  useEffect(() => trackUserInteraction(), []);

  useEffect(() => {
    // Until the user has interacted, every location change is app load or a redirect-on-load (`/app`
    // → `/home`, the extension's `?url=` navigate) — the plain-pathname focus reset must not run there
    // (it stole focus from the skip link/header on every cold load). A #hash deep link on a hard load
    // IS a request to land on that section, and the browser's native fragment scroll misses targets
    // that mount after async data loads, which the polling below handles — so only the hash proceeds.
    if (!hash && !hasUserInteracted()) {
      return;
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

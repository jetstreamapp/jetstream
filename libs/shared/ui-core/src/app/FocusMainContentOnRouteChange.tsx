import { focusContainer, MAIN_CONTENT_ID } from '@jetstream/ui';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

function browserRecordsUserActivation() {
  // `navigator.userActivation` is the browser's own record (Chrome 72+, Safari 16.4+, Firefox 120+)
  const userActivation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return userActivation?.hasBeenActive === true;
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
 * The target may mount after async data loads, so it is polled for briefly.
 *
 * Neither target needs a `tabIndex`: focus is moved with `focusContainer`, which adds one only for that
 * moment.
 *
 * Render once per app shell, inside the router provider. The shell must give its content container
 * `id={MAIN_CONTENT_ID}`.
 */
export function FocusMainContentOnRouteChange() {
  const { pathname, hash } = useLocation();
  // Whether the user has interacted with the page yet. Instance state rather than module state: this
  // component is mounted once per app shell, so the two are equivalent at runtime, and a ref resets
  // with the render tree instead of leaking between tests. The listeners back up the browser's own
  // `navigator.userActivation` record for older browsers.
  const userInteractedRef = useRef(false);
  // Safari (and Firefox on macOS) do not focus a button or link on click, so a navigation started by
  // clicking a control inside the content leaves focus on <body> — the clicked control is then the only
  // record of where the user is. Any key press clears it: from then on focus says where the user is.
  const lastPointerDownTargetRef = useRef<Element | null>(null);

  useEffect(() => {
    const recordKeyDown = () => {
      userInteractedRef.current = true;
      lastPointerDownTargetRef.current = null;
    };
    const recordPointerDown = (event: PointerEvent) => {
      userInteractedRef.current = true;
      lastPointerDownTargetRef.current = event.target instanceof Element ? event.target : null;
    };
    window.addEventListener('pointerdown', recordPointerDown, { capture: true });
    window.addEventListener('keydown', recordKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', recordPointerDown, { capture: true });
      window.removeEventListener('keydown', recordKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    // Until the user has interacted, every location change is app load or a redirect-on-load (`/app`
    // → `/home`, the extension's `?url=` navigate) — the plain-pathname focus reset must not run there
    // (it stole focus from the skip link/header on every cold load). A #hash deep link on a hard load
    // IS a request to land on that section, and the browser's native fragment scroll misses targets
    // that mount after async data loads, which the polling below handles — so only the hash proceeds.
    if (!hash && !userInteractedRef.current && !browserRecordsUserActivation()) {
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
          focusContainer(target);
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
    if (!activeElement || activeElement === document.body) {
      const lastPointerDownTarget = lastPointerDownTargetRef.current;
      // A press on the container's own padding is not a control the user is working with
      if (lastPointerDownTarget?.isConnected && lastPointerDownTarget !== container && container.contains(lastPointerDownTarget)) {
        return;
      }
    } else if (activeElement instanceof HTMLElement) {
      if (container.contains(activeElement)) {
        return;
      }
      // A control still expanded after the navigation belongs to an interaction in progress — the header
      // org switcher opened while the app was still redirecting on load (`/` → `/home`), a menu the user
      // is arrowing through. Moving focus would collapse it under them. The control that triggered a
      // navigation has collapsed by the time this effect runs — but the navbar menus only hide theirs with
      // CSS, and Firefox and Safari still report the hidden item as focused here, so it must be visible.
      if (activeElement.closest('[aria-expanded="true"], [role="listbox"], [role="menu"]') && activeElement.checkVisibility?.() !== false) {
        return;
      }
    }
    focusContainer(container);
  }, [pathname, hash]);

  return null;
}

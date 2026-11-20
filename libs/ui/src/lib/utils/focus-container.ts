/**
 * Moves focus to an element that is not focusable on its own — a landmark, a page section, a panel
 * region — for a skip link, a route change or a deep link.
 *
 * The `tabindex` that makes this possible only lives while the element holds that focus. A permanent
 * `tabIndex={-1}` makes the container take focus on every click on its non-interactive content, after
 * which Tab restarts from the container's first control (Chromium, Firefox) and the arrow, Page and Space
 * keys stop scrolling the scroll areas inside it (every engine). For the same reason a click inside the
 * container releases it straight away: the container still holds focus from this call at that point, so
 * the click would otherwise keep focus on it.
 */
export function focusContainer(element: HTMLElement, options?: FocusOptions) {
  if (element.hasAttribute('tabindex')) {
    element.focus(options);
    return;
  }
  element.setAttribute('tabindex', '-1');
  element.focus(options);
  if (document.activeElement !== element) {
    element.removeAttribute('tabindex');
    return;
  }
  const release = () => {
    element.removeAttribute('tabindex');
    element.removeEventListener('blur', release);
    element.removeEventListener('pointerdown', release, { capture: true });
  };
  element.addEventListener('blur', release);
  element.addEventListener('pointerdown', release, { capture: true });
}

const HASH_TARGET_POLL_INTERVAL_MS = 50;
const HASH_TARGET_POLL_ATTEMPTS = 20;

/**
 * Scrolls to and focuses the element a `#hash` deep link names, waiting briefly for it to mount: a
 * section often renders after async data loads, which the browser's native fragment jump misses.
 *
 * The wait ends as soon as the user presses a key or a pointer button. From then on they are working
 * somewhere else, and a target that mounts late must not pull focus and scroll away from them.
 *
 * `onTargetMissing` runs when the target never mounted and the user has not interacted in the meantime.
 *
 * @returns a function that stops waiting, for effect cleanup
 */
export function focusHashTargetWhenMounted(hash: string, { onTargetMissing }: { onTargetMissing?: () => void } = {}): () => void {
  const targetId = hash.replace(/^#/, '');
  let attemptsRemaining = HASH_TARGET_POLL_ATTEMPTS;
  let timeoutId: number | undefined;

  const stopWaiting = () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener('keydown', stopWaiting, { capture: true });
    window.removeEventListener('pointerdown', stopWaiting, { capture: true });
  };

  const tryFocusTarget = () => {
    const target = document.getElementById(targetId);
    if (target) {
      stopWaiting();
      target.scrollIntoView?.({ block: 'start' });
      focusContainer(target);
      return;
    }
    attemptsRemaining--;
    if (attemptsRemaining > 0) {
      timeoutId = window.setTimeout(tryFocusTarget, HASH_TARGET_POLL_INTERVAL_MS);
      return;
    }
    stopWaiting();
    onTargetMissing?.();
  };

  window.addEventListener('keydown', stopWaiting, { capture: true });
  window.addEventListener('pointerdown', stopWaiting, { capture: true });
  tryFocusTarget();
  return stopWaiting;
}

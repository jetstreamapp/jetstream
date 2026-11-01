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

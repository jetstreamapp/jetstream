import { useEffect } from 'react';

/** Cells manage their own roving tabindex (0 on the active cell, -1 otherwise) — never touch them. */
const CELL_SELECTOR = '[role="gridcell"], [role="rowheader"], [role="columnheader"]';

/** Anything the browser would put in the page tab order. */
const FOCUSABLE_SELECTOR = 'a[href], area[href], button, input, select, textarea, [tabindex]';

function removeFromTabOrder(element: Element) {
  if (!(element instanceof HTMLElement) || element.tabIndex === -1) {
    return;
  }
  // Escape hatch for controls OUTSIDE the cell navigation model (e.g. the permission manager's
  // column-group-header popover trigger) — grid keyboard navigation never visits group headers,
  // so Tab is the only way to reach them.
  if (element.hasAttribute('data-grid-keep-tab-stop')) {
    return;
  }
  // Only sweep content INSIDE a cell: the cells themselves (and the grid root) own the roving tabindex.
  if (element.matches(CELL_SELECTOR) || !element.closest(CELL_SELECTOR)) {
    return;
  }
  element.tabIndex = -1;
}

function sweep(scope: Element) {
  removeFromTabOrder(scope);
  scope.querySelectorAll(FOCUSABLE_SELECTOR).forEach(removeFromTabOrder);
}

/**
 * Keeps the grid a single page tab stop by removing focusable elements that consumer cell renderers
 * mount inside cells (links, buttons, inputs) from the tab order. The keyboard model reaches them
 * through Enter/Space activation and Actionable mode instead (see useGridKeyboardNavigation) —
 * `.focus()`/`.click()` work regardless of tabindex.
 *
 * The grid's built-in renderers already set `tabIndex={-1}` on their controls; this is the safety net
 * for the arbitrary content consumers render (e.g. record links), which would otherwise turn a large
 * table into hundreds of tab stops. A MutationObserver handles content that mounts after the cell —
 * e.g. a link that appears once an async URL resolves — and virtualized rows scrolling into view.
 */
export function useGridTabOrderContainment(getRootElement: () => HTMLElement | null) {
  useEffect(() => {
    const root = getRootElement();
    if (!root || typeof MutationObserver === 'undefined') {
      return;
    }
    sweep(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              sweep(node);
            }
          });
        } else if (mutation.target instanceof Element) {
          // An existing element became focusable (gained an href, or a renderer set tabindex >= 0).
          removeFromTabOrder(mutation.target);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'tabindex'] });
    return () => observer.disconnect();
  }, [getRootElement]);
}

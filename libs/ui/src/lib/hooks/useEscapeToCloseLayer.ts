import { useEffect, useRef } from 'react';

/**
 * Open layers, in the order they opened (outermost first). Layers can nest — a combobox inside a
 * Popover, a date picker inside a filter popover — and a single Escape press must close only the
 * INNERMOST one. Every active instance registers a document capture listener, but only the
 * instance on top of this stack acts; the others ignore the event and wait their turn.
 */
const openLayerStack: symbol[] = [];

/**
 * While a transient layer (combobox/picklist/dropdown menu, date picker popup, popover) is open,
 * capture Escape at the document level BEFORE anything else: close ONLY the layer, and consume the
 * event so an ancestor modal/popover cannot also react to the same press and close itself.
 *
 * Both phases of the press are swallowed — floating-ui's useDismiss listens on document keydown, and
 * Modal additionally closes on keyup — via a one-shot keyup capture listener registered from the
 * keydown handler (the effect's own listeners are already torn down by the time keyup fires, since
 * closing the layer flips `isOpen` and re-runs the effect).
 *
 * `onEscape` must fully replicate the layer's own Escape behavior (close + return focus), because
 * the layer's React-level handler never sees the consumed event.
 *
 * Invariants:
 * - This hook is the SINGLE owner of Escape while the layer is open. A component-level Escape
 *   handler that only runs in the open state is dead code — do not add one alongside this hook
 *   (component handlers may still guard Escape in the CLOSED state, e.g. type-ahead buffers).
 * - Layers may nest: each open instance joins `openLayerStack`, and only the topmost (innermost,
 *   most recently opened) instance handles Escape. One press closes one layer, from the inside out.
 */
export function useEscapeToCloseLayer(isOpen: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const layerId = Symbol('escape-layer');
    openLayerStack.push(layerId);

    const swallowKeyUp = (event: KeyboardEvent) => {
      document.removeEventListener('keyup', swallowKeyUp, { capture: true });
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      // An inner layer is open above this one — its own listener (registered later, so it runs
      // after this no-op) consumes the press and closes just that layer
      if (openLayerStack[openLayerStack.length - 1] !== layerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      document.addEventListener('keyup', swallowKeyUp, { capture: true });
      // Safety: never leave the one-shot swallower behind if the matching keyup is lost
      window.setTimeout(() => document.removeEventListener('keyup', swallowKeyUp, { capture: true }), 1000);
      onEscapeRef.current();
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      const stackIndex = openLayerStack.indexOf(layerId);
      if (stackIndex >= 0) {
        openLayerStack.splice(stackIndex, 1);
      }
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen]);
}

export default useEscapeToCloseLayer;

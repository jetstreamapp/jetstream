import { isImeComposing } from '@jetstream/shared/ui-utils';
import { createContext, useContext, useEffect, useRef } from 'react';
import { monacoEditorOwnsEscape } from '../utils/monaco-escape';

/**
 * How a layer treats the Escape keydown it handles:
 * - `consume` (default): the press closes ONLY this layer; nothing else sees it.
 * - `propagate`: the layer still closes, but the keydown continues to React handlers, so a host that
 *   treats the whole surface as one editing layer (the grid cell editor: its popup IS the editor)
 *   can cancel in the same press instead of demanding a second Escape. The keyup is still swallowed
 *   so a Modal hosting the grid does not close on it.
 */
export const EscapeLayerPropagationContext = createContext<'consume' | 'propagate'>('consume');

export interface EscapeLayerOptions {
  /**
   * The layer's own element, for layers that can outlive a modal opening over them (a Popover whose
   * action opens the record modal stays open underneath it).
   */
  getLayerElement?: () => Element | null | undefined;
}

/**
 * A modal dialog has opened over this layer and the user is working inside it: the layer is out of
 * sight behind the backdrop, so the press belongs to the modal. Consuming it here closed only the
 * hidden layer and left the modal asking for a second Escape.
 */
function isLayerBuriedUnderModal(target: EventTarget | null, layerElement: Element | null | undefined): boolean {
  const modal = target instanceof Element ? target.closest('[role="dialog"][aria-modal="true"]') : null;
  return !!modal && !!layerElement && !modal.contains(layerElement) && !layerElement.contains(modal);
}

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
export function useEscapeToCloseLayer(isOpen: boolean, onEscape: () => void, { getLayerElement }: EscapeLayerOptions = {}) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const getLayerElementRef = useRef(getLayerElement);
  getLayerElementRef.current = getLayerElement;
  const propagation = useContext(EscapeLayerPropagationContext);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const layerId = Symbol('escape-layer');
    openLayerStack.push(layerId);

    let pendingSwallowTimeout: number | undefined;

    function swallowKeyUp(event: KeyboardEvent) {
      // Only the Escape keyup detaches the one-shot swallower: releasing a modifier (Shift held while
      // pressing Escape) fired first and left the Escape keyup free to reach Modal's onKeyUp
      if (event.key !== 'Escape') {
        return;
      }
      document.removeEventListener('keyup', swallowKeyUp, { capture: true });
      if (pendingSwallowTimeout !== undefined) {
        window.clearTimeout(pendingSwallowTimeout);
        pendingSwallowTimeout = undefined;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Auto-repeat while Escape is held: the first press already closed this layer; a repeat must not
      // fall through to an ancestor (the layer unregisters on the re-render, not synchronously)
      if (event.key !== 'Escape' || event.repeat) {
        return;
      }
      // An Escape that cancels an IME conversion is part of typing into the layer, not a request to close it
      if (isImeComposing(event)) {
        return;
      }
      // A code editor inside the layer (Quick Query, manual SOQL, query-history edits) dismisses its own
      // autocomplete/find/hover on Escape and stops the event itself; this press is Monaco's, not the layer's
      if (monacoEditorOwnsEscape(event.target)) {
        return;
      }
      // An inner layer is open above this one — its own listener (registered later, so it runs
      // after this no-op) consumes the press and closes just that layer
      if (openLayerStack[openLayerStack.length - 1] !== layerId) {
        return;
      }
      if (isLayerBuriedUnderModal(event.target, getLayerElementRef.current?.())) {
        return;
      }
      if (propagation === 'consume') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      // The swallower has to outlive this effect: closing the layer flips `isOpen`, so the cleanup below
      // has already run by the time the keyup arrives
      const ownerDocument = document;
      ownerDocument.addEventListener('keyup', swallowKeyUp, { capture: true });
      // Safety: never leave the one-shot swallower behind if the matching keyup is lost. It touches only
      // the captured document: this fires after the effect is gone, and in jsdom after the globals are too
      pendingSwallowTimeout = window.setTimeout(() => {
        pendingSwallowTimeout = undefined;
        ownerDocument.removeEventListener('keyup', swallowKeyUp, { capture: true });
      }, 1000);
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
  }, [isOpen, propagation]);
}

export default useEscapeToCloseLayer;

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
  /**
   * For a layer whose content is mainly a code editor being edited (a query history edit): Escape inside the
   * editor first leaves the editor, as the editor announces, and the next Escape closes the layer. Without it
   * the same press would close the layer and throw away what was just typed.
   */
  codeEditorEscapeLeavesEditor?: boolean;
  /**
   * For a layer that is part of the page rather than floating over it, and can be open several times at once
   * (two query history cards in edit mode): Escape goes to the instance that contains the event target instead
   * of whichever opened last. Requires `getLayerElement`. When focus is in none of them, the most recently
   * opened one still handles the press.
   */
  followsFocus?: boolean;
}

interface OpenLayer {
  id: symbol;
  followsFocus: boolean;
  getElement: () => Element | null | undefined;
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
const openLayerStack: OpenLayer[] = [];

/**
 * The layer that owns this Escape press: the topmost one, unless the top of the stack is a run of
 * `followsFocus` layers, where the one containing the event target wins.
 */
function getHandlingLayerId(target: EventTarget | null): symbol | undefined {
  const topLayer = openLayerStack[openLayerStack.length - 1];
  if (!topLayer?.followsFocus || !(target instanceof Node)) {
    return topLayer?.id;
  }
  for (let i = openLayerStack.length - 1; i >= 0 && openLayerStack[i].followsFocus; i--) {
    if (openLayerStack[i].getElement()?.contains(target)) {
      return openLayerStack[i].id;
    }
  }
  return topLayer.id;
}

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
 *   "Most recently opened" is effect order, so a parent and child layer that mount ALREADY open in the
 *   same commit would stack in reverse (React runs the child's effect first). No layer mounts that way
 *   today; inner layers open on interaction. Order by DOM containment before adding one that does.
 */
export function useEscapeToCloseLayer(
  isOpen: boolean,
  onEscape: () => void,
  { getLayerElement, codeEditorEscapeLeavesEditor = false, followsFocus = false }: EscapeLayerOptions = {},
) {
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
    openLayerStack.push({ id: layerId, followsFocus, getElement: () => getLayerElementRef.current?.() });

    // The swallower outlives this effect (see below), so it only touches the document and window captured
    // here: in jsdom the globals can be gone by the time it is cleaned up
    const ownerDocument = document;
    const ownerWindow = window;

    function detachSwallower() {
      ownerDocument.removeEventListener('keyup', swallowKeyUp, { capture: true });
      ownerDocument.removeEventListener('keydown', dropStaleSwallower, { capture: true });
      ownerWindow.removeEventListener('blur', detachSwallower);
    }

    // A new Escape press means the previous press's keyup was lost (e.g. focus left the page mid-press), so
    // stop waiting for it. Registered during the keydown that closed the layer, so it does not see that one.
    function dropStaleSwallower(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.repeat) {
        detachSwallower();
      }
    }

    function swallowKeyUp(event: KeyboardEvent) {
      // Only the Escape keyup detaches the one-shot swallower: releasing a modifier (Shift held while
      // pressing Escape) fired first and left the Escape keyup free to reach Modal's onKeyUp
      if (event.key !== 'Escape') {
        return;
      }
      detachSwallower();
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
      if (codeEditorEscapeLeavesEditor && event.target instanceof Element && event.target.closest('.monaco-editor')) {
        return;
      }
      // Another layer owns this press: an inner one open above this one, or a sibling `followsFocus` layer
      // that holds focus. Its own listener consumes the press and closes just that layer
      if (getHandlingLayerId(event.target) !== layerId) {
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
      // has already run by the time the keyup arrives. It waits for the matching keyup however long Escape
      // is held, and is dropped if that keyup is lost (the window loses focus, or a new press starts).
      ownerDocument.addEventListener('keyup', swallowKeyUp, { capture: true });
      ownerDocument.addEventListener('keydown', dropStaleSwallower, { capture: true });
      ownerWindow.addEventListener('blur', detachSwallower);
      onEscapeRef.current();
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      const stackIndex = openLayerStack.findIndex(({ id }) => id === layerId);
      if (stackIndex >= 0) {
        openLayerStack.splice(stackIndex, 1);
      }
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, propagation, codeEditorEscapeLeavesEditor, followsFocus]);
}

export default useEscapeToCloseLayer;

import { KeyboardEvent, RefObject, useCallback, useMemo, useRef, useState } from 'react';

export interface RovingCheckboxItemProps {
  tabIndex: number;
  inputProps: { 'data-roving-id': string; onFocus: () => void };
}

export interface RovingCheckboxListOptions {
  /** Currently visible checkbox ids in DOM order — exactly one of them is tabbable at a time */
  ids: string[];
  /** Optional tree-style extension, e.g. ArrowRight expands the focused class row */
  onArrowRight?: (id: string) => void;
  /** Optional tree-style extension, e.g. ArrowLeft collapses the focused class row */
  onArrowLeft?: (id: string) => void;
}

export interface RovingCheckboxList {
  containerProps: { ref: RefObject<HTMLUListElement | null>; onKeyDown: (event: KeyboardEvent<HTMLElement>) => void };
  /** Spread onto the `Checkbox` for the given id — provides `tabIndex` and `inputProps` */
  getItemProps: (id: string) => RovingCheckboxItemProps;
  /** Programmatically move focus to an item (e.g. stepping from a method back to its class) */
  focusItem: (id: string) => void;
}

/**
 * Roving tabindex for a list of checkboxes rendered as one composite widget: the whole list is a
 * single page tab stop and ArrowUp/ArrowDown (plus Home/End) move between the checkboxes, the same
 * model as the Accordion's singleTabStop mode and the Tree component. The last focused item (falling
 * back to the first) keeps `tabIndex=0` so tabbing back into the list returns where the user left off.
 */
export function useRovingCheckboxList({ ids, onArrowRight, onArrowLeft }: RovingCheckboxListOptions): RovingCheckboxList {
  const containerRef = useRef<HTMLUListElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const tabbableId = useMemo(() => (focusedId && ids.includes(focusedId) ? focusedId : (ids[0] ?? null)), [focusedId, ids]);

  const focusItem = useCallback((id: string) => {
    setFocusedId(id);
    // Deferred a frame so an item revealed by the same keystroke (e.g. ArrowRight expanding a class
    // row's methods) exists before it is focused
    window.requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>(`[data-roving-id="${CSS.escape(id)}"]`)?.focus();
    });
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const targetId = (event.target as HTMLElement).getAttribute('data-roving-id');
    if (!targetId) {
      return;
    }
    const currentIndex = ids.indexOf(targetId);
    if (currentIndex === -1) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < ids.length - 1) {
          focusItem(ids[currentIndex + 1]);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          focusItem(ids[currentIndex - 1]);
        }
        break;
      case 'Home':
        event.preventDefault();
        focusItem(ids[0]);
        break;
      case 'End':
        event.preventDefault();
        focusItem(ids[ids.length - 1]);
        break;
      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight(targetId);
        }
        break;
      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft(targetId);
        }
        break;
      default:
        break;
    }
  }

  function getItemProps(id: string): RovingCheckboxItemProps {
    return {
      tabIndex: id === tabbableId ? 0 : -1,
      inputProps: { 'data-roving-id': id, onFocus: () => setFocusedId(id) },
    };
  }

  return { containerProps: { ref: containerRef, onKeyDown: handleKeyDown }, getItemProps, focusItem };
}

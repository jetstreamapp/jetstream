import { KeyboardEvent as ReactKeyboardEvent, useCallback } from 'react';
import { hasCtrlOrMeta, hasShiftModifierKey, isEnterKey } from '../shared-ui-keyboard';
import { useGlobalEventHandler } from './useGlobalEventHandler';

interface KeyboardActionOptions {
  /** When true the shortcut is ignored — wire this to the same condition that disables the button */
  disabled?: boolean;
  /**
   * Where the action lives. A `page` action (the default) stays quiet while a modal dialog is open: the
   * page is inert behind it and its primary button is out of reach, so firing it from inside the modal
   * (Cmd+Enter while reading a test result) would act on the page unseen. A `dialog` action belongs to
   * the modal itself and keeps firing.
   */
  scope?: 'page' | 'dialog';
}

function isModalDialogOpen() {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

/**
 * Cmd+Enter (mac) / Ctrl+Enter — fires the page's primary action (save, continue, execute, etc.).
 * Ignores Shift so it never collides with the go-back shortcut, and skips events already handled by
 * a focused Monaco editor (which binds Cmd+Enter itself and stops propagation).
 */
export function usePrimaryActionShortcut(handler: () => void, { disabled, scope = 'page' }: KeyboardActionOptions = {}) {
  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled || event.defaultPrevented) {
        return;
      }
      const keyboardEvent = event as unknown as ReactKeyboardEvent;
      if (hasCtrlOrMeta(keyboardEvent) && !hasShiftModifierKey(keyboardEvent) && isEnterKey(keyboardEvent)) {
        if (scope === 'page' && isModalDialogOpen()) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        handler();
      }
    },
    [disabled, handler, scope],
  );
  useGlobalEventHandler('keydown', onKeydown);
}

/**
 * Cmd+Shift+Enter (mac) / Ctrl+Shift+Enter — navigates back one step in a multi-step (wizard) flow.
 */
export function useGoBackShortcut(handler: () => void, { disabled, scope = 'page' }: KeyboardActionOptions = {}) {
  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled || event.defaultPrevented) {
        return;
      }
      const keyboardEvent = event as unknown as ReactKeyboardEvent;
      if (hasCtrlOrMeta(keyboardEvent) && hasShiftModifierKey(keyboardEvent) && isEnterKey(keyboardEvent)) {
        if (scope === 'page' && isModalDialogOpen()) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        handler();
      }
    },
    [disabled, handler, scope],
  );
  useGlobalEventHandler('keydown', onKeydown);
}

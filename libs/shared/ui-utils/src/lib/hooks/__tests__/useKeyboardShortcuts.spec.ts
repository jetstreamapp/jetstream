import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useGoBackShortcut, usePrimaryActionShortcut } from '../useKeyboardShortcuts';

function dispatchKeydown(init: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  });
}

describe('usePrimaryActionShortcut', () => {
  test('fires on Ctrl+Enter', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    dispatchKeydown({ key: 'Enter', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('fires on Meta(Cmd)+Enter', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    dispatchKeydown({ key: 'Enter', metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('does not fire when Shift is also held (reserved for go-back)', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    dispatchKeydown({ key: 'Enter', metaKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire on Enter without a modifier', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    dispatchKeydown({ key: 'Enter' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire on Ctrl + non-Enter key', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    dispatchKeydown({ key: 'a', ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire when disabled', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler, { disabled: true }));
    dispatchKeydown({ key: 'Enter', metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  test('skips events already handled elsewhere (defaultPrevented, e.g. a focused Monaco editor)', () => {
    const handler = vi.fn();
    renderHook(() => usePrimaryActionShortcut(handler));
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    event.preventDefault();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('stops listening after unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => usePrimaryActionShortcut(handler));
    unmount();
    dispatchKeydown({ key: 'Enter', metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useGoBackShortcut', () => {
  test('fires on Ctrl+Shift+Enter', () => {
    const handler = vi.fn();
    renderHook(() => useGoBackShortcut(handler));
    dispatchKeydown({ key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('fires on Meta(Cmd)+Shift+Enter', () => {
    const handler = vi.fn();
    renderHook(() => useGoBackShortcut(handler));
    dispatchKeydown({ key: 'Enter', metaKey: true, shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('does not fire without Shift (reserved for the primary action)', () => {
    const handler = vi.fn();
    renderHook(() => useGoBackShortcut(handler));
    dispatchKeydown({ key: 'Enter', metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  test('does not fire when disabled', () => {
    const handler = vi.fn();
    renderHook(() => useGoBackShortcut(handler, { disabled: true }));
    dispatchKeydown({ key: 'Enter', metaKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});

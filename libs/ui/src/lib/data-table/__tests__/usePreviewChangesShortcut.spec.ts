import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { usePreviewChangesShortcut } from '../usePreviewChangesShortcut';

function pressModEnter(target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('usePreviewChangesShortcut', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  test('leaves Cmd/Ctrl+Enter for the page when there is nothing to preview', () => {
    const onPreview = vi.fn();
    renderHook(() => usePreviewChangesShortcut({ hasDirtyRows: false, isSaving: false, onPreview }));

    const event = pressModEnter();
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(false);
    expect(onPreview).not.toHaveBeenCalled();
  });

  test('claims the key and opens the preview when rows are dirty', () => {
    const onPreview = vi.fn();
    renderHook(() => usePreviewChangesShortcut({ hasDirtyRows: true, isSaving: false, onPreview }));

    const event = pressModEnter();
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(true);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  test('claims a press from inside an open cell editor, whose commit may be the first change', () => {
    const onPreview = vi.fn();
    renderHook(() => usePreviewChangesShortcut({ hasDirtyRows: false, isSaving: false, onPreview }));
    const editor = document.createElement('div');
    editor.className = 'jgrid-editor';
    const input = document.createElement('input');
    editor.appendChild(input);
    document.body.appendChild(editor);

    const event = pressModEnter(input);
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(true);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  test('stands down while a modal dialog is open so the modal keeps its own shortcut', () => {
    const onPreview = vi.fn();
    renderHook(() => usePreviewChangesShortcut({ hasDirtyRows: true, isSaving: false, onPreview }));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    const event = pressModEnter();
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(false);
    expect(onPreview).not.toHaveBeenCalled();
  });

  test('ignores a plain Enter', () => {
    const onPreview = vi.fn();
    renderHook(() => usePreviewChangesShortcut({ hasDirtyRows: true, isSaving: false, onPreview }));

    const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    vi.runAllTimers();

    expect(event.defaultPrevented).toBe(false);
    expect(onPreview).not.toHaveBeenCalled();
  });
});

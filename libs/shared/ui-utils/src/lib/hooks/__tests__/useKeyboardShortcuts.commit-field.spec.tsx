import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { usePrimaryActionShortcut } from '../useKeyboardShortcuts';

/** Mirrors the record form: the field keeps its own draft and only commits it to the parent on blur */
function BlurCommittedForm({ commitFocusedField, onSave }: { commitFocusedField: boolean; onSave: (record: string) => void }) {
  const [record, setRecord] = useState('');
  const [draft, setDraft] = useState('');
  usePrimaryActionShortcut(() => onSave(record), { commitFocusedField });
  return <input aria-label="Name" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => setRecord(draft)} />;
}

function pressPrimaryActionShortcut() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
  });
}

describe('usePrimaryActionShortcut commitFocusedField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('saves the value still being typed, and leaves focus in the field', () => {
    const onSave = vi.fn();
    render(<BlurCommittedForm commitFocusedField onSave={onSave} />);
    const input = screen.getByLabelText('Name');
    input.focus();
    fireEvent.change(input, { target: { value: 'Acme' } });

    pressPrimaryActionShortcut();
    act(() => {
      vi.runAllTimers();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Acme');
    expect(document.activeElement).toBe(input);
  });

  test('without the option the handler runs at once with whatever was committed before', () => {
    const onSave = vi.fn();
    render(<BlurCommittedForm commitFocusedField={false} onSave={onSave} />);
    const input = screen.getByLabelText('Name');
    input.focus();
    fireEvent.change(input, { target: { value: 'Acme' } });

    pressPrimaryActionShortcut();

    expect(onSave).toHaveBeenCalledWith('');
  });

  test('leaves a combobox input alone, since blurring it would close its list', () => {
    const onBlur = vi.fn();
    function ComboboxForm() {
      usePrimaryActionShortcut(() => undefined, { commitFocusedField: true });
      return <input aria-label="Object" role="combobox" aria-expanded="true" aria-controls="objects" onBlur={onBlur} />;
    }
    render(<ComboboxForm />);
    screen.getByLabelText('Object').focus();

    pressPrimaryActionShortcut();

    expect(onBlur).not.toHaveBeenCalled();
  });
});

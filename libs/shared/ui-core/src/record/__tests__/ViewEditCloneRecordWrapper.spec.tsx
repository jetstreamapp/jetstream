import { appActionObservable } from '@jetstream/shared/ui-utils';
import { CloneEditView } from '@jetstream/types';
import { Modal } from '@jetstream/ui';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { atom } from 'jotai';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

let canWriteRecords = true;

// The real app-state module fetches app info at module load; only these are read by the wrapper
vi.doMock('@jetstream/ui/app-state', () => ({
  applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app', defaultApiVersion: 'v66.0' }),
  selectedOrgState: atom({ uniqueId: 'org-1', label: 'Org 1' }),
  useCanPerformOperation: () => canWriteRecords,
}));

vi.doMock('@jetstream/shared/data', () => ({
  describeGlobal: vi.fn(),
}));

/** Stand-in for the record modal, which needs describe and record data: an edit form, or a read-only view */
vi.doMock('../ViewEditCloneRecord', () => ({
  ViewEditCloneRecord: ({ action, liveRegion, onClose }: { action: CloneEditView; liveRegion: ReactNode; onClose: () => void }) => (
    <Modal header="Account" onClose={onClose}>
      {liveRegion}
      {action === 'view' ? (
        <p>Read-only record</p>
      ) : (
        <label>
          Name
          <input defaultValue="Acme" />
        </label>
      )}
    </Modal>
  ),
}));

const { ViewEditCloneRecordWrapper } = await import('../ViewEditCloneRecordWrapper');

describe('ViewEditCloneRecordWrapper', () => {
  it('announces inside the dialog and keeps focus in it when write access is revoked mid-edit', async () => {
    canWriteRecords = true;
    const { rerender } = render(<ViewEditCloneRecordWrapper />);
    act(() => appActionObservable.next({ action: 'EDIT_RECORD', payload: { recordId: '001000000000001AAA', objectName: 'Account' } }));

    const nameInput = await screen.findByRole('textbox', { name: 'Name' });
    act(() => nameInput.focus());
    expect(document.activeElement).toBe(nameInput);

    canWriteRecords = false;
    rerender(<ViewEditCloneRecordWrapper />);

    const dialog = screen.getByRole('dialog');
    await screen.findByText('Read-only record');
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    // The focused field unmounted with the form - focus stays in the dialog instead of falling to <body>
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The toast's region is outside the modal (hidden from screen readers), so the reason is announced in the dialog
    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe(
        'Your Jetstream access does not include creating or updating records. The record is now read-only.',
      ),
    );
  });
});

/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@jetstream/shared/ui-utils', async () => {
  const actual = await vi.importActual<typeof import('@jetstream/shared/ui-utils')>('@jetstream/shared/ui-utils');
  return { ...actual, copyRecordsToClipboard: vi.fn() };
});

import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalContainer from 'react-modal-promise';
import { CopyRecordsToClipboardButton, CopyRecordsToClipboardButtonProps } from '../CopyRecordsToClipboardButton';

const mockCopyRecordsToClipboard = vi.mocked(copyRecordsToClipboard);

const RECORDS = [{ Id: '001' }, { Id: '002' }, { Id: '003' }];
const FIELDS = ['Id'];

function renderButton(props: Partial<CopyRecordsToClipboardButtonProps> = {}) {
  return render(
    <>
      <ModalContainer />
      <CopyRecordsToClipboardButton fields={FIELDS} records={RECORDS} {...props} />
    </>,
  );
}

describe('CopyRecordsToClipboardButton', () => {
  beforeEach(() => {
    mockCopyRecordsToClipboard.mockClear();
  });

  test('copies every record without prompting when there is no subset to choose from', async () => {
    renderButton({ filteredRecords: RECORDS, selectedRecords: [] });

    await userEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/ }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockCopyRecordsToClipboard).toHaveBeenCalledWith(RECORDS, 'excel', FIELDS);
  });

  test('copies as the format picked from the dropdown', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'More copy formats' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy as CSV' }));

    expect(mockCopyRecordsToClipboard).toHaveBeenCalledWith(RECORDS, 'csv', FIELDS);
  });

  test('prompts for which records to copy once some are selected and copies only those', async () => {
    const onCopy = vi.fn();
    const selectedRecords = [RECORDS[1]];
    renderButton({ selectedRecords, onCopy });

    await userEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/ }));
    await userEvent.click(await screen.findByLabelText('Selected Records (1)'));
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(mockCopyRecordsToClipboard).toHaveBeenCalledWith(selectedRecords, 'excel', FIELDS);
    expect(onCopy).toHaveBeenCalledWith({ format: 'excel', whichRecords: 'selected' });
  });

  test('copies nothing when the prompt is canceled', async () => {
    renderButton({ selectedRecords: [RECORDS[0]] });

    await userEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(mockCopyRecordsToClipboard).not.toHaveBeenCalled();
  });

  test('is disabled without records', () => {
    renderButton({ records: [] });

    expect(screen.getByRole('button', { name: /Copy to Clipboard/ })).toHaveProperty('disabled', true);
  });
});

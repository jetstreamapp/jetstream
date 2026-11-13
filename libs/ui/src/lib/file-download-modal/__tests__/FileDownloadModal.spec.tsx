import { prepareExcelFile } from '@jetstream/shared/ui-utils';
import { FileExtAllTypes, SalesforceOrgUi } from '@jetstream/types';
import { XlsxError } from '@jetstreamapp/simple-excel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireToast } from '../../toast/AppToast';
import { FileDownloadModal } from '../FileDownloadModal';

vi.mock('../../toast/AppToast', () => ({ fireToast: vi.fn() }));
// The real writer by default, so a test can make one build fail
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/shared/ui-utils')>();
  return { ...actual, prepareExcelFile: vi.fn(actual.prepareExcelFile) };
});

const LS_KEY = 'RECENT_FILE_FORMAT_FileDownloadModal';

const org = { uniqueId: 'org-1', username: 'test@example.com' } as SalesforceOrgUi;
const records = [{ Id: '001', Name: 'Record 1' }];

/**
 * Hosts the modal the way a real caller does: `onModalClose` unmounts it, which fires the cleanup that aborts the
 * in-flight build.
 */
function setup(allowedTypes: FileExtAllTypes[]) {
  const trackEvent = vi.fn();
  const emitUploadToGoogleEvent = vi.fn();

  function Host() {
    const [isOpen, setIsOpen] = useState(true);
    if (!isOpen) {
      return <div>modal closed</div>;
    }
    return (
      <FileDownloadModal
        org={org}
        googleIntegrationEnabled
        googleShowUpgradeToPro={false}
        google_apiKey="api-key"
        google_appId="app-id"
        google_clientId="client-id"
        data={records}
        header={['Id', 'Name']}
        allowedTypes={allowedTypes}
        source="test"
        trackEvent={trackEvent}
        emitUploadToGoogleEvent={emitUploadToGoogleEvent}
        onModalClose={() => setIsOpen(false)}
      />
    );
  }

  render(
    <MemoryRouter>
      <Host />
    </MemoryRouter>,
  );

  return { trackEvent, emitUploadToGoogleEvent };
}

describe('FileDownloadModal google upload', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * Queueing the upload closes the modal, and unmounting aborts the build's signal. The completion steps still
   * have to run - the abort check after the upload exists for a user who cancelled mid-build, not for this.
   *
   * Both upload sources are covered because they unmount at different times: a csv upload is prepared synchronously,
   * so the modal is gone (and the signal aborted) before `handleDownload` resumes, while an xlsx build is awaited.
   */
  test.each([
    { uploadSource: 'csv', allowedTypes: ['csv', 'xlsx', 'gdrive'] },
    { uploadSource: 'xlsx', allowedTypes: ['xlsx', 'gdrive'] },
  ] as const)(
    'records the format and analytics after a queued $uploadSource upload closes the modal',
    async ({ uploadSource, allowedTypes }) => {
      const { trackEvent, emitUploadToGoogleEvent } = setup([...allowedTypes]);

      await userEvent.click(screen.getByLabelText(/Google Drive/i));
      await userEvent.click(screen.getByRole('button', { name: /^Download$/i }));

      await waitFor(() => expect(screen.getByText('modal closed')).toBeTruthy());

      expect(emitUploadToGoogleEvent).toHaveBeenCalledTimes(1);
      expect(emitUploadToGoogleEvent).toHaveBeenCalledWith({
        type: 'newJob',
        payload: [expect.objectContaining({ type: 'UploadToGoogle', meta: expect.objectContaining({ fileType: uploadSource }) })],
      });
      expect(trackEvent).toHaveBeenCalledWith('file_download', {
        source: 'test',
        fileFormat: 'gdrive',
        component: 'FileDownloadModal',
      });
      expect(localStorage.getItem(LS_KEY)).toBe('gdrive');
    },
  );
});

describe('FileDownloadModal failed download', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('tells the user when an Excel file cannot be built and the caller has no error handler', async () => {
    vi.mocked(prepareExcelFile).mockRejectedValueOnce(
      new XlsxError('ROW_OUT_OF_RANGE', 'Row 1048577 is past the 1048576 rows a sheet can hold.'),
    );
    setup(['xlsx', 'csv']);

    await userEvent.click(screen.getByLabelText(/Excel/i));
    await userEvent.click(screen.getByRole('button', { name: /^Download$/i }));

    await waitFor(() =>
      expect(fireToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'This download has more rows than an Excel sheet can hold (1,048,576). Download as CSV instead.',
      }),
    );
    expect(screen.queryByText('modal closed')).toBeNull();
    expect(screen.getByRole('button', { name: /^Download$/i })).toBeTruthy();
  });
});

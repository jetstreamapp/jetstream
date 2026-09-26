import { FileExtAllTypes, SalesforceOrgUi } from '@jetstream/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { FileDownloadModal } from '../FileDownloadModal';

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

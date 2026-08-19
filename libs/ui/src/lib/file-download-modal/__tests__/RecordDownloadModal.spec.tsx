import { SalesforceOrgUi } from '@jetstream/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { RecordDownloadModal, RecordDownloadModalProps } from '../RecordDownloadModal';

vi.mock('@jetstream/shared/data', () => ({
  describeSObject: vi.fn().mockResolvedValue({ data: { childRelationships: [] } }),
}));

const saveFile = vi.hoisted(() => vi.fn());
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  saveFile,
}));

const LS_KEY = 'RECENT_FILE_FORMAT_RecordDownloadModal';

const org = { uniqueId: 'org-1', username: 'test@example.com' } as SalesforceOrgUi;
const records = [
  { Id: '001', Name: 'Record 1' },
  { Id: '002', Name: 'Record 2' },
];

function setup(props: Partial<RecordDownloadModalProps> = {}) {
  const onDownload = vi.fn();
  const onDownloadFromServer = vi.fn();
  render(
    <MemoryRouter>
      <RecordDownloadModal
        org={org}
        googleIntegrationEnabled={false}
        googleShowUpgradeToPro={false}
        google_apiKey=""
        google_appId=""
        google_clientId=""
        downloadModalOpen
        fields={['Id', 'Name']}
        records={records}
        source="test"
        trackEvent={vi.fn()}
        onModalClose={vi.fn()}
        onDownload={onDownload}
        onDownloadFromServer={onDownloadFromServer}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onDownload, onDownloadFromServer };
}

describe('RecordDownloadModal file format persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('restores the previously used format when the modal opens', () => {
    localStorage.setItem(LS_KEY, 'json');
    setup();
    expect(screen.getByLabelText<HTMLInputElement>('JSON').checked).toBe(true);
  });

  test('saves the format after a browser download', async () => {
    localStorage.setItem(LS_KEY, 'json');
    setup();

    await userEvent.click(screen.getByLabelText('CSV'));
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(saveFile).toHaveBeenCalled();
    expect(localStorage.getItem(LS_KEY)).toBe('csv');
  });

  /**
   * The regression this covers: downloads that run on the server closed the modal without persisting the
   * format, so reopening reverted to whatever the last browser download had saved.
   */
  test('saves the format after a server download', async () => {
    localStorage.setItem(LS_KEY, 'json');
    // more records exist than are loaded, which makes the server-side scope the default
    const { onDownloadFromServer } = setup({ totalRecordCount: 5000 });

    expect(screen.getByLabelText<HTMLInputElement>(/^All records/).checked).toBe(true);

    await userEvent.click(screen.getByLabelText('CSV'));
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(onDownloadFromServer).toHaveBeenCalledWith(expect.objectContaining({ fileFormat: 'csv' }));
    expect(localStorage.getItem(LS_KEY)).toBe('csv');
  });

  /**
   * The load template is only offered when the caller passes `loadTemplateOption`, so persisting it would leave
   * every other caller falling back to the first allowed format instead of the user's real preference.
   */
  test('leaves the stored format alone after a load template download', async () => {
    localStorage.setItem(LS_KEY, 'csv');
    setup({ loadTemplateOption: { sobject: 'Account' } });

    await userEvent.click(screen.getByLabelText('Load template (Excel)'));
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(saveFile).toHaveBeenCalled();
    expect(localStorage.getItem(LS_KEY)).toBe('csv');
  });
});

/**
 * `requireBulkApi` used to be derived from the "bulk API with a warning" case, which is mutually exclusive with
 * the clean case - so a query the bulk API could handle losslessly was never forced onto it, and a large enough
 * download failed with `RangeError: Invalid string length` while the browser built the file.
 */
describe('RecordDownloadModal bulk API requirement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('forces the bulk API and CSV for a bulk-eligible query above the record threshold', () => {
    localStorage.setItem(LS_KEY, 'xlsx');
    setup({ totalRecordCount: 600_000 });

    expect(screen.getByLabelText<HTMLInputElement>('Salesforce Bulk API').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Standard').disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('CSV').checked).toBe(true);
  });

  test('leaves the download method up to the user below the record threshold', () => {
    setup({ totalRecordCount: 10_000 });

    expect(screen.getByLabelText<HTMLInputElement>('Standard').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Standard').disabled).toBe(false);
  });
});

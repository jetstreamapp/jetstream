import { Blob as NodeBlob } from 'node:buffer';

import { DataHistoryItem } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataHistoryPayloadTab } from '../DataHistoryPayloadTab';

const { readDataHistoryFileMock, copyPayloadMock } = vi.hoisted(() => ({
  readDataHistoryFileMock: vi.fn(),
  copyPayloadMock: vi.fn(),
}));

vi.mock('@jetstream/ui/data-history', () => ({ readDataHistoryFile: readDataHistoryFileMock }));
vi.mock('../data-history-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-history-download')>()),
  copyDataHistoryPayloadToClipboard: copyPayloadMock,
}));

globalThis.Blob = NodeBlob as unknown as typeof Blob;

// Non-tabular payload: an object rather than an array of flat records, so no table view can be built
const NON_TABULAR_JSON = JSON.stringify({ groupId: 'request-0', settings: { batchSize: 200 } });

const item = {
  key: 'dh_spec',
  org: 'org-1',
  orgLabel: 'Org 1',
  source: 'load-multi-object',
  operation: 'insert',
  api: 'batch-composite',
  sobjects: ['Account'],
  status: 'success',
  counts: { total: 1, success: 1, failure: 0 },
  config: {},
  files: [{ kind: 'request', path: 'p', fileName: 'request.json', contentType: 'application/json', compressed: false, bytes: 10 }],
  storageBackend: 'opfs',
  sizeBytes: 10,
  pinned: false,
  pinnedIdx: 'false',
  errorMessage: null,
  startedAt: new Date(),
  finishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as DataHistoryItem;

function renderTab() {
  return render(
    <DataHistoryPayloadTab
      item={item}
      kind="request"
      cache={new Map()}
      viewStateCache={new Map()}
      onRequestDownload={vi.fn()}
      onCopied={vi.fn()}
    />,
  );
}

describe('DataHistoryPayloadTab copy failures', () => {
  beforeEach(() => {
    readDataHistoryFileMock.mockReset();
    copyPayloadMock.mockReset();
    readDataHistoryFileMock.mockResolvedValue({
      blob: new Blob([NON_TABULAR_JSON], { type: 'application/json' }),
      contentType: 'application/json',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The regression: a rejected copy FORMAT was stored in the same state that gates `disabled`, so a
   * failed "copy as CSV" left Download and every copy control permanently disabled behind a banner
   * the user could not dismiss — with the payload itself perfectly readable.
   */
  it('keeps the controls usable after a copy is rejected for the wrong format', async () => {
    copyPayloadMock.mockResolvedValue({
      success: false,
      error: { type: 'warning', message: 'This data is not in a table format. Copy it as JSON instead.' },
    });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /Copy to Clipboard/ }));

    await waitFor(() => expect(screen.getByText(/not in a table format/)).toBeTruthy());

    expect(screen.getByRole('button', { name: /Download/ })).not.toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Copy to Clipboard/ })).not.toHaveProperty('disabled', true);
  });

  /** A payload we read in full and could not tabulate can only be copied as JSON — so only offer that */
  it('copies as JSON, not a spreadsheet format, when the payload is known to be non-tabular', async () => {
    copyPayloadMock.mockResolvedValue({ success: true });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: /Copy to Clipboard/ }));

    await waitFor(() => expect(copyPayloadMock).toHaveBeenCalled());
    expect(copyPayloadMock.mock.calls[0][2]).toBe('json');
  });

  /** A genuine read failure SHOULD disable the controls — there is nothing to act on */
  it('disables the controls when the payload itself cannot be read', async () => {
    readDataHistoryFileMock.mockResolvedValue(null);
    renderTab();

    await waitFor(() => expect(screen.getByText(/no longer available on this device/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Download/ })).toHaveProperty('disabled', true);
  });
});

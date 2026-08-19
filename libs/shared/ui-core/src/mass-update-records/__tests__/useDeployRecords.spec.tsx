import { Blob as NodeBlob } from 'node:buffer';

import { SalesforceOrgUi } from '@jetstream/types';
import { deleteDataHistoryEntry, initDataHistory, setHistoryFileStoreForTests } from '@jetstream/ui/data-history';
import { FakeFileStore } from '@jetstream/ui/data-history/testing';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataRow, MetadataRowConfiguration } from '../mass-update-records.types';
import { useDeployRecords } from '../useDeployRecords';

const SPEC_USER_ID = 'spec-user-id';

// The deployment must still be in flight when the host unmounts, so the query never settles.
const { queryAndPrepareMock } = vi.hoisted(() => ({ queryAndPrepareMock: vi.fn() }));
vi.mock('../mass-update-records.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mass-update-records.utils')>()),
  queryAndPrepareRecordsForUpdate: queryAndPrepareMock,
}));
vi.mock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent: vi.fn() }) }));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  useBrowserNotifications: () => ({ notifyUser: vi.fn() }),
}));

// jsdom's Blob does not interoperate with Node's CompressionStream (cross-realm web streams).
globalThis.Blob = NodeBlob as unknown as typeof Blob;

const org = { uniqueId: 'org-unmount-1', label: 'Unmount Org' } as SalesforceOrgUi;
const configuration: MetadataRowConfiguration[] = [
  { selectedField: 'Industry', transformationOptions: { option: 'staticValue', staticValue: 'Tech', criteria: 'all', whereClause: '' } },
];
const row = {
  sobject: 'Account',
  configuration,
  deployResults: { status: 'Not Started', done: false, records: [], batchIdToIndex: {}, processingErrors: [] },
} as unknown as MetadataRow;

describe('useDeployRecords Data History lifecycle', () => {
  beforeAll(async () => {
    await initDataHistory({ userId: SPEC_USER_ID, hasPaidPlan: true });
  });

  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    setHistoryFileStoreForTests(new FakeFileStore());
    queryAndPrepareMock.mockReset();
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  /**
   * The regression: unmounting mid-deployment left the entry `in-progress` and its key in the
   * active-entry set forever, so the user could never delete it and migrations always skipped it.
   */
  it('settles an in-flight entry when the host unmounts mid-deployment', async () => {
    queryAndPrepareMock.mockReturnValue(new Promise(() => undefined));

    const { result, unmount } = renderHook(() => useDeployRecords(org, vi.fn(), 'STAND-ALONE'));
    void result.current.loadDataForRows([row], { batchSize: 200, serialMode: false });

    // The row is written before the query is awaited, so it exists while the deployment hangs
    const key = await vi.waitFor(async () => {
      const [entry] = await dataHistoryDb.getEntries({});
      expect(entry?.status).toBe('in-progress');
      return entry.key;
    });

    unmount();

    // `incomplete`, not `failed`: the outcome is unknown — a submitted job finishes on Salesforce regardless
    await vi.waitFor(async () => {
      expect((await dataHistoryDb.getEntry(key))?.status).toBe('incomplete');
    });
    // The symptom the user hits: a stranded entry refuses to delete with "still being written"
    expect(await deleteDataHistoryEntry(key)).toEqual({ deleted: true });
  });
});

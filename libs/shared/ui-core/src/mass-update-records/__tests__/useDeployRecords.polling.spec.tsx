import { ApiRequestError } from '@jetstream/shared/data';
import { BulkJobWithBatches, SalesforceOrgUi } from '@jetstream/types';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeployResults } from '../mass-update-records.types';
import { useDeployRecords } from '../useDeployRecords';

const { bulkApiGetJobMock, notifyUserMock, trackerErrorMock } = vi.hoisted(() => ({
  bulkApiGetJobMock: vi.fn(),
  notifyUserMock: vi.fn(),
  trackerErrorMock: vi.fn(),
}));

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  bulkApiGetJob: bulkApiGetJobMock,
}));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  useBrowserNotifications: () => ({ notifyUser: notifyUserMock }),
  tracker: { error: trackerErrorMock },
}));
vi.mock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent: vi.fn() }) }));
vi.mock('../data-history-capture', () => ({ startMassUpdateHistory: vi.fn(), captureMassUpdateResults: vi.fn() }));

const POLL_INTERVAL_MS = 5000;

const org = { uniqueId: 'org-polling-1', label: 'Polling Org' } as SalesforceOrgUi;

const runningJob = {
  id: 'job-1',
  state: 'Closed',
  batches: [{ id: 'batch-1', state: 'InProgress' }],
} as BulkJobWithBatches;
const completedJob = {
  id: 'job-1',
  state: 'Closed',
  batches: [{ id: 'batch-1', state: 'Completed' }],
} as BulkJobWithBatches;

/** A deployment whose single batch was submitted, holding the hook's latest results the way the jotai hosts do */
function setupDeployment() {
  let deployResults: DeployResults = {
    status: 'In Progress',
    done: false,
    records: [{ Id: '0010000000001' }],
    jobInfo: runningJob,
    batchIdToIndex: { 'batch-1': 0 },
    processingErrors: [],
  };
  const getRows = () => [{ sobject: 'Account', deployResults }];
  const onDeployResults = vi.fn((sobject: string, results: DeployResults) => {
    deployResults = results;
  });
  const { result } = renderHook(() => useDeployRecords(org, onDeployResults, 'STAND-ALONE'));
  return { hook: result, getRows, getDeployResults: () => deployResults };
}

describe('useDeployRecords status polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps polling through a transient status check failure', async () => {
    bulkApiGetJobMock.mockRejectedValueOnce(new ApiRequestError('The connection to Salesforce failed (ECONNRESET).', 502));
    bulkApiGetJobMock.mockResolvedValueOnce(completedJob);
    const { hook, getRows, getDeployResults } = setupDeployment();

    const polling = hook.current.pollResultsUntilDone(getRows);
    // The first check fails, then is repeated one interval later
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    await polling;

    expect(bulkApiGetJobMock).toHaveBeenCalledTimes(2);
    expect(getDeployResults()).toMatchObject({ done: true, status: 'Finished' });
    expect(getDeployResults().statusCheckFailed).toBeFalsy();
    expect(trackerErrorMock).not.toHaveBeenCalled();
    expect(notifyUserMock).toHaveBeenCalledWith('Updating records has finished', expect.anything());
  });

  /**
   * The regression: one failed status check marked the job `Failed` and every unfinished batch `NotProcessed`,
   * even though Salesforce kept running the job, and left the user no way to look again.
   */
  it('keeps the last known job state when it gives up, and can pick polling back up', async () => {
    bulkApiGetJobMock.mockRejectedValueOnce(new ApiRequestError('Job not found', 400));
    const { hook, getRows, getDeployResults } = setupDeployment();

    const polling = hook.current.pollResultsUntilDone(getRows);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await polling;

    expect(bulkApiGetJobMock).toHaveBeenCalledTimes(1);
    expect(getDeployResults()).toMatchObject({ done: true, status: 'Error', statusCheckFailed: true, jobInfo: runningJob });
    expect(getDeployResults().fatalErrorMessage).toContain('the update itself is not affected');
    expect(notifyUserMock).toHaveBeenCalledWith('Unable to get the status of your update', expect.anything());

    bulkApiGetJobMock.mockResolvedValueOnce(completedJob);
    hook.current.resumePolling(getRows()[0], getRows);
    expect(getDeployResults()).toMatchObject({ done: false, status: 'In Progress', statusCheckFailed: false, fatalErrorMessage: null });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await vi.waitFor(() => expect(getDeployResults()).toMatchObject({ done: true, status: 'Finished', statusCheckFailed: false }));
  });
});

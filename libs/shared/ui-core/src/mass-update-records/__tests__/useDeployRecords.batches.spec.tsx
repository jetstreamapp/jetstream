import { SalesforceOrgUi } from '@jetstream/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeployResults, MetadataRowConfiguration } from '../mass-update-records.types';
import { useDeployRecords } from '../useDeployRecords';

const { bulkApiCreateJobMock, bulkApiAddBatchToJobMock, bulkApiCloseJobMock, trackerErrorMock } = vi.hoisted(() => ({
  bulkApiCreateJobMock: vi.fn(),
  bulkApiAddBatchToJobMock: vi.fn(),
  bulkApiCloseJobMock: vi.fn(),
  trackerErrorMock: vi.fn(),
}));

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  bulkApiCreateJob: bulkApiCreateJobMock,
  bulkApiAddBatchToJob: bulkApiAddBatchToJobMock,
  bulkApiCloseJob: bulkApiCloseJobMock,
}));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  useBrowserNotifications: () => ({ notifyUser: vi.fn() }),
  tracker: { error: trackerErrorMock },
}));
vi.mock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent: vi.fn() }) }));
// History capture is orthogonal to batch submission and needs Dexie + a file store to run for real
vi.mock('../data-history-capture', () => ({
  startMassUpdateHistory: () => ({
    setSubmittedCount: vi.fn(),
    writeInputRows: vi.fn(),
    fail: vi.fn(),
    finish: vi.fn(),
    abandonIfUnsettled: vi.fn(),
  }),
  captureMassUpdateResults: vi.fn(),
}));

const JOB_CLOSED_ERROR = `Failed to create batch, since the Job is not Open. Current job state is 'Closed'`;

const org = { uniqueId: 'org-batches-1', label: 'Batch Org' } as SalesforceOrgUi;
const configuration: MetadataRowConfiguration[] = [
  { selectedField: 'Industry', transformationOptions: { option: 'staticValue', staticValue: 'Tech', criteria: 'all', whereClause: '' } },
];
/** Three batches of two at a batch size of two */
const records = Array.from({ length: 6 }, (unused, i) => ({ Id: `001000000000${i}`, Industry: null }));

/** Run one deployment and return the final `DeployResults` the hook reported */
async function deployAndGetResults(): Promise<DeployResults> {
  const onDeployResults = vi.fn();
  const { result } = renderHook(() => useDeployRecords(org, onDeployResults, 'STAND-ALONE'));

  await result.current.loadDataForProvidedRecords({
    records,
    sobject: 'Account',
    fields: ['Id', 'Industry'],
    batchSize: 2,
    serialMode: false,
    configuration,
    skipHistory: true,
  });

  const [, deployResults] = onDeployResults.mock.calls[onDeployResults.mock.calls.length - 1];
  return deployResults;
}

describe('useDeployRecords batch submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkApiCreateJobMock.mockResolvedValue({ id: 'job-1', batches: [] });
    bulkApiAddBatchToJobMock.mockImplementation(async () => ({ id: `batch-${bulkApiAddBatchToJobMock.mock.calls.length}` }));
    bulkApiCloseJobMock.mockResolvedValue({ id: 'job-1', state: 'Closed' });
  });

  /**
   * The regression: a job Salesforce had already closed still got every remaining batch posted to it,
   * costing a doomed round trip and a duplicate error report per batch.
   */
  it('stops submitting batches once salesforce reports the job is no longer open', async () => {
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => ({ id: 'batch-1' }));
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      throw new Error(JOB_CLOSED_ERROR);
    });

    const deployResults = await deployAndGetResults();

    expect(bulkApiAddBatchToJobMock).toHaveBeenCalledTimes(2);
    expect(trackerErrorMock).toHaveBeenCalledTimes(1);
    // The rejected batch plus the batch that was never sent, so nothing is silently dropped
    expect(deployResults.processingErrors).toHaveLength(4);
    deployResults.processingErrors.forEach(({ errors }) => expect(errors).toEqual([JOB_CLOSED_ERROR]));
  });

  it('keeps submitting the remaining batches after a single batch fails for an unrelated reason', async () => {
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => ({ id: 'batch-1' }));
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      throw new Error('Request timed out');
    });

    const deployResults = await deployAndGetResults();

    expect(bulkApiAddBatchToJobMock).toHaveBeenCalledTimes(3);
    expect(deployResults.processingErrors).toHaveLength(2);
  });

  /**
   * The close rides on its own request rather than the final batch: `addBatchToJob` swallows a close
   * failure so the accepted batch survives, which makes a failed close on that path indistinguishable
   * from a successful one.
   */
  it('closes the job with a separate request rather than on the final batch', async () => {
    await deployAndGetResults();

    expect(bulkApiAddBatchToJobMock).toHaveBeenCalledTimes(3);
    expect(bulkApiAddBatchToJobMock.mock.calls.map(([, , , closeJob]) => closeJob)).toEqual([undefined, undefined, undefined]);
    expect(bulkApiCloseJobMock).toHaveBeenCalledTimes(1);
    expect(bulkApiCloseJobMock).toHaveBeenCalledWith(org, 'job-1');
  });

  /**
   * Stopping part way through would otherwise strand the job in `Open`, holding one of the org's job
   * slots until Salesforce expires it.
   */
  it('closes the job when it stops early on a fatal error', async () => {
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      throw new Error(JOB_CLOSED_ERROR);
    });

    await deployAndGetResults();

    expect(bulkApiAddBatchToJobMock).toHaveBeenCalledTimes(1);
    expect(bulkApiCloseJobMock).toHaveBeenCalledWith(org, 'job-1');
  });

  it('closes the job when the final batch itself fails', async () => {
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => ({ id: 'batch-1' }));
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => ({ id: 'batch-2' }));
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      throw new Error('Request timed out');
    });

    await deployAndGetResults();

    expect(bulkApiCloseJobMock).toHaveBeenCalledWith(org, 'job-1');
  });

  /**
   * The unmount path `return`s out of the middle of the batch loop, which skipped the cleanup and left
   * the job Open with nothing left running that would ever close it.
   */
  it('closes the job when the host unmounts part way through the load', async () => {
    let unmountHost = () => undefined as void;
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      // Unmount after the first batch lands, so the loop bails on its next iteration
      unmountHost();
      return { id: 'batch-1' };
    });

    const { result, unmount } = renderHook(() => useDeployRecords(org, vi.fn(), 'STAND-ALONE'));
    unmountHost = unmount;

    await result.current.loadDataForProvidedRecords({
      records,
      sobject: 'Account',
      fields: ['Id', 'Industry'],
      batchSize: 2,
      serialMode: false,
      configuration,
      skipHistory: true,
    });

    expect(bulkApiAddBatchToJobMock).toHaveBeenCalledTimes(1);
    expect(bulkApiCloseJobMock).toHaveBeenCalledWith(org, 'job-1');
  });

  it('does not surface a failed cleanup close to the user', async () => {
    bulkApiAddBatchToJobMock.mockImplementationOnce(async () => {
      throw new Error(JOB_CLOSED_ERROR);
    });
    bulkApiCloseJobMock.mockRejectedValue(new Error('Job already closed'));

    const deployResults = await deployAndGetResults();

    expect(deployResults.status).toBe('In Progress');
    expect(bulkApiCloseJobMock).toHaveBeenCalledTimes(1);
  });
});

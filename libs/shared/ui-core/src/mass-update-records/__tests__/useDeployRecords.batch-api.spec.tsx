import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeployResults, MetadataRowConfiguration } from '../mass-update-records.types';
import { useDeployRecords } from '../useDeployRecords';

const { bulkApiCreateJobMock, sobjectOperationMock, appendResultsRowsMock, finishMock, startMassUpdateHistoryMock } = vi.hoisted(() => ({
  bulkApiCreateJobMock: vi.fn(),
  sobjectOperationMock: vi.fn(),
  appendResultsRowsMock: vi.fn(),
  finishMock: vi.fn(),
  startMassUpdateHistoryMock: vi.fn(),
}));

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  bulkApiCreateJob: bulkApiCreateJobMock,
  sobjectOperation: sobjectOperationMock,
}));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  useBrowserNotifications: () => ({ notifyUser: vi.fn() }),
  tracker: { error: vi.fn() },
}));
// History capture needs Dexie + a file store to run for real, so only the calls made to it are asserted
vi.mock('../data-history-capture', () => ({
  startMassUpdateHistory: startMassUpdateHistoryMock,
  captureMassUpdateResults: vi.fn(),
}));

const org = { uniqueId: 'org-batch-api-1', label: 'Batch API Org' } as SalesforceOrgUi;
const configuration: MetadataRowConfiguration[] = [
  {
    selectedField: 'Email',
    transformationOptions: { option: 'staticValue', staticValue: 'a@example.com', criteria: 'all', whereClause: '' },
  },
];
const RECORD_COUNT = 450;
const records = Array.from({ length: RECORD_COUNT }, (unused, i) => ({ Id: `003${String(i).padStart(12, '0')}`, Email: null }));

/** Run one deployment that bypasses duplicate rules and return the final `DeployResults` the hook reported */
async function deployAndGetResults(
  options: { batchSize?: number; recordsToLoad?: Record<string, unknown>[]; fields?: string[] } = {},
): Promise<DeployResults> {
  const onDeployResults = vi.fn();
  const { result } = renderHook(() => useDeployRecords(org, onDeployResults, 'STAND-ALONE'));

  await result.current.loadDataForProvidedRecords({
    records: options.recordsToLoad ?? records,
    sobject: 'Contact',
    fields: options.fields ?? ['Id', 'Email'],
    batchSize: options.batchSize ?? 10000,
    serialMode: false,
    bypassDuplicateRules: true,
    configuration,
  });

  const [, deployResults] = onDeployResults.mock.calls[onDeployResults.mock.calls.length - 1];
  return deployResults;
}

describe('useDeployRecords with duplicate rules bypassed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMassUpdateHistoryMock.mockReturnValue({
      setSubmittedCount: vi.fn(),
      writeInputRows: vi.fn(),
      appendResultsRows: appendResultsRowsMock,
      fail: vi.fn(),
      finish: finishMock,
      abandonIfUnsettled: vi.fn(),
    });
    sobjectOperationMock.mockImplementation(async (unusedOrg, unusedSobject, unusedOperation, { records: batch }) =>
      batch.map(({ Id }: { Id: string }) => ({ id: Id, success: true, errors: [] })),
    );
  });

  it('saves with the batch api and the duplicate rule bypass instead of creating a bulk job', async () => {
    const deployResults = await deployAndGetResults();

    expect(bulkApiCreateJobMock).not.toHaveBeenCalled();
    expect(sobjectOperationMock).toHaveBeenCalledTimes(3);
    sobjectOperationMock.mock.calls.forEach(([, sobject, operation, , query]) => {
      expect(sobject).toBe('Contact');
      expect(operation).toBe('update');
      expect(query).toEqual({ allOrNone: false, bypassDuplicateRules: true });
    });
    expect(deployResults.jobInfo).toBeUndefined();
    expect(deployResults.done).toBe(true);
    expect(deployResults.status).toBe('Finished');
  });

  it('caps each request at the batch api limit regardless of the bulk batch size', async () => {
    await deployAndGetResults({ batchSize: 10000 });

    expect(sobjectOperationMock.mock.calls.map(([, , , { records: batch }]) => batch.length)).toEqual([200, 200, 50]);
  });

  it('honors a batch size below the batch api limit', async () => {
    await deployAndGetResults({ batchSize: 150 });

    expect(sobjectOperationMock.mock.calls.map(([, , , { records: batch }]) => batch.length)).toEqual([150, 150, 150]);
  });

  it('sends only the updated fields, leaving blank fields alone and nulling fields marked for clearing', async () => {
    await deployAndGetResults({
      fields: ['Id', 'Email', 'Title'],
      recordsToLoad: [
        { Id: '003000000000001', Email: null, Title: SFDC_BULK_API_NULL_VALUE, Account: { Name: 'Source of another field' } },
      ],
    });

    const [, , , { records: submitted }] = sobjectOperationMock.mock.calls[0];
    // Email is a static value, so it is populated; Title was marked for clearing; Account was never a submitted field
    expect(submitted).toEqual([{ Id: '003000000000001', Email: 'a@example.com', Title: null }]);
  });

  it('reports per-record results in submit order with success and failure counts', async () => {
    sobjectOperationMock.mockImplementationOnce(async (unusedOrg, unusedSobject, unusedOperation, { records: batch }) =>
      batch.map(({ Id }: { Id: string }, i: number) =>
        i === 0
          ? { success: false, errors: [{ statusCode: 'DUPLICATES_DETECTED', message: 'Use one of these records?', fields: [] }] }
          : { id: Id, success: true, errors: [] },
      ),
    );

    const { batchApiResults } = await deployAndGetResults();

    expect(batchApiResults).toMatchObject({ total: RECORD_COUNT, success: RECORD_COUNT - 1, failure: 1 });
    expect(batchApiResults?.results).toHaveLength(RECORD_COUNT);
    expect(batchApiResults?.results[0]).toEqual({
      Id: records[0].Id,
      Success: false,
      Created: false,
      Error: 'DUPLICATES_DETECTED: Use one of these records?',
    });
    expect(batchApiResults?.results[RECORD_COUNT - 1]).toMatchObject({ Id: records[RECORD_COUNT - 1].Id, Success: true });
  });

  it('fails only the records in a request that errors and keeps saving the rest', async () => {
    sobjectOperationMock.mockImplementationOnce(async () => {
      throw new Error('Request timed out');
    });

    const { batchApiResults, status } = await deployAndGetResults();

    expect(sobjectOperationMock).toHaveBeenCalledTimes(3);
    expect(status).toBe('Finished');
    expect(batchApiResults).toMatchObject({ total: RECORD_COUNT, success: 250, failure: 200 });
    expect(batchApiResults?.results[0]).toEqual({ Id: records[0].Id, Success: false, Created: false, Error: 'Request timed out' });
    expect(batchApiResults?.results[200].Success).toBe(true);
  });

  it('records the batch api and every result to data history', async () => {
    await deployAndGetResults();

    expect(startMassUpdateHistoryMock).toHaveBeenCalledWith(expect.objectContaining({ bypassDuplicateRules: true }));
    expect(appendResultsRowsMock).toHaveBeenCalledTimes(3);
    const [rows, header] = appendResultsRowsMock.mock.calls[0];
    expect(header).toEqual(['_id', '_success', '_errors', 'Id', 'Email']);
    expect(rows[0]).toMatchObject({ _id: records[0].Id, _success: true, Email: 'a@example.com' });
    expect(finishMock).toHaveBeenCalledWith({ counts: { total: RECORD_COUNT, success: RECORD_COUNT, failure: 0 } });
  });

  it('stops sending requests once the host unmounts', async () => {
    const onDeployResults = vi.fn();
    const { result, unmount } = renderHook(() => useDeployRecords(org, onDeployResults, 'STAND-ALONE'));
    sobjectOperationMock.mockImplementationOnce(async (unusedOrg, unusedSobject, unusedOperation, { records: batch }) => {
      unmount();
      return batch.map(({ Id }: { Id: string }) => ({ id: Id, success: true, errors: [] }));
    });

    await result.current.loadDataForProvidedRecords({
      records,
      sobject: 'Contact',
      fields: ['Id', 'Email'],
      batchSize: 200,
      serialMode: false,
      bypassDuplicateRules: true,
      configuration,
    });

    expect(sobjectOperationMock).toHaveBeenCalledTimes(1);
    expect(finishMock).not.toHaveBeenCalled();
  });
});

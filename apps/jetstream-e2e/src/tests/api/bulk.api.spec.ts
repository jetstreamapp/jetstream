import { CreateJobRequest } from '@jetstream/api-types';
import { BulkJob, BulkJobBatchInfo, BulkJobWithBatches } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Bulk', () => {
  test('Job: Create,Get,Add Batch', async ({ apiRequestUtils }) => {
    const createJobResponse = await apiRequestUtils.makeRequest<BulkJob>('POST', `/api/bulk`, {
      externalId: null,
      serialMode: false,
      sObject: 'LEAD',
      type: 'INSERT',
    } as CreateJobRequest);

    expect(createJobResponse.id).toBeTruthy();
    expect(createJobResponse.apiVersion).toBeTruthy();
    expect(createJobResponse.object).toEqual('Lead');
    expect(createJobResponse.contentType).toEqual('CSV');
    expect(createJobResponse.operation).toEqual('insert');
    expect(createJobResponse.state).toEqual('Open');

    const getJobResponse = await apiRequestUtils.makeRequest<BulkJobWithBatches>('GET', `/api/bulk/${createJobResponse.id}`);

    expect(getJobResponse.id).toBeTruthy();
    expect(getJobResponse.numberRecordsProcessed).toEqual(0);
    expect(getJobResponse.state).toEqual('Open');
    expect(Array.isArray(getJobResponse.batches)).toBeTruthy();
    expect(getJobResponse.batches.length).toEqual(0);

    const timestamp = new Date().getTime();
    const addBatchToJobResponse = await apiRequestUtils.makeRequest<BulkJobBatchInfo>(
      'POST',
      `/api/bulk/${createJobResponse.id}?${new URLSearchParams({
        closeJob: 'true',
      })}`,
      [
        `"LastName";"FirstName";"Title";"Company";"State";"Country";"Email";"LeadSource";"Status"`,
        `"Snyder-${timestamp}";"Kathy";"Regional General Manager ${timestamp}";"TNR Corp. ${timestamp}";"CT";"USA";"ksynder@tnr.${timestamp}.net";"Purchased List";"Working - Contacted"`,
      ].join('\n')
    );

    expect(addBatchToJobResponse.id).toBeTruthy();
    expect(['Queued', 'InProgress', 'Completed'].includes(addBatchToJobResponse.state)).toBeTruthy();

    const getJobResponse2 = await apiRequestUtils.makeRequest<BulkJobBatchInfo>('GET', `/api/bulk/${createJobResponse.id}`);

    expect(getJobResponse2.id).toBeTruthy();
    expect(getJobResponse2.state).toEqual('Closed');
  });

  test('Query Job', async ({ apiRequestUtils }) => {
    const createJobResponse = await apiRequestUtils.makeRequest<BulkJob>('POST', `/api/bulk`, {
      externalId: null,
      serialMode: false,
      sObject: 'LEAD',
      type: 'QUERY_ALL',
    } as CreateJobRequest);

    expect(createJobResponse.id).toBeTruthy();
    expect(createJobResponse.apiVersion).toBeTruthy();
    expect(createJobResponse.object).toEqual('Lead');
    expect(createJobResponse.contentType).toEqual('CSV');
    expect(createJobResponse.operation).toEqual('queryAll');
    expect(createJobResponse.state).toEqual('Open');

    const addBatchToJobResponse = await apiRequestUtils.makeRequest<BulkJobBatchInfo>(
      'POST',
      `/api/bulk/${createJobResponse.id}?${new URLSearchParams({
        closeJob: 'true',
      })}`,
      `SELECT Id, Name, AnnualRevenue, City, Company, Country, CreatedDate, Description, Email, IsConverted, IsDeleted FROM Lead`
    );

    expect(addBatchToJobResponse.id).toBeTruthy();
    expect(['Queued', 'InProgress', 'Completed'].includes(addBatchToJobResponse.state)).toBeTruthy();

    const getJobResponse2 = await apiRequestUtils.makeRequest<BulkJobBatchInfo>('GET', `/api/bulk/${createJobResponse.id}`);

    expect(getJobResponse2.id).toBeTruthy();
    expect(getJobResponse2.state).toEqual('Closed');
  });
});

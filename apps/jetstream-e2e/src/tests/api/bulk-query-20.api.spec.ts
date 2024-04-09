import { CreateQueryJobRequest } from '@jetstream/api-types';
import { BulkQuery20Job, BulkQuery20JobResults, BulkQuery20Response } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Bulk Query 2.0', () => {
  /**
   * This test is super flaky because it relies on how fast salesforce starts processing the job
   */
  test.skip('Create and get job', async ({ apiRequestUtils }) => {
    const createJobResponse = await apiRequestUtils.makeRequest<BulkQuery20Response>('POST', `/api/bulk-query`, {
      query: `SELECT Id, Name, AnnualRevenue, City, Company, Country, CreatedDate, Description, Email, IsConverted, IsDeleted FROM Lead`,
      queryAll: true,
    } as CreateQueryJobRequest);

    expect(createJobResponse.id).toBeTruthy();
    expect(createJobResponse.apiVersion).toBeTruthy();
    expect(createJobResponse.object).toEqual('Lead');
    expect(createJobResponse.contentType).toEqual('CSV');
    expect(createJobResponse.operation).toEqual('queryAll');
    expect(['UploadComplete', 'InProgress', 'JobComplete'].includes(createJobResponse.state)).toBeTruthy();

    const getJobResponse = await apiRequestUtils.makeRequest<BulkQuery20Job>('GET', `/api/bulk-query/${createJobResponse.id}`);

    expect(getJobResponse.id).toBeTruthy();
    // FIXME: sometimes getJobResponse.numberRecordsProcessed is undefined :shrug:
    expect(getJobResponse.numberRecordsProcessed).toEqual(0);
    expect(['UploadComplete', 'InProgress', 'JobComplete'].includes(getJobResponse.state)).toBeTruthy();

    const getJobResponse2 = await apiRequestUtils.makeRequest<BulkQuery20Response>('POST', `/api/bulk-query/${createJobResponse.id}/abort`);
    expect(getJobResponse2.id).toBeTruthy();
    expect(getJobResponse2.state).toEqual('Aborted');

    const getJobResponse3 = await apiRequestUtils.makeRequestRaw('DELETE', `/api/bulk-query/${createJobResponse.id}`);
    expect(getJobResponse3.status()).toEqual(204);
  });

  test('Get all jobs', async ({ apiRequestUtils }) => {
    const allJobs = await apiRequestUtils.makeRequest<BulkQuery20JobResults>('GET', `/api/bulk-query`);

    expect(typeof allJobs.done === 'boolean').toBeTruthy();
    expect(Array.isArray(allJobs.records)).toBeTruthy();
  });

  // TODO: there isn't a great way of testing query results because it takes a long time to run
});

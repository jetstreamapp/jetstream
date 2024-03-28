import { HTTP } from '@jetstream/shared/constants';
import { BulkQuery20Job, BulkQuery20JobResults, BulkQuery20Response, Maybe } from '@jetstream/types';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiBulkQuery20 extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async createJob(query: string, queryAll = false) {
    // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/query_create_job.htm
    return this.apiRequest<BulkQuery20Response>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl('/jobs/query'),
      method: 'POST',
      body: {
        operation: queryAll ? 'queryAll' : 'query',
        query,
        contentType: 'CSV',
        columnDelimiter: 'COMMA',
        lineEnding: 'LF',
      },
    });
  }

  async getJobs({
    isPkChunkingEnabled,
    jobType,
    concurrencyMode,
    queryLocator,
  }: {
    isPkChunkingEnabled?: boolean;
    jobType?: Maybe<'Classic' | 'V2Query' | 'V2Ingest'>;
    concurrencyMode?: Maybe<'parallel'>;
    queryLocator?: Maybe<string>;
  } = {}) {
    const params = new URLSearchParams();
    if (isPkChunkingEnabled) {
      params.set('isPkChunkingEnabled', isPkChunkingEnabled.toString());
    }
    if (jobType) {
      params.set('jobType', jobType);
    }
    if (concurrencyMode) {
      params.set('concurrencyMode', concurrencyMode);
    }
    if (queryLocator) {
      params.set('queryLocator', queryLocator);
    }
    return this.apiRequest<BulkQuery20JobResults>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(`/jobs/query?${params.toString()}`),
      method: 'GET',
    });
  }

  async getJob(jobId: string) {
    return this.apiRequest<BulkQuery20Job>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(`/jobs/query/${jobId}`),
      method: 'GET',
    });
  }

  async getResults(jobId: string, { locator, maxRecords }: { locator?: string; maxRecords?: number }) {
    const params = new URLSearchParams();
    if (locator) {
      params.set('locator', locator);
    }
    if (maxRecords) {
      params.set('maxRecords', maxRecords.toString());
    }
    // TODO: could we stream the results and query more automatically?
    // Headers returned: Sforce-NumberOfRecords, Sforce-Locator
    return this.apiRequest<Response>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(`/jobs/query/${jobId}/results?${params.toString()}`),
      method: 'GET',
      outputType: 'response',
      headers: {
        [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.CSV,
      },
    });
  }

  async *getResultsStream(jobId: string, maxRecords = 20000) {
    let locator;
    let isFirstChunk = true;

    do {
      const params = new URLSearchParams();
      if (locator) {
        params.set('locator', locator);
      }
      if (maxRecords) {
        params.set('maxRecords', maxRecords.toString());
      }
      const response = await this.apiRequest<Response>({
        sessionInfo: this.sessionInfo,
        url: this.getRestApiUrl(`/jobs/query/${jobId}/results?${params.toString()}`),
        method: 'GET',
        outputType: 'response',
        headers: {
          [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.CSV,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const text = await response.text();
      // FIXME: this will break if there are newlines in the CSV data - should migrate to papaparse
      const lines = text.split('\n');

      // For all chunks after the first, skip the CSV header.
      if (!isFirstChunk) {
        lines.shift(); // Remove the first line (header) of the CSV
      }

      isFirstChunk = false;
      locator = response.headers.get('Sforce-Locator');

      yield lines.join('\n');
    } while (locator && locator !== 'null');
  }

  async abortJob(jobId: string) {
    return this.apiRequest<BulkQuery20Job>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(`/jobs/query/${jobId}`),
      method: 'PATCH',
      body: { state: 'Aborted' },
    });
  }

  async deleteJob(jobId: string) {
    return this.apiRequest<void>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(`/jobs/query/${jobId}`),
      method: 'DELETE',
      outputType: 'void',
    });
  }
}

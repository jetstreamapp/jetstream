import { HTTP } from '@jetstream/shared/constants';
import { bulkApiEnsureTyped, ensureArray } from '@jetstream/shared/utils';
import {
  BulkApiCreateJobRequestPayload,
  BulkApiDownloadType,
  BulkJobBatchInfoUntyped,
  BulkJobUntyped,
  BulkJobWithBatches,
} from '@jetstream/types';
import { ApiConnection } from './connection';
import { SalesforceApi, prepareBulkApiRequestPayload, prepareCloseOrAbortJobPayload } from './utils';

export class ApiBulk extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async createJob(options: BulkApiCreateJobRequestPayload) {
    const result = await this.apiRequest<{ jobInfo: BulkJobUntyped }>({
      sessionInfo: this.sessionInfo,
      url: this.getBulkApiUrl('/job'),
      method: 'POST',
      body: prepareBulkApiRequestPayload(options),
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV, Accept: HTTP.CONTENT_TYPE.XML },
      outputType: 'xml',
    }).then(({ jobInfo }) => bulkApiEnsureTyped(jobInfo));

    return result;
  }

  async getJob(jobId: string): Promise<BulkJobWithBatches> {
    const [jobResults, batchesResults] = await Promise.all([
      this.apiRequest<{ jobInfo: BulkJobUntyped }>({
        sessionInfo: this.sessionInfo,
        url: this.getBulkApiUrl(`/job/${jobId}`),
        outputType: 'xml',
        headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.XML, Accept: HTTP.CONTENT_TYPE.XML },
      }).then(({ jobInfo }) => bulkApiEnsureTyped(jobInfo)),
      this.apiRequest<{ batchInfoList: { batchInfo: BulkJobBatchInfoUntyped[] } }>({
        sessionInfo: this.sessionInfo,
        url: this.getBulkApiUrl(`/job/${jobId}/batch`),
        method: 'GET',
        outputType: 'xml',
        headers: { Accept: HTTP.CONTENT_TYPE.XML },
      })
        .then(({ batchInfoList }) => ensureArray(batchInfoList.batchInfo))
        .then((batchInfoItems) => batchInfoItems.map((batchInfo) => bulkApiEnsureTyped(batchInfo))),
    ]);

    return { ...jobResults, batches: batchesResults || [] };
  }

  async closeJob(jobId: string, state: 'Closed' | 'Aborted' = 'Closed') {
    const result = await this.apiRequest<{ jobInfo: BulkJobUntyped }>({
      sessionInfo: this.sessionInfo,
      url: this.getBulkApiUrl(`/job/${jobId}`),
      method: 'POST',
      body: prepareCloseOrAbortJobPayload(state),
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV, Accept: HTTP.CONTENT_TYPE.XML },
      outputType: 'xml',
    }).then(({ jobInfo }) => bulkApiEnsureTyped(jobInfo));

    return result;
  }

  async addBatchToJob(
    body: string | Buffer | ArrayBuffer,
    jobId: string,
    closeJob = false,
    contentType: typeof HTTP.CONTENT_TYPE.CSV | typeof HTTP.CONTENT_TYPE.ZIP_CSV = HTTP.CONTENT_TYPE.CSV
  ) {
    const result = await this.apiRequest<{ batchInfo: BulkJobBatchInfoUntyped }>({
      sessionInfo: this.sessionInfo,
      url: this.getBulkApiUrl(`/job/${jobId}/batch`),
      method: 'POST',
      body,
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: contentType, Accept: HTTP.CONTENT_TYPE.XML },
      outputType: 'xml',
      rawBody: true,
    }).then(({ batchInfo }) => bulkApiEnsureTyped(batchInfo));

    if (closeJob) {
      await this.closeJob(jobId, 'Closed');
    }

    return result;
  }

  async getQueryResultsJobIds(jobId: string, batchId: string): Promise<string[]> {
    const results = await this.apiRequest<{ 'result-list': { result: string | string[] } }>({
      sessionInfo: this.sessionInfo,
      url: this.getBulkApiUrl(`/job/${jobId}/batch/${batchId}/result`),
      method: 'GET',
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.XML_UTF8, Accept: HTTP.CONTENT_TYPE.XML },
      outputType: 'xml',
    }).then((resultXml) => ensureArray(resultXml?.['result-list']?.result));
    return results;
  }

  // Stream results from SFDC to user
  async downloadRecords(
    jobId: string,
    batchId: string,
    type: BulkApiDownloadType,
    /** For query jobs, an id is required */
    resultId?: string
  ) {
    const urlSuffix = resultId ? `/${resultId}` : '';
    const results = await this.apiRequest<ReadableStream<Uint8Array>>({
      sessionInfo: this.sessionInfo,
      url: this.getBulkApiUrl(`/job/${jobId}/batch/${batchId}/${type}${urlSuffix}`),
      method: 'GET',
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.XML_UTF8, Accept: HTTP.CONTENT_TYPE.CSV },
      outputType: 'stream',
    });
    return results;
  }
}

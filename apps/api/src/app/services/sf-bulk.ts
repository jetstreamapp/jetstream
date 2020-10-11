import * as jsforce from 'jsforce';
import { create as xmlBuilder } from 'xmlbuilder2';
import * as request from 'superagent';
import { HTTP } from '@jetstream/shared/constants';
import { bulkApiEnsureTyped, ensureArray } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, BulkJobUntyped, BulkJobBatchInfoUntyped, BulkJobWithBatches, BulkJob } from '@jetstream/types';

const { HEADERS, CONTENT_TYPE } = HTTP;

export async function SfBulkCreateJob(conn: jsforce.Connection, options: BulkApiCreateJobRequestPayload): Promise<BulkJob> {
  const { type, sObject, serialMode, externalId } = options;
  // prettier-ignore
  const jobInfoNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
      .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
        .ele('operation').txt(type.toLowerCase()).up()
        .ele('object').txt(sObject).up()
        .ele('concurrencyMode').txt(serialMode ? 'Serial' : 'Parallel').up()
        .ele('contentType').txt('CSV').up();

  if (type === 'UPSERT') {
    jobInfoNode.ele('externalIdFieldName').txt(externalId).up();
  }

  const xml = jobInfoNode.end({ prettyPrint: true });

  const requestOptions: jsforce.RequestInfo = {
    method: 'POST',
    url: `/services/async/${conn.version}/job`,
    body: xml,
    headers: { [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken },
  };

  const results = await conn
    .request(requestOptions, { responseType: 'text/xml' })
    .then(({ jobInfo }: { jobInfo: BulkJobUntyped }) => bulkApiEnsureTyped(jobInfo));

  return results;
}

export async function SfBulkGetJobInfo(conn: jsforce.Connection, jobId: string): Promise<BulkJobWithBatches> {
  const requestOptions: jsforce.RequestInfo = {
    method: 'GET',
    url: `/services/async/${conn.version}/job/${jobId}`,
    headers: { Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken },
  };
  const requestOptionsBatch: jsforce.RequestInfo = {
    ...requestOptions,
    url: `/services/async/${conn.version}/job/${jobId}/batch`,
  };

  const [jobResults, batchesResults] = await Promise.all([
    conn
      .request(requestOptions, { responseType: 'text/xml' })
      .then(({ jobInfo }: { jobInfo: BulkJobUntyped }) => bulkApiEnsureTyped(jobInfo)),
    conn
      .request(requestOptionsBatch, { responseType: 'text/xml' })
      .then(({ batchInfoList }: { batchInfoList: { batchInfo: BulkJobBatchInfoUntyped[] } }) => ensureArray(batchInfoList.batchInfo))
      .then((batchInfoItems) => batchInfoItems.map((batchInfo) => bulkApiEnsureTyped(batchInfo))),
  ]);

  return { ...jobResults, batches: batchesResults || [] };
}

export async function SfBulkCloseJob(conn: jsforce.Connection, jobId: string): Promise<BulkJob> {
  // prettier-ignore
  const xml = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
      .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
        .ele('state').txt('Closed').up()
      .end({ prettyPrint: true });

  const requestOptions: jsforce.RequestInfo = {
    method: 'POST',
    url: `/services/async/${conn.version}/job/${jobId}`,
    body: xml,
    headers: { [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken },
  };

  const results = await conn
    .request(requestOptions, { responseType: 'text/xml' })
    .then(({ jobInfo }: { jobInfo: BulkJobUntyped }) => bulkApiEnsureTyped(jobInfo));

  return results;
}

export async function SfBulkAddBatchToJob(
  conn: jsforce.Connection,
  csv: string | Buffer | ArrayBuffer,
  jobId: string,
  closeJob = false
): Promise<void> {
  await request
    .post(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch`)
    .set({ [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken })
    .send(csv);

  if (closeJob) {
    await SfBulkCloseJob(conn, jobId);
  }
}

export function sfBulkDownloadRecords(
  conn: jsforce.Connection,
  jobId: string,
  batchId: string,
  type: 'request' | 'result'
): request.SuperAgentRequest {
  return request
    .get(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch/${batchId}/${type}`)
    .set({ [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.XML_UTF8, Accept: CONTENT_TYPE.CSV, [HEADERS.X_SFDC_Session]: conn.accessToken });
}

import { HTTP } from '@jetstream/shared/constants';
import { bulkApiEnsureTyped, ensureArray } from '@jetstream/shared/utils';
import {
  BulkApiCreateJobRequestPayload,
  BulkJob,
  BulkJobBatchInfo,
  BulkJobBatchInfoUntyped,
  BulkJobUntyped,
  BulkJobWithBatches,
} from '@jetstream/types';
import * as jsforce from 'jsforce';
import isString from 'lodash/isString';
import fetch from 'node-fetch';
import { create as xmlBuilder, convert as xmlConverter } from 'xmlbuilder2';

const { HEADERS, CONTENT_TYPE } = HTTP;

export async function sfBulkCreateJob(conn: jsforce.Connection, options: BulkApiCreateJobRequestPayload): Promise<BulkJob> {
  const { type, sObject, assignmentRuleId, serialMode, externalId, hasZipAttachment } = options;
  // prettier-ignore
  const jobInfoNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
      .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
        .ele('operation').txt(type.toLowerCase()).up()
        .ele('object').txt(sObject).up();

  if (type === 'UPSERT' && externalId) {
    jobInfoNode.ele('externalIdFieldName').txt(externalId).up();
  }

  // job fails if these come before externalIdFieldName
  // prettier-ignore
  jobInfoNode.ele('concurrencyMode').txt(serialMode ? 'Serial' : 'Parallel').up();

  if (hasZipAttachment) {
    jobInfoNode.ele('contentType').txt('ZIP_CSV').up();
  } else {
    jobInfoNode.ele('contentType').txt('CSV').up();
  }

  // If this does not come last, Salesforce explodes
  if (isString(assignmentRuleId) && assignmentRuleId) {
    jobInfoNode.ele('assignmentRuleId').txt(assignmentRuleId).up();
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

export async function sfBulkGetJobInfo(conn: jsforce.Connection, jobId: string): Promise<BulkJobWithBatches> {
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

export async function sfBulkCloseOrAbortJob(
  conn: jsforce.Connection,
  jobId: string,
  state: 'Closed' | 'Aborted' = 'Closed'
): Promise<BulkJob> {
  // prettier-ignore
  const xml = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
      .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
        .ele('state').txt(state).up()
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

export async function sfBulkAddBatchToJob(
  conn: jsforce.Connection,
  csv: string | Buffer | ArrayBuffer,
  jobId: string,
  closeJob = false
): Promise<BulkJobBatchInfo> {
  const results = await fetch(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch`, {
    method: 'POST',
    headers: { [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken },
    body: csv,
  }).then(async (res) => {
    // TODO: do I need to do this?
    // if(res.status < 200 || res.status > 299) {
    //   throw new Error(await res.text());
    // }
    const resultXml = xmlConverter(await res.text(), { format: 'object', wellFormed: true }) as any;
    const bulkJob = bulkApiEnsureTyped(resultXml.batchInfo);
    return bulkJob;
  });

  // const results = await request
  //   .post(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch`)
  //   .set({ [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken })
  //   .send(csv)
  //   .then((res) => {
  //     const resultXml = xmlConverter((res.body as Buffer).toString(), { format: 'object', wellFormed: true }) as any;
  //     const bulkJob = bulkApiEnsureTyped(resultXml.batchInfo);
  //     return bulkJob;
  //   });

  if (closeJob) {
    await sfBulkCloseOrAbortJob(conn, jobId, 'Closed');
  }
  return results;
}

export async function sfBulkAddBatchWithZipAttachmentToJob(
  conn: jsforce.Connection,
  zip: Buffer | ArrayBuffer,
  jobId: string,
  closeJob = false
): Promise<BulkJobBatchInfo> {
  const results = await fetch(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch`, {
    method: 'POST',
    headers: { [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.ZIP_CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken },
    body: zip,
  }).then(async (res) => {
    // TODO: do I need to do this?
    // if(res.status < 200 || res.status > 299) {
    //   throw new Error(await res.text());
    // }
    const resultXml = xmlConverter(await res.text(), { format: 'object', wellFormed: true }) as any;
    const bulkJob = bulkApiEnsureTyped(resultXml.batchInfo);
    return bulkJob;
  });

  // const results = await request
  //   .post(`${conn.instanceUrl}/services/async/${conn.version}/job/${jobId}/batch`)
  //   .set({ [HEADERS.CONTENT_TYPE]: CONTENT_TYPE.ZIP_CSV, Accept: CONTENT_TYPE.XML, [HEADERS.X_SFDC_Session]: conn.accessToken })
  //   .send(zip)
  //   .then((res) => {
  //     const resultXml = xmlConverter((res.body as Buffer).toString(), { format: 'object', wellFormed: true }) as any;
  //     const bulkJob = bulkApiEnsureTyped(resultXml.batchInfo);
  //     return bulkJob;
  //   });

  if (closeJob) {
    await sfBulkCloseOrAbortJob(conn, jobId, 'Closed');
  }
  return results;
}

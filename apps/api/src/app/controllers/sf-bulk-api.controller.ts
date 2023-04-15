import { logger } from '@jetstream/api-config';
import * as services from '@jetstream/server-services';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, toBoolean } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, BulkApiDownloadType, BulkJobBatchInfo } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { sfBulkDownloadRecords, sfBulkGetQueryResultsJobIds } from '../services/sf-bulk';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  createJob: [
    body('type').isIn(['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'QUERY']),
    body('sObject').isString(),
    body('serialMode').optional().isBoolean(),
    body('externalIdFieldName').optional().isString(),
    body('externalId')
      .if(body('type').isIn(['UPSERT']))
      .isString(),
  ],
  getJob: [param('jobId').isString()],
  closeJob: [param('jobId').isString()],
  downloadResults: [
    param('jobId').isString(),
    param('batchId').isString(),
    query('type').isIn(['request', 'result']),
    query('isQuery').optional().isBoolean(),
  ],
  downloadResultsFile: [
    param('jobId').isString(),
    param('batchId').isString(),
    query('type').isIn(['request', 'result']),
    query('isQuery').optional().isBoolean(),
    query('fileName').optional().isString(),
  ],
  addBatchToJob: [param('jobId').isString(), body().exists({ checkNull: true }), query('closeJob').optional().toBoolean()],
  addBatchToJobWithBinaryAttachment: [
    param('jobId').isString(),
    body().exists({ checkNull: true }),
    query('closeJob').optional().toBoolean(),
  ],
};

// https://github.com/jsforce/jsforce/issues/934
export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const options = req.body as BulkApiCreateJobRequestPayload;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await services.sfBulkCreateJob(conn, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const jobInfo = await services.sfBulkGetJobInfo(conn, jobId);

    sendJson(res, jobInfo);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function closeOrAbortJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const action: 'Closed' | 'Aborted' = req.params.action === 'abort' ? 'Aborted' : 'Closed';
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const jobInfo = await services.sfBulkCloseOrAbortJob(conn, jobId, action);

    sendJson(res, jobInfo);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function addBatchToJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const csv = req.body;
    const closeJob = req.query.closeJob as any;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results: BulkJobBatchInfo = await services.sfBulkAddBatchToJob(conn, csv, jobId, closeJob);

    // try {
    //   results = await sfBulkGetJobInfo(conn, jobId);
    // } catch (ex) {
    //   // ignore error
    // }

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function addBatchToJobWithBinaryAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const zip = req.body;
    const closeJob = req.query.closeJob as any;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results: BulkJobBatchInfo = await services.sfBulkAddBatchWithZipAttachmentToJob(conn, zip, jobId, closeJob);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

/**
 * Download request or results as a CSV file directly streamed from SFDC
 * this should only be called from a link and not a JSON API call
 *
 *  This is not used AFAIK
 *
 */
export async function downloadResultsFile(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const batchId = req.params.batchId;
    const type = req.query.type as BulkApiDownloadType;
    const isQuery = ensureBoolean(req.query.isQuery as string);
    const fileName = req.query.fileName || `${type}.csv`;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    res.setHeader(HTTP.HEADERS.CONTENT_TYPE, HTTP.CONTENT_TYPE.CSV);
    res.setHeader(HTTP.HEADERS.CONTENT_DISPOSITION, `attachment; filename="${fileName}"`);

    let resultId: string | undefined;

    if (isQuery) {
      resultId = (await sfBulkGetQueryResultsJobIds(conn, jobId, batchId))[0];
    }

    sfBulkDownloadRecords(conn, jobId, batchId, type, resultId).buffer(false).pipe(res);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

/**
 * Download requests or results as JSON, streamed from Salesforce as CSV, and transformed to JSON
 */
export async function downloadResults(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const batchId = req.params.batchId;
    const type = req.query.type as BulkApiDownloadType;
    const isQuery = ensureBoolean(req.query.isQuery as string);
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const csvParseStream = parseCsv(NODE_STREAM_INPUT, {
      delimiter: ',',
      header: true,
      skipEmptyLines: true,
      transform: (data, field) => {
        if (field === 'Success' || field === 'Created') {
          return toBoolean(data);
        } else if (field === 'Id' || field === 'Error') {
          return data || null;
        }
        return data;
      },
    });
    if (isQuery) {
      const resultIds = await sfBulkGetQueryResultsJobIds(conn, jobId, batchId);
      sfBulkDownloadRecords(conn, jobId, batchId, type, resultIds[0]).buffer(false).pipe(csvParseStream);
    } else {
      sfBulkDownloadRecords(conn, jobId, batchId, type).buffer(false).pipe(csvParseStream);
    }

    let isFirstChunk = true;

    csvParseStream.on('data', (data) => {
      console.log('DATA: %o', data);
      data = JSON.stringify(data);
      if (isFirstChunk) {
        isFirstChunk = false;
        data = `{"data":[${data}`;
      } else {
        data = `,${data}`;
      }
      res.write(data);
    });
    csvParseStream.on('finish', () => {
      console.log('FINISH');
      res.write(']}');
      res.status(200).send();
    });
    csvParseStream.on('error', (err) => {
      logger.warn('Error streaming files from Salesforce. %o', err);
      res.status(400).send();
    });

    // csvParseStream.pipe(res);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

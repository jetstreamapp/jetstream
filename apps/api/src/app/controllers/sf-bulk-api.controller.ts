import { HTTP } from '@jetstream/shared/constants';
import { toBoolean } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, BulkApiDownloadType, BulkJobBatchInfo } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { logger } from '../config/logger.config';
import { SfBulkAddBatchToJob, SfBulkCloseJob, SfBulkCreateJob, sfBulkDownloadRecords, SfBulkGetJobInfo } from '../services/sf-bulk';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

const { HEADERS, CONTENT_TYPE } = HTTP;

export const routeValidators = {
  createJob: [
    body('type').isIn(['INSERT', 'UPDATE', 'UPSERT', 'DELETE']),
    body('sObject').isString(),
    body('serialMode').optional().isBoolean(),
    body('externalIdFieldName').optional().isString(),
    body('externalId')
      .if(body('type').isIn(['UPSERT']))
      .isString(),
  ],
  getJob: [param('jobId').isString()],
  closeJob: [param('jobId').isString()],
  downloadResults: [param('jobId').isString(), param('batchId').isString(), query('type').isIn(['request', 'result'])],
  downloadResultsFile: [
    param('jobId').isString(),
    param('batchId').isString(),
    query('type').isIn(['request', 'result']),
    query('filename').optional().isString(),
  ],
  addBatchToJob: [param('jobId').isString(), body().exists({ checkNull: true }), query('closeJob').optional().toBoolean()],
};

// https://github.com/jsforce/jsforce/issues/934
export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const options = req.body as BulkApiCreateJobRequestPayload;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const results = await SfBulkCreateJob(conn, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const jobInfo = await SfBulkGetJobInfo(conn, jobId);

    sendJson(res, jobInfo);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function closeJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const jobInfo = await SfBulkCloseJob(conn, jobId);

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

    const results: BulkJobBatchInfo = await SfBulkAddBatchToJob(conn, csv, jobId, closeJob);

    // try {
    //   results = await SfBulkGetJobInfo(conn, jobId);
    // } catch (ex) {
    //   // ignore error
    // }

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

/**
 * Download request or results as a CSV file directly streamed from SFDC
 * this should only be called from a link and not a JSON API call
 *
 */
export async function downloadResultsFile(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const batchId = req.params.batchId;
    const type = req.query.type as BulkApiDownloadType;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const filename = req.query.filename || `${type}.csv`; // TODO: come up with better filename structure
    res.setHeader(HEADERS.CONTENT_TYPE, CONTENT_TYPE.CSV);
    res.setHeader(HEADERS.CONTENT_DISPOSITION, `attachment; filename="${filename}"`);

    sfBulkDownloadRecords(conn, jobId, batchId, type).buffer(false).pipe(res);
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
    sfBulkDownloadRecords(conn, jobId, batchId, type).buffer(false).pipe(csvParseStream);

    let isFirstChunk = true;

    csvParseStream.on('data', (data) => {
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

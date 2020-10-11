import { bulkApiEnsureTyped } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, BulkJobUntyped, BulkJobBatchInfoUntyped } from '@jetstream/types';
import { HTTP } from '@jetstream/shared/constants';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { create as xmlBuilder } from 'xmlbuilder2';
import * as request from 'superagent';
import { SfBulkAddBatchToJob, SfBulkCloseJob, SfBulkCreateJob, sfBulkDownloadRecords, SfBulkGetJobInfo } from '../services/sf-bulk';
import * as stream from 'stream';
import * as papa from 'papaparse';

const { HEADERS, CONTENT_TYPE } = HTTP;

export const routeValidators = {
  createJob: [
    body('type').isIn(['INSERT', 'UPDATE', 'UPSERT', 'DELETE']),
    body('sObject').isString(),
    body('serialMode').optional().isBoolean(),
    body('externalId')
      .if(body('type').isIn(['UPSERT']))
      .isString(),
  ],
  getJob: [param('jobId').isString()],
  closeJob: [param('jobId').isString()],
  downloadResults: [
    param('jobId').isString(),
    param('batchId').isString(),
    query('type').isIn(['request', 'result', 'failed']),
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

    const results = await SfBulkAddBatchToJob(conn, csv, jobId, closeJob);
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

// TODO: ideally we would want to combine this with our original input data - so we have errors with specific rows of data
// class FilterSuccessRecordsTransform extends stream.Transform {
//   constructor(options?: stream.TransformOptions) {
//     super(options);
//   }

//   _transform = function (chunk: any, encoding: string, callback: (err?: any, data?: any) => void) {
//     // "Id","Success","Created","Error"
//     console.log('chunk', chunk.toString());

//     papa.unparse(chunk.toString(), {})

//     callback(null, chunk);
//   };
// }

export async function downloadResults(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const batchId = req.params.batchId;
    const type = req.query.type as 'request' | 'result' | 'failed';
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const filename = req.query.filename || `${type}.csv`; // TODO: come up with better filename structure
    res.setHeader(HEADERS.CONTENT_TYPE, CONTENT_TYPE.CSV);
    res.setHeader(HEADERS.CONTENT_DISPOSITION, `attachment; filename="${filename}"`);

    if (type === 'request' || type === 'result') {
      sfBulkDownloadRecords(conn, jobId, batchId, type)
        .buffer(false)
        // .pipe(new FilterSuccessRecordsTransform())
        .pipe(res);
    } else {
      // TODO:
      // get all and filter out the rows that are not failures
      sfBulkDownloadRecords(conn, jobId, batchId, 'result')
        .buffer(false)
        // .pipe(new FilterSuccessRecordsTransform())
        .pipe(res);
    }
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

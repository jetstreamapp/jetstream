import { logger } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, toBoolean } from '@jetstream/shared/utils';
import { BulkApiCreateJobRequestPayload, BulkApiDownloadType } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { Readable } from 'stream';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  createJob: [
    body('type').isIn(['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'QUERY', 'QUERY_ALL']),
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

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.bulk.createJob(options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.bulk.getJob(jobId);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function closeOrAbortJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const action: 'Closed' | 'Aborted' = req.params.action === 'abort' ? 'Aborted' : 'Closed';

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.bulk.closeJob(jobId, action);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function addBatchToJob(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const csv = req.body;
    const closeJob = req.query.closeJob as any;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.bulk.addBatchToJob(csv, jobId, ensureBoolean(closeJob));

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

    // TODO: how is this different from addBatchToJob?
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.bulk.addBatchToJob(zip, jobId, ensureBoolean(closeJob));

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

/**
 * Download request or results as a CSV file directly streamed from SFDC
 * this should only be called from a link and not a JSON API call
 *
 *  THIS IS USED BY BULK QUERY DOWNLOAD
 *
 */
export async function downloadResultsFile(req: Request, res: Response, next: NextFunction) {
  try {
    const jobId = req.params.jobId;
    const batchId = req.params.batchId;
    const type = req.query.type as BulkApiDownloadType;
    const isQuery = ensureBoolean(req.query.isQuery as string);
    const fileName = req.query.fileName || `${type}.csv`;
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;

    res.setHeader(HTTP.HEADERS.CONTENT_TYPE, HTTP.CONTENT_TYPE.CSV);
    res.setHeader(HTTP.HEADERS.CONTENT_DISPOSITION, `attachment; filename="${fileName}"`);

    let resultId: string | undefined;

    if (isQuery) {
      resultId = (await jetstreamConn.bulk.getQueryResultsJobIds(jobId, batchId))[0];
    }

    const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, type, resultId);
    Readable.fromWeb(results as any).pipe(res);
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

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;

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
      const resultIds = await jetstreamConn.bulk.getQueryResultsJobIds(jobId, batchId);
      const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, type, resultIds[0]);
      Readable.fromWeb(results as any).pipe(csvParseStream);
    } else {
      const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);
      Readable.fromWeb(results as any).pipe(csvParseStream);
    }

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
      if (!res.headersSent) {
        res.status(200).send();
      } else {
        logger.warn('Response headers already sent. csvParseStream[finish]', { requestId: res.locals.requestId });
      }
    });
    csvParseStream.on('error', (err) => {
      logger.warn('Error streaming files from Salesforce. %o', err, { requestId: res.locals.requestId });
      if (!res.headersSent) {
        res.status(400).send();
      } else {
        logger.warn('Response headers already sent. csvParseStream[error]', { requestId: res.locals.requestId });
      }
    });
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

import { getExceptionLog, logger } from '@jetstream/api-config';
import { BooleanQueryParamSchema, CreateJobRequestSchema } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, toBoolean } from '@jetstream/shared/utils';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { Readable } from 'stream';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  createJob: {
    controllerFn: () => createJob,
    validators: {
      body: CreateJobRequestSchema,
    },
  },
  getJob: {
    controllerFn: () => getJob,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
    },
  },
  closeOrAbortJob: {
    controllerFn: () => closeOrAbortJob,
    validators: {
      params: z.object({ jobId: z.string().min(1), action: z.enum(['close', 'abort']).nullish() }),
    },
  },
  downloadResults: {
    controllerFn: () => downloadResults,
    validators: {
      params: z.object({
        jobId: z.string().min(1),
        batchId: z.string().min(1),
      }),
      query: z.object({
        type: z.enum(['request', 'result']),
        isQuery: BooleanQueryParamSchema,
      }),
    },
  },
  downloadResultsFile: {
    controllerFn: () => downloadResultsFile,
    validators: {
      params: z.object({
        jobId: z.string().min(1),
        batchId: z.string().min(1),
      }),
      query: z.object({
        type: z.enum(['request', 'result']),
        isQuery: BooleanQueryParamSchema,
        fileName: z.string().nullish(),
      }),
    },
  },
  addBatchToJob: {
    controllerFn: () => addBatchToJob,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
      body: z.any(),
      query: z.object({
        closeJob: BooleanQueryParamSchema,
      }),
    },
  },
  addBatchToJobWithBinaryAttachment: {
    controllerFn: () => addBatchToJobWithBinaryAttachment,
    validators: {
      params: z.object({ jobId: z.string().min(1), batchId: z.string().min(1) }),
      body: z.any(),
      query: z.object({
        closeJob: BooleanQueryParamSchema,
      }),
    },
  },
};

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const options = body;

    const results = await jetstreamConn.bulk.createJob(options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn.bulk.getJob(jobId);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const closeOrAbortJob = createRoute(routeDefinition.closeOrAbortJob.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const jobId = params.jobId;
    const action: 'Closed' | 'Aborted' = params.action === 'abort' ? 'Aborted' : 'Closed';

    const results = await jetstreamConn.bulk.closeJob(jobId, action);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const addBatchToJob = createRoute(
  routeDefinition.addBatchToJob.validators,
  async ({ body, params, query, user, jetstreamConn }, req, res, next) => {
    try {
      const jobId = params.jobId;
      const csv = body;
      const closeJob = query.closeJob;

      const results = await jetstreamConn.bulk.addBatchToJob(csv, jobId, closeJob);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

const addBatchToJobWithBinaryAttachment = createRoute(
  routeDefinition.addBatchToJobWithBinaryAttachment.validators,
  async ({ body, params, query, jetstreamConn }, req, res, next) => {
    try {
      const jobId = params.jobId;
      const zip = body;
      const closeJob = query.closeJob;

      const results = await jetstreamConn.bulk.addBatchToJob(zip, jobId, closeJob, HTTP.CONTENT_TYPE.ZIP_CSV);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

/**
 * Download request or results as a CSV file directly streamed from SFDC
 * this should only be called from a link and not a JSON API call
 *
 *  THIS IS USED BY BULK QUERY DOWNLOAD
 *
 */
const downloadResultsFile = createRoute(
  routeDefinition.downloadResultsFile.validators,
  async ({ params, query, jetstreamConn }, req, res, next) => {
    try {
      const jobId = params.jobId;
      const batchId = params.batchId;
      const type = query.type;
      const isQuery = ensureBoolean(query.isQuery);
      const fileName = query.fileName || `${type}.csv`;

      res.setHeader(HTTP.HEADERS.CONTENT_TYPE, HTTP.CONTENT_TYPE.CSV);
      res.setHeader(HTTP.HEADERS.CONTENT_DISPOSITION, `attachment; filename="${fileName}"`);

      let resultId: string | undefined;

      if (isQuery) {
        resultId = (await jetstreamConn.bulk.getQueryResultsJobIds(jobId, batchId))[0];
      }

      const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, type, resultId);
      Readable.fromWeb(results as any).pipe(res);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

/**
 * Download requests or results as JSON, streamed from Salesforce as CSV, and transformed to JSON
 */
const downloadResults = createRoute(
  routeDefinition.downloadResults.validators,
  async ({ params, query, jetstreamConn, requestId }, req, res, next) => {
    try {
      const jobId = params.jobId;
      const batchId = params.batchId;
      const type = query.type;
      const isQuery = ensureBoolean(query.isQuery);

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
        res.end();
        logger.info({ requestId }, 'Finished streaming download from Salesforce');
      });
      csvParseStream.on('error', (err) => {
        logger.warn({ requestId, ...getExceptionLog(err) }, 'Error streaming files from Salesforce.');
        if (!res.headersSent) {
          res.status(400).json({ error: true, message: 'Error streaming files from Salesforce' });
        } else {
          res.status(400).end();
        }
      });
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

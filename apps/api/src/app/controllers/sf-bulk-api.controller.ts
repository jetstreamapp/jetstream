import { BooleanQueryParamSchema, CreateJobRequestSchema } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, getErrorMessageAndStackObj, toBoolean } from '@jetstream/shared/utils';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { PassThrough, Readable, Transform } from 'stream';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson, streamParsedCsvAsJson } from '../utils/response.handlers';
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
  downloadAllResults: {
    controllerFn: () => downloadAllResults,
    validators: {
      params: z.object({
        jobId: z.string().min(1),
      }),
      query: z.object({
        /**
         * Optional batch ids, if not provided then all batches will be downloaded from job
         * this is important because the returned batches array is not stable and the client relies on the order
         */
        batchIds: z
          .string()
          .nullish()
          .transform((val) => new Set(val?.split(',') || [])),
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
  async ({ body, params, query, jetstreamConn }, req, res, next) => {
    try {
      const jobId = params.jobId;
      const csv = body;
      const closeJob = query.closeJob;

      const results = await jetstreamConn.bulk.addBatchToJob(csv, jobId, closeJob);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
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
  },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Readable.fromWeb(results as any).pipe(res);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

/**
 * Download requests or results as JSON, streamed from Salesforce as CSV, and transformed to JSON
 */
const downloadResults = createRoute(
  routeDefinition.downloadResults.validators,
  async ({ params, query, jetstreamConn }, req, res, next) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Readable.fromWeb(results as any).pipe(csvParseStream);
      } else {
        const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Readable.fromWeb(results as any).pipe(csvParseStream);
      }

      streamParsedCsvAsJson(res, csvParseStream);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

/**
 * Download all results from a batch job as JSON, streamed from Salesforce as CSVs, and transformed to JSON on the fly
 */
const downloadAllResults = createRoute(
  routeDefinition.downloadAllResults.validators,
  async ({ params, jetstreamConn, query, requestId }, req, res, next) => {
    const combinedStream = new PassThrough();
    try {
      const jobId = params.jobId;
      let { batchIds } = query;

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

      // Fetch job to get all completed batches
      const job = await jetstreamConn.bulk.getJob(jobId);
      const batchIdsFromJob = new Set(job.batches.filter((batch) => batch.state === 'Completed').map((batch) => batch.id));

      // If no batchIds provided, use all completed batches
      if (batchIds.size === 0) {
        batchIds = batchIdsFromJob;
      }

      // Remove any provided batchIds that are not in the job or are not Completed
      batchIds.forEach((batchId) => {
        if (!batchIdsFromJob.has(batchId)) {
          batchIds.delete(batchId);
        }
      });

      if (batchIds.size === 0) {
        throw new UserFacingError('No completed batches found in the job');
      }

      // initiate stream response through passthrough stream
      streamParsedCsvAsJson(res, csvParseStream);
      combinedStream.pipe(csvParseStream);

      let isFirstBatch = true;

      for (const batchId of batchIds) {
        try {
          const results = await jetstreamConn.bulk.downloadRecords(jobId, batchId, 'result');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const readable = Readable.fromWeb(results as any);

          let streamToPipe: Readable;

          if (isFirstBatch) {
            // First batch, include headers
            streamToPipe = readable;
            isFirstBatch = false;
          } else {
            let headerRemoved = false;
            // Subsequent batches, remove headers
            const removeHeaderTransform = new Transform({
              transform(chunk, encoding, callback) {
                // Convert chunk to string
                const data = chunk.toString();
                // If header has been removed, pass data through
                if (headerRemoved) {
                  callback(null, chunk);
                } else {
                  // Remove the first line (header)
                  const index = data.indexOf('\n');
                  if (index !== -1) {
                    headerRemoved = true;
                    const dataWithoutHeader = data.slice(index + 1);
                    callback(null, Buffer.from(dataWithoutHeader));
                  } else {
                    // Header line not yet complete
                    callback();
                  }
                }
              },
            });
            streamToPipe = readable.pipe(removeHeaderTransform);
          }

          // pipe all data through passthrough stream
          await new Promise((resolve, reject) => {
            streamToPipe.pipe(combinedStream, { end: false });
            streamToPipe.on('end', resolve);
            streamToPipe.on('error', reject);
          });
        } catch (ex) {
          res.log.error({ requestId, ...getErrorMessageAndStackObj(ex) }, 'Error downloading batch results');
        }
      }
      // indicate end of stream - we are done pushing data
      combinedStream.end();
    } catch (ex) {
      // combinedStream.destroy();
      combinedStream.end();
      next(new UserFacingError(ex));
    }
  },
);

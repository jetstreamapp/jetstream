import { BooleanQueryParamSchema, CreateJobRequestSchema } from '@jetstream/api-types';
import { concatenateCsvStreams } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, toBoolean } from '@jetstream/shared/utils';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';
import { Readable } from 'stream';
import { z } from 'zod';
import type { Response } from '../types/route.types';
import { UserFacingError } from '../utils/error-handler';
import { cancelIfClientDisconnected, pipeWebStreamToResponse, sendJson, streamParsedCsvAsJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  createJob: {
    controllerFn: () => createJob,
    responseType: z.any(),
    validators: {
      body: CreateJobRequestSchema,
    } satisfies RouteValidator,
  },
  getJob: {
    controllerFn: () => getJob,
    responseType: z.any(),
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
    } satisfies RouteValidator,
  },
  closeOrAbortJob: {
    controllerFn: () => closeOrAbortJob,
    responseType: z.any(),
    validators: {
      params: z.object({ jobId: z.string().min(1), action: z.enum(['close', 'abort']).nullish() }),
    } satisfies RouteValidator,
  },
  downloadResults: {
    controllerFn: () => downloadResults,
    responseType: z.any().array(),
    validators: {
      params: z.object({
        jobId: z.string().min(1),
        batchId: z.string().min(1),
      }),
      query: z.object({
        type: z.enum(['request', 'result']),
        isQuery: BooleanQueryParamSchema,
      }),
    } satisfies RouteValidator,
  },
  downloadAllResults: {
    controllerFn: () => downloadAllResults,
    responseType: z.any().array(),
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
    } satisfies RouteValidator,
  },
  downloadResultsFile: {
    controllerFn: () => downloadResultsFile,
    responseType: z.any(),
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
    } satisfies RouteValidator,
  },
  addBatchToJob: {
    controllerFn: () => addBatchToJob,
    responseType: z.any(),
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
      body: z.any(),
      query: z.object({
        closeJob: BooleanQueryParamSchema,
      }),
    } satisfies RouteValidator,
  },
  addBatchToJobWithBinaryAttachment: {
    controllerFn: () => addBatchToJobWithBinaryAttachment,
    responseType: z.any(),
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
      body: z.any(),
      query: z.object({
        closeJob: BooleanQueryParamSchema,
      }),
    } satisfies RouteValidator,
  },
};

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, jetstreamConn }, _, res, next) => {
  try {
    const options = body;

    const results = await jetstreamConn.bulk.createJob(options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, jetstreamConn }, _, res, next) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn.bulk.getJob(jobId);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const closeOrAbortJob = createRoute(routeDefinition.closeOrAbortJob.validators, async ({ params, jetstreamConn }, _, res, next) => {
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
      // gzipBodyPassthrough left the body compressed - Salesforce decodes it, this server never does
      const contentEncoding = req.get(HTTP.HEADERS.CONTENT_ENCODING)?.toLowerCase() === 'gzip' ? 'gzip' : undefined;

      const results = await jetstreamConn.bulk.addBatchToJob(csv, jobId, closeJob, HTTP.CONTENT_TYPE.CSV, contentEncoding);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

const addBatchToJobWithBinaryAttachment = createRoute(
  routeDefinition.addBatchToJobWithBinaryAttachment.validators,
  async ({ body, params, query, jetstreamConn }, _, res, next) => {
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

function createBulkCsvParseStream() {
  return parseCsv(NODE_STREAM_INPUT, {
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
}

/**
 * Parse a Bulk API CSV stream and stream the records to the client as JSON.
 * A source failure errors the parser (see `streamParsedCsvAsJson`), and a client disconnect cancels the source.
 */
function streamBulkCsvAsJson(res: Response, csvStream: ReadableStream<Uint8Array>) {
  // Otherwise the parser would keep pulling (and Download All keep fetching every batch) for a client that is gone
  if (cancelIfClientDisconnected(res, csvStream)) {
    return;
  }
  const csvParseStream = createBulkCsvParseStream();
  streamParsedCsvAsJson(res, csvParseStream);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readable = Readable.fromWeb(csvStream as any);
  readable.on('error', (err) => csvParseStream.destroy(err));
  res.on('close', () => {
    if (!res.writableFinished) {
      readable.destroy();
    }
  });
  readable.pipe(csvParseStream);
}

/**
 * Download request or results as a CSV file directly streamed from SFDC
 * this should only be called from a link and not a JSON API call
 *
 *  THIS IS USED BY BULK QUERY DOWNLOAD
 *
 */
const downloadResultsFile = createRoute(
  routeDefinition.downloadResultsFile.validators,
  async ({ params, query, jetstreamConn }, _, res, next) => {
    try {
      const jobId = params.jobId;
      const batchId = params.batchId;
      const type = query.type;
      const isQuery = ensureBoolean(query.isQuery);
      const fileName = query.fileName || `${type}.csv`;

      res.setHeader(HTTP.HEADERS.CONTENT_TYPE, HTTP.CONTENT_TYPE.CSV);
      res.setHeader(HTTP.HEADERS.CONTENT_DISPOSITION, `attachment; filename="${fileName}"`);

      const results = isQuery
        ? await jetstreamConn.bulk.downloadQueryResults(jobId, batchId)
        : await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);
      pipeWebStreamToResponse(res, results, next);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

/**
 * Download requests or results as JSON, streamed from Salesforce as CSV, and transformed to JSON
 */
const downloadResults = createRoute(routeDefinition.downloadResults.validators, async ({ params, query, jetstreamConn }, _, res, next) => {
  try {
    const jobId = params.jobId;
    const batchId = params.batchId;
    const type = query.type;
    const isQuery = ensureBoolean(query.isQuery);

    const results = isQuery
      ? await jetstreamConn.bulk.downloadQueryResults(jobId, batchId)
      : await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);
    streamBulkCsvAsJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Download all results from a batch job as JSON, streamed from Salesforce as CSVs, and transformed to JSON on the fly
 *
 * The client pairs result rows with the records it submitted by position, so a batch that is missing from the
 * output would shift every later row onto the wrong source record. Any batch failure therefore fails the whole
 * response (an error status, or a destroyed connection once streaming has started) rather than skipping the batch.
 */
const downloadAllResults = createRoute(
  routeDefinition.downloadAllResults.validators,
  async ({ params, jetstreamConn, query }, _, res, next) => {
    try {
      const jobId = params.jobId;
      let { batchIds } = query;

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

      const [firstBatchId, ...remainingBatchIds] = Array.from(batchIds);
      // Requested before the response starts so a failure here is still reported with a proper error response
      const firstBatchResults = await jetstreamConn.bulk.downloadRecords(jobId, firstBatchId, 'result');
      // Checked here because cancelling the combined stream before its first read never reaches this response
      if (cancelIfClientDisconnected(res, firstBatchResults)) {
        return;
      }

      // Every batch result file starts with the same header row, which is only kept for the first batch
      const combinedResults = concatenateCsvStreams([
        async () => firstBatchResults,
        ...remainingBatchIds.map((batchId) => () => jetstreamConn.bulk.downloadRecords(jobId, batchId, 'result')),
      ]);

      streamBulkCsvAsJson(res, combinedResults);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

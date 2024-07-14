import { BooleanQueryParamSchema, CreateQueryJobRequestSchema } from '@jetstream/api-types';
import { ensureBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from './route.utils';

export const routeDefinition = {
  createJob: {
    controllerFn: () => createJob,
    validators: {
      body: CreateQueryJobRequestSchema,
    },
  },
  getJobs: {
    controllerFn: () => getJobs,
    validators: {
      query: z.object({
        isPkChunkingEnabled: BooleanQueryParamSchema,
        jobType: z.enum(['Classic', 'V2Query', 'V2Ingest']).nullish(),
        concurrencyMode: z.enum(['parallel']).nullish(),
        queryLocator: z.string().nullish(),
      }),
    },
  },
  getJob: {
    controllerFn: () => getJob,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
    },
  },
  abortJob: {
    controllerFn: () => abortJob,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
    },
  },
  deleteJob: {
    controllerFn: () => deleteJob,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
    },
  },
  downloadResults: {
    controllerFn: () => downloadResults,
    validators: {
      params: z.object({ jobId: z.string().min(1) }),
      query: z.object({
        maxRecords: z
          .string()
          .nullish()
          .refine((val) => {
            if (!val) {
              return true;
            }
            return /[0-9]+/.test(val);
          }, 'maxRecords must be an integer')
          .transform((val) => (val ? parseInt(val, 10) : undefined)),
      }),
    },
  },
};

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const { query, queryAll } = body;

    const results = await jetstreamConn!.bulkQuery20.createJob(query, ensureBoolean(queryAll));

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const getJobs = createRoute(routeDefinition.getJobs.validators, async ({ query, jetstreamConn }, req) => {
  try {
    const options = query;

    const results = await jetstreamConn!.bulkQuery20.getJobs(options);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn!.bulkQuery20.getJob(jobId);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const abortJob = createRoute(routeDefinition.abortJob.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn!.bulkQuery20.abortJob(jobId);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteJob = createRoute(routeDefinition.deleteJob.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;

    await jetstreamConn!.bulkQuery20.deleteJob(jobId);

    return handleJsonResponse(null, { status: 204, statusText: 'No Content' });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * Stream CSV results to API caller
 */
const downloadResults = createRoute(routeDefinition.downloadResults.validators, async ({ params, query, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;
    const maxRecords = query.maxRecords;
    const abortController = new AbortController();

    const stream = new ReadableStream({
      start(controller) {
        (async () => {
          const resultsStream = jetstreamConn!.bulkQuery20.getResultsStream(jobId, maxRecords);
          for await (const chunk of resultsStream) {
            if (abortController.signal.aborted) {
              resultsStream.throw(new Error('Download aborted'));
              controller.error(new Error('Download aborted'));
              return;
            }
            controller.enqueue(chunk);
          }
          controller.close();
        })();
      },
      cancel() {
        // This is called if the reader cancels
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv',
      },
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

import { BooleanQueryParamSchema, CreateQueryJobRequestSchema } from '@jetstream/api-types';
import { ensureBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

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

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const { query, queryAll } = body;

    const results = await jetstreamConn.bulkQuery20.createJob(query, ensureBoolean(queryAll));

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const getJobs = createRoute(routeDefinition.getJobs.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const options = query;

    const results = await jetstreamConn.bulkQuery20.getJobs(options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn.bulkQuery20.getJob(jobId);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const abortJob = createRoute(routeDefinition.abortJob.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn.bulkQuery20.abortJob(jobId);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteJob = createRoute(routeDefinition.deleteJob.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const jobId = params.jobId;

    await jetstreamConn.bulkQuery20.deleteJob(jobId);

    res.status(204).end();
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Stream CSV results to API caller
 */
const downloadResults = createRoute(
  routeDefinition.downloadResults.validators,
  async ({ params, query, jetstreamConn }, req, res, next) => {
    try {
      res.setHeader('Content-Type', 'text/csv');

      const jobId = params.jobId;
      const maxRecords = query.maxRecords;

      const resultsStream = jetstreamConn.bulkQuery20.getResultsStream(jobId, maxRecords);

      for await (const chunk of resultsStream) {
        res.write(chunk);
      }

      // End the response when the stream is complete
      res.end();
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

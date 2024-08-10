import { BooleanQueryParamSchema, CreateJobRequestSchema } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, toBoolean } from '@jetstream/shared/utils';
import { parse as parseCsv } from 'papaparse';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from './route.utils';

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

const createJob = createRoute(routeDefinition.createJob.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const options = body;

    const results = await jetstreamConn!.bulk.createJob(options);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const getJob = createRoute(routeDefinition.getJob.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;

    const results = await jetstreamConn!.bulk.getJob(jobId);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const closeOrAbortJob = createRoute(routeDefinition.closeOrAbortJob.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;
    const action: 'Closed' | 'Aborted' = params.action === 'abort' ? 'Aborted' : 'Closed';

    const results = await jetstreamConn!.bulk.closeJob(jobId, action);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const addBatchToJob = createRoute(routeDefinition.addBatchToJob.validators, async ({ body, params, query, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;
    const csv = body;
    const closeJob = query.closeJob;

    const results = await jetstreamConn!.bulk.addBatchToJob(csv, jobId, closeJob);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const addBatchToJobWithBinaryAttachment = createRoute(
  routeDefinition.addBatchToJobWithBinaryAttachment.validators,
  async ({ body, params, query, jetstreamConn }, req) => {
    try {
      const jobId = params.jobId;
      const zip = body;
      const closeJob = query.closeJob;

      const results = await jetstreamConn!.bulk.addBatchToJob(zip, jobId, closeJob, HTTP.CONTENT_TYPE.ZIP_CSV);

      return handleJsonResponse(results);
    } catch (ex) {
      return handleErrorResponse(ex);
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
const downloadResultsFile = createRoute(routeDefinition.downloadResultsFile.validators, async ({ params, query, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;
    const batchId = params.batchId;
    const type = query.type;
    const isQuery = ensureBoolean(query.isQuery);
    const fileName = query.fileName || `${type}.csv`;

    let resultId: string | undefined;

    if (isQuery) {
      resultId = (await jetstreamConn!.bulk.getQueryResultsJobIds(jobId, batchId))[0];
    }

    const results = await jetstreamConn!.bulk.downloadRecords(jobId, batchId, type, resultId);

    return new Response(results, {
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV,
        [HTTP.HEADERS.CONTENT_DISPOSITION]: `attachment; filename="${fileName}"`,
      },
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * Download requests or results as JSON, transformed to JSON
 */
const downloadResults = createRoute(routeDefinition.downloadResults.validators, async ({ params, query, jetstreamConn }, req) => {
  try {
    const jobId = params.jobId;
    const batchId = params.batchId;
    const type = query.type;
    const isQuery = ensureBoolean(query.isQuery);

    // IN THE MIDDLE OF THIS - giving some issues

    let results: ReadableStream<Uint8Array>;
    if (isQuery) {
      const resultIds = await jetstreamConn!.bulk.getQueryResultsJobIds(jobId, batchId);
      results = await jetstreamConn!.bulk.downloadRecords(jobId, batchId, type, resultIds[0]);
    } else {
      results = await jetstreamConn!.bulk.downloadRecords(jobId, batchId, type);
    }

    // parse entire stream since there isn't a way to stream parse in the browser with PapaParse
    let csvString = '';
    let done = false;
    while (!done) {
      const { value, done: isDone } = await results.getReader().read();
      done = isDone;
      csvString += new TextDecoder().decode(value);
    }

    const csv = parseCsv(csvString, {
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
    if (csv.errors.length) {
      throw new Error(`Error parsing CSV: ${csv.errors}`);
    }
    return handleJsonResponse(csv.data);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

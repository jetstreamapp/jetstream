import { BooleanQueryParamSchema } from '@jetstream/api-types';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from './route.utils';

export const routeDefinition = {
  describe: {
    controllerFn: () => describe,
    validators: {
      query: z.object({ isTooling: BooleanQueryParamSchema }),
    },
  },
  describeSObject: {
    controllerFn: () => describeSObject,
    validators: {
      query: z.object({ isTooling: BooleanQueryParamSchema }),
      params: z.object({ sobject: z.string().min(1).max(255) }),
    },
  },
  query: {
    controllerFn: () => query,
    validators: {
      body: z.object({ query: z.string().min(1) }),
      query: z.object({
        isTooling: BooleanQueryParamSchema,
        includeDeletedRecords: BooleanQueryParamSchema,
      }),
    },
  },
  queryMore: {
    controllerFn: () => queryMore,
    validators: {
      query: z.object({
        nextRecordsUrl: z.string().min(1),
      }),
    },
  },
};

const describe = createRoute(routeDefinition.describe.validators, async ({ query, jetstreamConn }, req) => {
  try {
    const isTooling = query.isTooling;
    const results = await jetstreamConn!.sobject.describe(isTooling);
    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const describeSObject = createRoute(routeDefinition.describeSObject.validators, async ({ params, query, jetstreamConn }, req) => {
  try {
    const isTooling = query.isTooling;
    const results = await jetstreamConn!.sobject.describeSobject(params.sobject, isTooling);
    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const query = createRoute(routeDefinition.query.validators, async ({ body, query, jetstreamConn }, req) => {
  try {
    const isTooling = query.isTooling;
    const includeDeletedRecords = query.includeDeletedRecords;
    const soql = body.query;

    const results = await jetstreamConn!.query.query(soql, isTooling, includeDeletedRecords);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const queryMore = createRoute(routeDefinition.queryMore.validators, async ({ query, jetstreamConn }, req) => {
  try {
    const nextRecordsUrl = query.nextRecordsUrl as string;

    const results = await jetstreamConn!.query.queryMore(nextRecordsUrl);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

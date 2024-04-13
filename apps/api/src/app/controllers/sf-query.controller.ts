import { BooleanQueryParamSchema } from '@jetstream/api-types';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

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

const describe = createRoute(routeDefinition.describe.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const isTooling = query.isTooling;
    const results = await jetstreamConn.sobject.describe(isTooling);
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const describeSObject = createRoute(
  routeDefinition.describeSObject.validators,
  async ({ params, query, jetstreamConn }, req, res, next) => {
    try {
      const isTooling = query.isTooling;
      const results = await jetstreamConn.sobject.describeSobject(params.sobject, isTooling);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

const query = createRoute(routeDefinition.query.validators, async ({ body, query, jetstreamConn }, req, res, next) => {
  try {
    const isTooling = query.isTooling;
    const includeDeletedRecords = query.includeDeletedRecords;
    const soql = body.query;

    const results = await jetstreamConn.query.query(soql, isTooling, includeDeletedRecords);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const queryMore = createRoute(routeDefinition.queryMore.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const nextRecordsUrl = query.nextRecordsUrl as string;

    const results = await jetstreamConn.query.queryMore(nextRecordsUrl);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

import { ensureBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { RoutDefinitions, createRoute } from '../utils/route.utils';

export const routeDefinition: RoutDefinitions = {
  describe: {
    controllerFn: () => describe,
    validators: {
      query: z.object({ isTooling: z.boolean().optional().transform(ensureBoolean) }),
    },
  },
  describeSObject: {
    controllerFn: () => describeSObject,
    validators: {
      query: z.object({ isTooling: z.boolean().optional().transform(ensureBoolean) }),
      params: z.object({ sobject: z.string().min(1).max(255) }),
    },
  },
  query: {
    controllerFn: () => query,
    validators: {
      body: z.object({ query: z.string().min(1) }),
      query: z.object({
        isTooling: z.string().optional().transform(ensureBoolean),
        includeDeletedRecords: z.string().optional().transform(ensureBoolean),
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
    next(new UserFacingError(ex.message));
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
      next(new UserFacingError(ex.message));
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
    next(new UserFacingError(ex.message));
  }
});

const queryMore = createRoute(routeDefinition.queryMore.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const nextRecordsUrl = query.nextRecordsUrl as string;

    const results = await jetstreamConn.query.queryMore(nextRecordsUrl);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
});

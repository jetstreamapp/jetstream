import { BooleanQueryParamSchema, RecordOperationRequestSchema } from '@jetstream/api-types';
import { toBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  recordOperation: {
    controllerFn: () => recordOperation,
    validators: {
      params: z.object({
        sobject: z.string(),
        operation: z.string(),
      }),
      body: RecordOperationRequestSchema,
      query: z.object({
        externalId: z.string().nullish(),
        allOrNone: BooleanQueryParamSchema,
      }),
    },
  },
};

const recordOperation = createRoute(
  routeDefinition.recordOperation.validators,
  async ({ body, params, query, jetstreamConn }, req, res, next) => {
    try {
      // FIXME: add express validator to operation
      const { sobject, operation } = params;
      const { externalId } = query;
      // FIXME: move to express validator to do data conversion
      const allOrNone = toBoolean(query.allOrNone, true);
      // TODO: validate combination based on operation or add validation to case statement
      // ids and records can be one or an array
      const { ids, records } = body;

      const results = await jetstreamConn.sobject.recordOperation({
        sobject,
        operation,
        externalId,
        records,
        allOrNone,
        ids,
        //  isTooling,
      });

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

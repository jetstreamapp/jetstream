import { BooleanQueryParamSchema, RecordOperationRequestSchema, SalesforceApiRequestSchema } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import { StripBlobFilename } from '@jetstream/shared/node-utils';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  binaryUpload: {
    controllerFn: () => binaryUpload,
    responseType: z.any(),
    validators: {
      query: z.object({
        url: z.string(),
        method: SalesforceApiRequestSchema.shape.method,
        isTooling: z.coerce.boolean().optional().default(false),
        assignmentRuleId: z.string().optional().default('FALSE'),
      }),
    },
  },
  recordOperation: {
    controllerFn: () => recordOperation,
    responseType: z.any(),
    validators: {
      params: z.object({
        sobject: z.string(),
        operation: z.enum(['retrieve', 'create', 'update', 'upsert', 'delete', 'undelete']),
      }),
      body: RecordOperationRequestSchema,
      query: z.object({
        externalId: z.string().nullish(),
        allOrNone: BooleanQueryParamSchema,
      }),
    },
  },
};

const binaryUpload = createRoute(routeDefinition.binaryUpload.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const { assignmentRuleId, isTooling, method, url } = query;

    const contentType = req.headers['content-type'];
    if (!contentType?.startsWith('multipart/form-data')) {
      throw new UserFacingError('Expected multipart/form-data');
    }

    // Proxy request to Salesforce
    const results = await jetstreamConn.request.manualRequest(
      {
        method,
        url,
        body: req.pipe(new StripBlobFilename()),
        headers: {
          [HTTP.HEADERS.CONTENT_TYPE]: contentType,
          // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_autoassign.htm
          // default is true
          'Sforce-Auto-Assign': assignmentRuleId || 'FALSE',
        },
        isTooling,
        rawBody: true,
        duplex: 'half',
      },
      'json',
      true,
    );

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const recordOperation = createRoute(
  routeDefinition.recordOperation.validators,
  async ({ body, params, query, jetstreamConn }, _, res, next) => {
    try {
      const { sobject, operation } = params;
      const { allOrNone, externalId } = query;
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
  },
);

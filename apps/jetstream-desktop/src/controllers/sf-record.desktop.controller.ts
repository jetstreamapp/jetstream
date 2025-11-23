import { BooleanQueryParamSchema, RecordOperationRequestSchema, SalesforceApiRequestSchema } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import { toBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  binaryUpload: {
    controllerFn: () => binaryUpload,
    validators: {
      skipBodyParsing: true,
      body: z.any(),
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

const binaryUpload = createRoute(routeDefinition.binaryUpload.validators, async ({ query, jetstreamConn }, req) => {
  try {
    const { assignmentRuleId, isTooling, method, url } = query;
    const body = req.request.body;

    const contentType = req.request.headers.get('content-type');
    if (!contentType?.startsWith('multipart/form-data')) {
      return handleErrorResponse(new Error('Expected multipart/form-data'));
    }
    if (!body) {
      return handleErrorResponse(new Error('Missing request body'));
    }

    // Proxy request to Salesforce
    const results = await jetstreamConn!.request.manualRequest(
      {
        method,
        url,
        body,
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

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const recordOperation = createRoute(routeDefinition.recordOperation.validators, async ({ body, params, query, jetstreamConn }) => {
  try {
    // FIXME: add express validator to operation
    const { sobject, operation } = params;
    const { externalId } = query;
    // FIXME: move to express validator to do data conversion
    const allOrNone = toBoolean(query.allOrNone, true);
    // TODO: validate combination based on operation or add validation to case statement
    // ids and records can be one or an array
    const { ids, records } = body;

    const results = await jetstreamConn!.sobject.recordOperation({
      sobject,
      operation,
      externalId,
      records,
      allOrNone,
      ids,
      //  isTooling,
    });

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

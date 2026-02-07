import { SalesforceApiRequestSchema, SalesforceRequestManualRequestSchema } from '@jetstream/api-types';
import { FetchResponse } from '@jetstream/salesforce-api';
import { type ManualRequestResponse } from '@jetstream/types';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  streamFileDownload: {
    controllerFn: () => streamFileDownload,
    validators: {
      query: z.object({
        url: z.string().min(1),
      }),
    },
  },
  salesforceRequest: {
    controllerFn: () => salesforceRequest,
    validators: {
      body: SalesforceApiRequestSchema,
    },
  },
  salesforceRequestManual: {
    controllerFn: () => salesforceRequestManual,
    validators: {
      body: SalesforceRequestManualRequestSchema,
    },
  },
};

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 * @returns
 */
const streamFileDownload = createRoute(routeDefinition.streamFileDownload.validators, async ({ query, jetstreamConn }) => {
  try {
    const { url } = query;

    const results = await jetstreamConn!.org.streamDownload(url);
    return new Response(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const salesforceRequest = createRoute(routeDefinition.salesforceRequest.validators, async ({ body, jetstreamConn }) => {
  try {
    const payload = body;
    const results = await jetstreamConn!.request.manualRequest(payload, payload.options?.responseType || 'json', true);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

// TODO: combine with salesforceRequest and rename
// The request payload and response are slightly different, but the logic is the same
// The only difference is the caller is expected to pass in the full url to call (AFAIK)
const salesforceRequestManual = createRoute(routeDefinition.salesforceRequestManual.validators, async ({ body, jetstreamConn }) => {
  try {
    // const { method, headers, body, url } = body as ManualRequestPayload;
    const payload = body;

    const results = await jetstreamConn!.request.manualRequest<FetchResponse>(payload, 'response').then(async (apiResponse) => {
      const { status, statusText, headers } = apiResponse;
      const response: ManualRequestResponse = {
        error: status < 200 || status > 300,
        status,
        statusText,
        headers: JSON.stringify(Object.fromEntries(headers.entries()) || {}, null, 2),
        body: await apiResponse.text(),
      };
      return response;
    });

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

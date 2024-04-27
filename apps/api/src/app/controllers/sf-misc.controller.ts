import { SalesforceApiRequestSchema, SalesforceRequestManualRequestSchema } from '@jetstream/api-types';
import { FetchResponse } from '@jetstream/salesforce-api';
import { ManualRequestResponse } from '@jetstream/types';
import { Readable } from 'stream';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getFrontdoorLoginUrl: {
    controllerFn: () => getFrontdoorLoginUrl,
    validators: {
      query: z.object({ returnUrl: z.string().min(1) }),
    },
  },
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

const getFrontdoorLoginUrl = createRoute(
  routeDefinition.getFrontdoorLoginUrl.validators,
  async ({ query, jetstreamConn }, req, res, next) => {
    try {
      const { returnUrl } = query;
      // ensure that our token is valid and not expired
      await jetstreamConn.org.identity();
      res.redirect(jetstreamConn.org.getFrontdoorLoginUrl(returnUrl as string));
    } catch (ex) {
      next(ex);
    }
  }
);

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 * @returns
 */
const streamFileDownload = createRoute(routeDefinition.streamFileDownload.validators, async ({ query, jetstreamConn }, req, res, next) => {
  try {
    const { url } = query;

    const results = await jetstreamConn.org.streamDownload(url as string);
    Readable.fromWeb(results as any).pipe(res);
  } catch (ex) {
    next(ex);
  }
});

const salesforceRequest = createRoute(routeDefinition.salesforceRequest.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const payload = body;
    const results = await jetstreamConn.request.manualRequest(payload, payload.options?.responseType || 'json', true);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

// TODO: combine with salesforceRequest and rename
// The request payload and response are slightly different, but the logic is the same
// The only difference is the caller is expected to pass in the full url to call (AFAIK)
const salesforceRequestManual = createRoute(
  routeDefinition.salesforceRequestManual.validators,
  async ({ body, jetstreamConn }, req, res, next) => {
    try {
      // const { method, headers, body, url } = body as ManualRequestPayload;
      const payload = body;

      const results = await jetstreamConn.request.manualRequest<FetchResponse>(payload, 'response').then(async (apiResponse) => {
        const { status, statusText, headers } = apiResponse;
        const response: ManualRequestResponse = {
          error: status < 200 || status > 300,
          status,
          statusText,
          headers: JSON.stringify(Object.fromEntries(headers.entries()) || {}, null, 2),
          body: await apiResponse.text(), // FIXME: what should this be?
        };
        return response;
      });

      sendJson<ManualRequestResponse>(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

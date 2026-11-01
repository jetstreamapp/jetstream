import { SalesforceApiRequestSchema, SalesforceRequestManualRequestSchema, SObjectBlobFieldUrlSchema } from '@jetstream/api-types';
import { FetchResponse, getBinaryFileRecordQueryMap } from '@jetstream/salesforce-api';
import { MAX_BINARY_DOWNLOAD_RECORDS_FREE_USER, MAX_BINARY_DOWNLOAD_RECORDS_PAID_USER } from '@jetstream/shared/constants';
import { ensureArray } from '@jetstream/shared/utils';
import { BinaryDownloadCompatibleObjectsSchema, FileNameFormatSchema, ManualRequestResponse } from '@jetstream/types';
import { z } from 'zod';
import { isPaidUser } from '../db/user.db';
import { UserFacingError } from '../utils/error-handler';
import { pipeWebStreamToResponse, sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

/**
 * Defense-in-depth for the `salesforceRequestManual` SSRF sink: the `url` is forwarded to Salesforce
 * with the org's session credentials, so we require a host-relative path. The callout adapter still
 * pins the resolved request to the instance origin, but rejecting authority-override (`@host`),
 * protocol-relative (`//host`), backslash, whitespace, and control-char tricks at the edge keeps
 * malicious input from ever reaching the credentialed request. (`streamFileDownload` is a GET and is
 * held to the stricter `SObjectBlobFieldUrlSchema` instead.)
 */
const HostRelativeUrlSchema = z
  .string()
  .min(1)
  .startsWith('/', 'URL must be a host-relative path beginning with "/"')
  // eslint-disable-next-line no-control-regex -- intentionally rejecting C0/DEL control chars in the path
  .regex(/^\/(?!\/)[^\\\s\x00-\x1f\x7f]*$/, 'URL must be a host-relative path and may not contain "\\", whitespace, or control characters')
  .refine((value) => !value.includes('@'), 'URL must not contain "@"');

export const routeDefinition = {
  getFrontdoorLoginUrl: {
    controllerFn: () => getFrontdoorLoginUrl,
    responseType: z.any(),
    validators: {
      query: z.object({ returnUrl: z.string().min(1) }),
    } satisfies RouteValidator,
  },
  streamFileDownload: {
    controllerFn: () => streamFileDownload,
    responseType: z.any(),
    validators: {
      query: z.object({
        // A GET with a cookie session, so the path is restricted to the one resource type this route serves
        url: SObjectBlobFieldUrlSchema,
      }),
    } satisfies RouteValidator,
  },
  streamFileDownloadToZip: {
    controllerFn: () => streamFileDownloadToZip,
    responseType: z.any(),
    validators: {
      query: z.object({
        fileName: z.string().endsWith('.zip').optional(),
        sobject: BinaryDownloadCompatibleObjectsSchema,
        nameFormat: FileNameFormatSchema.default('name'),
      }),
      body: z.object({
        recordIds: z.preprocess(ensureArray, z.array(z.string().min(15).max(18)).min(1).max(MAX_BINARY_DOWNLOAD_RECORDS_PAID_USER)),
      }),
    } satisfies RouteValidator,
  },
  salesforceRequest: {
    controllerFn: () => salesforceRequest,
    responseType: z.any(),
    validators: {
      body: SalesforceApiRequestSchema,
    } satisfies RouteValidator,
  },
  salesforceRequestManual: {
    controllerFn: () => salesforceRequestManual,
    responseType: z.any(),
    validators: {
      // `salesforceRequestManual` runs with `ensureRestUrl=false`, so its caller-supplied `url` is the
      // SSRF sink — tighten it to a host-relative path. `salesforceRequest` above is safe because it
      // passes `ensureRestUrl=true`, so its schema is intentionally left unchanged.
      body: SalesforceRequestManualRequestSchema.extend({ url: HostRelativeUrlSchema }),
    } satisfies RouteValidator,
  },
};

const getFrontdoorLoginUrl = createRoute(
  routeDefinition.getFrontdoorLoginUrl.validators,
  async ({ query, jetstreamConn }, _, res, next) => {
    try {
      const { returnUrl } = query;
      // ensure that our token is valid and not expired
      await jetstreamConn.org.identity();
      res.redirect(jetstreamConn.org.getFrontdoorLoginUrl(returnUrl as string));
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 *
 * @returns
 */
const streamFileDownload = createRoute(routeDefinition.streamFileDownload.validators, async ({ query, jetstreamConn }, _, res, next) => {
  try {
    const { url } = query;

    const results = await jetstreamConn.org.streamDownload(url);
    pipeWebStreamToResponse(res, results, next);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Stream multiple files from Salesforce and zip them on the fly
 */
const streamFileDownloadToZip = createRoute(
  routeDefinition.streamFileDownloadToZip.validators,
  async ({ query, body, jetstreamConn, user, teamMembership }, _, res, next) => {
    try {
      const { recordIds } = body;
      const { sobject, nameFormat, fileName } = query;

      const paidUser = await isPaidUser({ userId: user.id, teamId: teamMembership?.teamId });
      if (!paidUser && recordIds.length > MAX_BINARY_DOWNLOAD_RECORDS_FREE_USER) {
        throw new UserFacingError(
          `Your current plan allows downloading up to ${MAX_BINARY_DOWNLOAD_RECORDS_FREE_USER} records at a time. Please reduce the number of records or upgrade your plan to download more.`,
        );
      }

      const queryMap = getBinaryFileRecordQueryMap(nameFormat);
      const fileQueryInfo = queryMap[sobject];

      if (!fileQueryInfo) {
        throw new Error(`Unsupported sObject for binary download: ${sobject}`);
      }

      const queries = fileQueryInfo.getQuery(recordIds);
      const records: unknown[] = [];
      for (const soql of queries) {
        records.push(...(await jetstreamConn.query.query(soql).then((res) => res.queryResults.records)));
      }
      const files = fileQueryInfo.transformToBinaryFileDownload(records);

      const results = await jetstreamConn.binary.downloadAndZipFiles(files, fileName || `download-${sobject}s.zip`, false);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${results.fileName}"`);
      res.setHeader('Content-Length', results.size.toString());

      // A file that fails part way errors the zip stream - the response is destroyed so the client
      // sees a failed download instead of one stalled short of Content-Length
      pipeWebStreamToResponse(res, results.stream, next);
    } catch (ex) {
      next(ex);
    }
  },
);

const salesforceRequest = createRoute(routeDefinition.salesforceRequest.validators, async ({ body, jetstreamConn }, _, res, next) => {
  try {
    const payload = body;
    const results = await jetstreamConn.request.manualRequest(payload, payload.options?.responseType || 'json', true);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Similar to salesforceRequest, but the results are not processed as JSON.
 * This is useful for raw text responses, such as when downloading files.
 */
const salesforceRequestManual = createRoute(
  routeDefinition.salesforceRequestManual.validators,
  async ({ body, jetstreamConn }, _, res, next) => {
    try {
      // const { method, headers, body, url } = body as ManualRequestPayload;
      const payload = body;

      const results = await jetstreamConn.request.manualRequest<FetchResponse>(payload, 'response').then(async (apiResponse) => {
        const { status, statusText, headers } = apiResponse;
        const response: ManualRequestResponse = {
          error: status < 200 || status >= 300,
          status,
          statusText,
          headers: JSON.stringify(Object.fromEntries(headers.entries()) || {}, null, 2),
          body: await apiResponse.text(),
        };
        return response;
      });

      sendJson<ManualRequestResponse>(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);

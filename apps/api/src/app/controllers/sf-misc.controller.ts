import { SalesforceApiRequestSchema, SalesforceRequestManualRequestSchema } from '@jetstream/api-types';
import { FetchResponse, getBinaryFileRecordQueryMap } from '@jetstream/salesforce-api';
import { MAX_BINARY_DOWNLOAD_RECORDS } from '@jetstream/shared/constants';
import { BinaryDownloadCompatibleObjectsSchema, FileNameFormatSchema, ManualRequestResponse } from '@jetstream/types';
import { Readable } from 'stream';
import { z } from 'zod';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getFrontdoorLoginUrl: {
    controllerFn: () => getFrontdoorLoginUrl,
    responseType: z.any(),
    validators: {
      query: z.object({ returnUrl: z.string().min(1) }),
    },
  },
  streamFileDownload: {
    controllerFn: () => streamFileDownload,
    responseType: z.any(),
    validators: {
      query: z.object({
        url: z.string().min(1),
      }),
    },
  },
  streamFileDownloadToZip: {
    controllerFn: () => streamFileDownloadToZip,
    responseType: z.any(),
    validators: {
      query: z.object({
        fileName: z.string().endsWith('.zip').optional(),
        sobject: BinaryDownloadCompatibleObjectsSchema,
        recordIds: z
          .string()
          .transform((val) => z.array(z.string().min(15).max(18)).max(MAX_BINARY_DOWNLOAD_RECORDS).parse(val.split(','))),
        nameFormat: FileNameFormatSchema.default('name'),
      }),
    },
  },
  salesforceRequest: {
    controllerFn: () => salesforceRequest,
    responseType: z.any(),
    validators: {
      body: SalesforceApiRequestSchema,
    },
  },
  salesforceRequestManual: {
    controllerFn: () => salesforceRequestManual,
    responseType: z.any(),
    validators: {
      body: SalesforceRequestManualRequestSchema,
    },
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
      next(ex);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Readable.fromWeb(results as any).pipe(res);
  } catch (ex) {
    next(ex);
  }
});

/**
 * Stream multiple files from Salesforce and zip them on the fly
 */
const streamFileDownloadToZip = createRoute(
  routeDefinition.streamFileDownloadToZip.validators,
  async ({ query, jetstreamConn }, req, res, next) => {
    try {
      const { sobject, recordIds, nameFormat, fileName } = query;

      const queryMap = getBinaryFileRecordQueryMap(nameFormat);
      const fileQueryInfo = queryMap[sobject];

      if (!fileQueryInfo) {
        throw new Error(`Unsupported sObject for binary download: ${sobject}`);
      }

      const soql = fileQueryInfo.getQuery(recordIds);
      const records = await jetstreamConn.query.query(soql);
      const files = fileQueryInfo.transformToBinaryFileDownload(records.queryResults.records);

      const results = await jetstreamConn.binary.downloadAndZipFiles(files, fileName || `download-${sobject}s.zip`);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${results.fileName}"`);
      res.setHeader('Content-Length', results.size.toString());

      // Convert web stream to Node.js stream and pipe to response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeStream = Readable.fromWeb(results.stream as any);

      // Handle client disconnect/abort
      req.on('close', () => {
        if (!res.writableEnded) {
          nodeStream.destroy();
        }
      });

      // Handle pipe errors
      nodeStream.on('error', (err) => {
        if (!res.headersSent) {
          next(err);
        }
      });

      nodeStream.pipe(res);
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
          error: status < 200 || status > 300,
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

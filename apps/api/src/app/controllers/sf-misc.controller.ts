import { FetchResponse } from '@jetstream/salesforce-api';
import { toBoolean } from '@jetstream/shared/utils';
import { GenericRequestPayload, ManualRequestPayload, ManualRequestResponse } from '@jetstream/types';
import { NextFunction } from 'express';
import { body, query } from 'express-validator';
import { isObject, isString } from 'lodash';
import { Readable } from 'stream';
import { Request, Response } from '../types/types';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  getFrontdoorLoginUrl: [],
  streamFileDownload: [query('url').isString()],
  salesforceRequest: [
    body('url').isString(),
    body('method').isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    body('method')
      .if(body('method').isIn(['POST', 'PUT', 'PATCH']))
      .custom((value, { req }) => isObject(req.body.body)),
    body('isTooling').optional().toBoolean(),
    body('body').optional(),
    body('headers').optional(),
    body('options').optional(),
  ],
  salesforceRequestManual: [
    body('url').isString(),
    body('method').isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    body('method')
      .if(body('method').isIn(['POST', 'PUT', 'PATCH']))
      .custom((value, { req }) => isString(req.body.body)),
    body('body').optional(),
    body('headers').optional(),
  ],
  recordOperation: [
    // TODO: move all validation here (entire switch statement replaced with validator)
  ],
};

export async function getFrontdoorLoginUrl(req: Request<unknown, unknown, { returnUrl: string }>, res: Response, next: NextFunction) {
  try {
    const { returnUrl } = req.query;
    const jetstreamConn = res.locals.jetstreamConn;
    // ensure that our token is valid and not expired
    await jetstreamConn.org.identity();
    res.redirect(jetstreamConn.org.getFrontdoorLoginUrl(returnUrl as string));
  } catch (ex) {
    next(ex);
  }
}

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 * @returns
 */
export async function streamFileDownload(req: Request<unknown, unknown, { url: string }>, res: Response, next: NextFunction) {
  try {
    const { url } = req.query;
    const jetstreamConn = res.locals.jetstreamConn;

    const results = await jetstreamConn.org.streamDownload(url as string);
    Readable.fromWeb(results as any).pipe(res);
  } catch (ex) {
    next(ex);
  }
}

// https://github.com/jsforce/jsforce/issues/934
// TODO: the api version in the urls needs to match - we should not have this hard-coded on front-end
export async function salesforceRequest(req: Request<unknown, GenericRequestPayload, unknown>, res: Response, next: NextFunction) {
  try {
    const payload = req.body;

    const jetstreamConn = res.locals.jetstreamConn;
    const results = await jetstreamConn.request.manualRequest(payload, 'json', true);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

// TODO: combine with salesforceRequest and rename
// The request payload and response are slightly different, but the logic is the same
// The only difference is the caller is expected to pass in the full url to call (AFAIK)
export async function salesforceRequestManual(req: Request<unknown, ManualRequestPayload, unknown>, res: Response, next: NextFunction) {
  try {
    // const { method, headers, body, url } = req.body as ManualRequestPayload;
    const payload = req.body;

    const jetstreamConn = res.locals.jetstreamConn;
    const results = await jetstreamConn.request.manualRequest<FetchResponse>(payload, 'response').then(async (response) => ({
      error: response.status < 200 || response.status > 300,
      status: response.status,
      statusText: response.statusText,
      headers: JSON.stringify(response.headers || {}, null, 2),
      body: await response.text(), // FIXME: what should this be?
    }));

    sendJson<ManualRequestResponse>(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function recordOperation(
  req: Request<
    { sobject: string; operation: string },
    { ids?: string | string[]; records: any },
    { externalId: string; allOrNone: string }
  >,
  res: Response,
  next: NextFunction
) {
  try {
    // FIXME: add express validator to operation
    const { sobject, operation } = req.params;
    const { externalId } = req.query;
    // FIXME: move to express validator to do data conversion
    const allOrNone = toBoolean(req.query.allOrNone, true);
    // TODO: validate combination based on operation or add validation to case statement
    // ids and records can be one or an array
    const { ids, records } = req.body;

    const jetstreamConn = res.locals.jetstreamConn;

    const results = await jetstreamConn.sobject.recordOperation({
      sobject,
      operation,
      externalId: externalId,
      records,
      allOrNone,
      ids,
      //  isTooling,
    });

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

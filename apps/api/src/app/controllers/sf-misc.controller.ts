import { toBoolean } from '@jetstream/shared/utils';
import { GenericRequestPayload, ManualRequestPayload, ManualRequestResponse } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { isObject, isString } from 'lodash';
import * as request from 'superagent';
import { salesforceRequestViaAxios } from '../services/sf-misc';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  getFrontdoorLoginUrl: [],
  streamFileDownload: [query('url').isString()],
  makeJsforceRequest: [
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
  makeJsforceRequestViaAxios: [
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

export async function getFrontdoorLoginUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { returnUrl } = req.query;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    // ensure that our token is valid and not expired
    await conn.identity();
    let url = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}`;
    if (returnUrl) {
      url += `&retURL=${returnUrl}`;
    }
    res.redirect(url);
  } catch (ex) {
    next(ex);
  }
}

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 * @returns
 */
export async function streamFileDownload(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = req.query;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    // ensure that our token is valid and not expired
    await conn.identity();
    return request
      .get(`${conn.instanceUrl}${url}`)
      .set({ ['Authorization']: `Bearer ${conn.accessToken}`, ['X-SFDC-Session']: conn.accessToken })
      .buffer(false)
      .pipe(res);
  } catch (ex) {
    next(ex);
  }
}

// https://github.com/jsforce/jsforce/issues/934
// TODO: the api version in the urls needs to match - we should not have this hard-coded on front-end
export async function makeJsforceRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { url, method, isTooling, body, headers, options } = req.body as GenericRequestPayload;
    const conn: jsforce.Connection | jsforce.Tooling = isTooling ? res.locals.jsforceConn.tooling : res.locals.jsforceConn;

    const requestOptions: jsforce.RequestInfo = {
      method,
      url,
      body: isObject(body) ? JSON.stringify(body) : body,
      headers:
        (isObject(headers) || isObject(body)) && !headers?.['Content-Type']
          ? { ...headers, ['Content-Type']: 'application/json' }
          : headers,
    };

    const results = await conn.request(requestOptions, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function makeJsforceRequestViaAxios(req: Request, res: Response, next: NextFunction) {
  try {
    const { method, headers, body, url } = req.body as ManualRequestPayload;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const response = await salesforceRequestViaAxios({
      conn,
      url,
      method,
      headers,
      body,
    });

    sendJson<ManualRequestResponse>(res, response);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function recordOperation(req: Request, res: Response, next: NextFunction) {
  try {
    // FIXME: add express validator to operation
    const { sobject, operation } = req.params;
    const { externalId } = req.query;
    // FIXME: move to express validator to do data conversion
    const allOrNone = toBoolean(req.query.allOrNone as string, true);
    // TODO: validate combination based on operation or add validation to case statement
    // ids and records can be one or an array
    const { ids, records } = req.body;

    const conn: jsforce.Connection = res.locals.jsforceConn;
    const sobjectOperation = conn.sobject(sobject);

    // FIXME: submit PR to fix these types - allOrNone / allowRecursive
    const options: any = { allOrNone };

    let operationPromise: Promise<unknown>;

    switch (operation) {
      case 'retrieve':
        if (!ids) {
          return next(new UserFacingError(`The ids property must be included`));
        }
        operationPromise = sobjectOperation.retrieve(ids, options);
        break;
      case 'create':
        if (!records) {
          return next(new UserFacingError(`The records property must be included`));
        }
        operationPromise = sobjectOperation.create(records, options);
        break;
      case 'update':
        if (!records) {
          return next(new UserFacingError(`The records property must be included`));
        }
        operationPromise = sobjectOperation.update(records, options);
        break;
      case 'upsert':
        if (!records || !externalId) {
          return next(new UserFacingError(`The records and external id properties must be included`));
        }
        operationPromise = sobjectOperation.upsert(records, externalId as string, options);
        break;
      case 'delete':
        if (!ids) {
          return next(new UserFacingError(`The ids property must be included`));
        }
        operationPromise = sobjectOperation.delete(ids, options);
        break;
      default:
        return next(new UserFacingError(`The operation ${operation} is not valid`));
    }

    const results = await operationPromise;

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

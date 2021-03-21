import { toBoolean } from '@jetstream/shared/utils';
import { GenericRequestPayload, ManualRequestPayload, ManualRequestResponse } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body } from 'express-validator';
import * as jsforce from 'jsforce';
import { isObject, isString } from 'lodash';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const SESSION_ID_RGX = /\{sessionId\}/i;

export const routeValidators = {
  getFrontdoorLoginUrl: [],
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
    const { url, method, headers } = req.body as ManualRequestPayload;
    let { body } = req.body as ManualRequestPayload;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const config: AxiosRequestConfig = {
      url,
      method,
      baseURL: conn.instanceUrl,
      // X-SFDC-Session is used for some SOAP APIs, such as the bulk api
      headers: { ...(headers || {}), ['Authorization']: `Bearer ${conn.accessToken}`, ['X-SFDC-Session']: conn.accessToken },
      responseType: 'text',
      validateStatus: null,
      timeout: 120000,
      transformResponse: [], // required to avoid automatic json parsing
    };

    if (isString(body) && SESSION_ID_RGX.test(body)) {
      body = body.replace(SESSION_ID_RGX, conn.accessToken);
    }

    if (method !== 'GET' && body) {
      config.data = body;
    }

    axios
      .request(config)
      .then((response) => {
        sendJson<ManualRequestResponse>(res, {
          error: response.status < 200 || response.status > 300,
          status: response.status,
          statusText: response.statusText,
          headers: JSON.stringify(response.headers || {}, null, 2),
          body: response.data,
        });
      })
      .catch((error: AxiosError) => {
        if (error.isAxiosError) {
          if (error.response) {
            return sendJson<ManualRequestResponse>(res, {
              error: true,
              errorMessage: null,
              status: error.response.status,
              statusText: error.response.statusText,
              headers: JSON.stringify(error.response.headers || {}, null, 2),
              body: error.response.data,
            });
          } else if (error.request) {
            return sendJson<ManualRequestResponse>(res, {
              error: true,
              errorMessage: error.message || 'An unknown error has occurred.',
              status: null,
              statusText: null,
              headers: null,
              body: null,
            });
          }
        }
        sendJson<ManualRequestResponse>(res, {
          error: true,
          errorMessage: error.message || 'An unknown error has occurred, the request was not made.',
          status: null,
          statusText: null,
          headers: null,
          body: null,
        });
      });
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

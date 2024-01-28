import { ORG_VERSION_PLACEHOLDER } from '@jetstream/shared/constants';
import { toBoolean } from '@jetstream/shared/utils';
import { CompositeResponse, GenericRequestPayload, ManualRequestPayload, ManualRequestResponse } from '@jetstream/types';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { NextFunction, Request, Response } from 'express';
import { body, query } from 'express-validator';
import * as jsforce from 'jsforce';
import { isObject, isString } from 'lodash';
import * as request from 'superagent';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

const SESSION_ID_RGX = /\{sessionId\}/i;

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
    const { method, headers } = req.body as ManualRequestPayload;
    let { url } = req.body as ManualRequestPayload;
    let { body } = req.body as ManualRequestPayload;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    url = url.replace(ORG_VERSION_PLACEHOLDER, conn.version);

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
              body: error.response.data as any,
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

    const allOrNone = toBoolean(req.query.allOrNone as string, true);
    const isTooling = toBoolean(req.query.isTooling as string, false);
    let { ids, records } = req.body;

    const conn: jsforce.Connection = res.locals.jsforceConn;

    if (ids) {
      ids = Array.isArray(ids) ? ids : [ids];
    }
    if (records) {
      records = Array.isArray(records) ? records : [records];
    }

    let operationPromise: Promise<unknown>;
    const baseUrl = `/services/data/v${conn.version}`;
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

    switch (operation) {
      case 'retrieve': {
        if (!Array.isArray(ids)) {
          return next(new UserFacingError(`The ids property must be included`));
        }
        operationPromise = conn
          .request<CompositeResponse>({
            method: 'POST',
            headers,
            url: `/composite`,
            body: JSON.stringify({
              allOrNone,
              compositeRequest: ids
                .map((id) => (isTooling ? `${baseUrl}/tooling/sobjects/${sobject}/${id}` : `${baseUrl}/sobjects/${sobject}/${id}`))
                .map((url, i) => ({ method: 'GET', url: url, referenceId: `${i}` })),
            }),
          })
          .then((response) => response.compositeResponse.map((item) => item.body));
        break;
      }
      case 'create': {
        if (!Array.isArray(records)) {
          return next(new UserFacingError(`The records property must be included`));
        }
        operationPromise = conn.request({
          method: 'POST',
          headers,
          url: isTooling ? `${baseUrl}/tooling/composite/sobjects` : `${baseUrl}/composite/sobjects`,
          body: JSON.stringify({
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: undefined })),
          }),
        });
        break;
      }
      case 'update': {
        if (!Array.isArray(records)) {
          return next(new UserFacingError(`The records property must be included`));
        }
        operationPromise = conn.request({
          method: 'PATCH',
          headers,
          url: isTooling ? `${baseUrl}/tooling/composite/sobjects` : `${baseUrl}/composite/sobjects`,
          body: JSON.stringify({
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: record.Id })),
          }),
        });
        break;
      }
      case 'upsert': {
        if (!Array.isArray(records) || !externalId) {
          return next(new UserFacingError(`The records and external id properties must be included`));
        }
        operationPromise = conn.request({
          method: 'PATCH',
          headers,
          url: isTooling
            ? `${baseUrl}/tooling/composite/sobjects/${sobject}/${externalId}`
            : `${baseUrl}/composite/sobjects/${sobject}/${externalId}`,
          body: JSON.stringify({
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject } })),
          }),
        });
        break;
      }
      case 'delete': {
        if (!Array.isArray(ids)) {
          return next(new UserFacingError(`The ids property must be included`));
        }
        operationPromise = conn.request({
          method: 'DELETE',
          url: isTooling
            ? `${baseUrl}/tooling/composite/sobjects?ids=${ids.join(',')}`
            : `${baseUrl}/composite/sobjects?ids=${ids.join(',')}`,
        });
        break;
      }
      default:
        return next(new UserFacingError(`The operation ${operation} is not valid`));
    }

    const results = await operationPromise;

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

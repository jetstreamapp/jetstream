import { HTTP } from '@jetstream/shared/constants';
import { NextFunction, Request, Response } from 'express';
import { body, query as queryString } from 'express-validator';
import * as jsforce from 'jsforce';
import * as queryService from '../services/query';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  query: [body('query').isString()],
  queryMore: [queryString('nextRecordsUrl').isString()],
};

export async function describe(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const conn: jsforce.Connection = res.locals.jsforceConn;

    // Use If-Modified-Since header to check for changes
    if (req.get(HTTP.HEADERS.IF_MODIFIED_SINCE)) {
      const requestOptions: jsforce.RequestInfo = {
        method: 'GET',
        url: isTooling ? `/services/data/v${conn.version}/tooling/sobjects/` : `/services/data/v${conn.version}/sobjects/`,
        headers: {
          ['Content-Type']: 'application/json;charset=utf-8',
          [HTTP.HEADERS.IF_MODIFIED_SINCE]: req.get(HTTP.HEADERS.IF_MODIFIED_SINCE),
        },
      };
      const results = await conn.request(requestOptions);
      if (!results) {
        res.set(HTTP.HEADERS.X_CACHE_KEY, req.get(HTTP.HEADERS.X_CACHE_KEY));
        res.status(299).send();
        return;
      }
      sendJson(res, results);
      return;
    }

    const results = await (isTooling ? conn.tooling.describeGlobal() : conn.describeGlobal());
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function describeSObject(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const sobject = req.params.sobject;

    // Use If-Modified-Since header to check for changes
    if (req.get(HTTP.HEADERS.IF_MODIFIED_SINCE)) {
      const requestOptions: jsforce.RequestInfo = {
        method: 'GET',
        url: isTooling
          ? `/services/data/v${conn.version}/tooling/sobjects/${sobject}/describe`
          : `/services/data/v${conn.version}/sobjects/${sobject}/describe`,
        headers: {
          ['Content-Type']: 'application/json;charset=utf-8',
          [HTTP.HEADERS.IF_MODIFIED_SINCE]: req.get(HTTP.HEADERS.IF_MODIFIED_SINCE),
        },
      };
      const results = await conn.request(requestOptions);
      if (!results) {
        res.set(HTTP.HEADERS.X_CACHE_KEY, req.get(HTTP.HEADERS.X_CACHE_KEY));
        res.status(299).send();
        return;
      }
      sendJson(res, results);
      return;
    }

    const results = await (isTooling ? conn.tooling.describe(sobject) : conn.describe(sobject));
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function query(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const includeDeletedRecords = req.query.includeDeletedRecords === 'true';
    const query = req.body.query;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const response = await queryService.queryRecords(conn, query, isTooling, includeDeletedRecords);

    sendJson(res, response);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function queryMore(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const nextRecordsUrl = req.query.nextRecordsUrl as string;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    const response = await queryService.queryMoreRecords(conn, nextRecordsUrl, isTooling);

    sendJson(res, response);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

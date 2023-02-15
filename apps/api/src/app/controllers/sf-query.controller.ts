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
    if (req.headers[HTTP.HEADERS.IF_MODIFIED_SINCE]) {
      const requestOptions: jsforce.RequestInfo = {
        method: 'GET',
        url: `/services/data/${conn.version}/sobjects/`,
        headers: {
          ['Content-Type']: 'application/json;charset=utf-8',
          [HTTP.HEADERS.IF_MODIFIED_SINCE]: req.headers[HTTP.HEADERS.IF_MODIFIED_SINCE],
        },
      };
      // TODO: if 304, return 304
      // ensure no error is thrown from JSForce, otherwise need to use axios
      const results = await conn.request(requestOptions);
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
    const results = await (isTooling ? conn.tooling.describe(req.params.sobject) : conn.describe(req.params.sobject));
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

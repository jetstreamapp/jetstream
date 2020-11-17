import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import * as queryService from '../services/query';
import { sendJson } from '../utils/response.handlers';
import { UserFacingError } from '../utils/error-handler';
import { body, query as queryString } from 'express-validator';

export const routeValidators = {
  query: [body('query').isString()],
  queryMore: [queryString('nextRecordsUrl').isString()],
};

export async function describe(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const conn: jsforce.Connection = res.locals.jsforceConn;
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

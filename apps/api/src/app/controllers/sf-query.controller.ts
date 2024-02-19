import { ApiConnection } from '@jetstream/salesforce-api';
import { NextFunction, Request, Response } from 'express';
import { body, query as queryString } from 'express-validator';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  query: [body('query').isString()],
  queryMore: [queryString('nextRecordsUrl').isString()],
};

export async function describe(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.sobject.describe(isTooling);
    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function describeSObject(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.sobject.describeSobject(req.params.sobject, isTooling);

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

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.query.query(query, isTooling, includeDeletedRecords);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function queryMore(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const nextRecordsUrl = req.query.nextRecordsUrl as string;

    const jetstreamConn = res.locals.jetstreamConn as ApiConnection;
    const results = await jetstreamConn.query.queryMore(nextRecordsUrl, isTooling);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

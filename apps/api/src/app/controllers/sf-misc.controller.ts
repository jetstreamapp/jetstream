import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { toBoolean } from '@jetstream/shared/utils';
import { RestApiOptions, RecordResult } from 'jsforce';

export async function getFrontdoorLoginUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { returnUrl } = req.query;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    // ensure that our token is valid and not expired
    // FIXME: ideally we would store our most up-to-date access token instead of keeping around our old out-dated access token
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

export async function makeJsforceRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { url, method = 'GET' } = req.body; // TODO: add validation
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const results = await conn.request({ method, url });
    sendJson(res, results);
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

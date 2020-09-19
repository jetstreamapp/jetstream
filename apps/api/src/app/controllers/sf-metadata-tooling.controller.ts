import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import { sendJson } from '../utils/response.handlers';
import { UserFacingError } from '../utils/error-handler';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';

// async function tempJsforceConn() {
//   const conn = new jsforce.Connection({
//     loginUrl: 'https://login.salesforce.com',
//   });
//   await conn.login('austin@atginfo-personal.com', '25M2p^$MvC2*o#');
//   return conn;
// }

export async function listMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const isTooling = req.query.isTooling === 'true';
    const conn: jsforce.Connection = res.locals.jsforceConn;
    // TODO: implement me
    sendJson(res, ['TODO']);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function readMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const fullNames: string[] = req.body.fullNames;
    const metadataType = req.params.type;
    const conn: jsforce.Connection = res.locals.jsforceConn;

    if (!Array.isArray(fullNames) || fullNames.length === 0) {
      throw new UserFacingError('fullNames must be provided');
    }
    const results = await (
      await Promise.all(splitArrayToMaxSize(fullNames, 10).map((fullNames) => conn.metadata.read(metadataType, fullNames)))
    ).flat();

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

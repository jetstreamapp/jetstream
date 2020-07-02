import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

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

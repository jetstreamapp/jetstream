import { logger } from '@jetstream/api-config';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { UserProfileServer } from '@jetstream/types';
import { SalesforceOrg } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export async function getOrgs(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const orgs = await salesforceOrgsDb.findByUserId(user.id);

    sendJson(res, orgs);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function updateOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;

    const data = { label: req.body.label, color: req.body.color };
    const salesforceOrg = await salesforceOrgsDb.updateSalesforceOrg(user.id, req.params.uniqueId, data);

    sendJson(res, salesforceOrg, 201);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deleteOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    salesforceOrgsDb.deleteSalesforceOrg(user.id, req.params.uniqueId);

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

/**
 * Check if the org is still valid
 * This can be used to retry an org that has been marked as invalid
 */
export async function checkOrgHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
    const conn: jsforce.Connection = res.locals.jsforceConn;
    const org = res.locals.org as SalesforceOrg;

    let connectionError = org.connectionError;

    try {
      await conn.identity();
      connectionError = null;
      logger.warn('[ORG CHECK][VALID ORG]', { requestId: res.locals.requestId });
    } catch (ex) {
      connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      logger.warn('[ORG CHECK][INVALID ORG] %s', ex.message, { requestId: res.locals.requestId });
    }

    try {
      if (connectionError !== org.connectionError) {
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError });
      }
    } catch (ex) {
      logger.warn('[ERROR UPDATING INVALID ORG] %s', ex.message, { error: ex.message, userInfo, requestId: res.locals.requestId });
    }

    if (connectionError) {
      throw new UserFacingError('Your org is no longer valid. Reconnect this org to Salesforce.');
    }

    sendJson(res, undefined, 200);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

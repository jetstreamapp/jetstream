import { UserProfileServer } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
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

    const data = { label: req.body.label };
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

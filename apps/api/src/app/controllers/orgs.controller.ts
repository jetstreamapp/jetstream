import { NextFunction, Request, Response } from 'express';
import { UserAuthSession } from '@jetstream/types';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { sendJson } from '../utils/response.handlers';
import { UserFacingError } from '../utils/error-handler';

export async function getOrgs(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.session.auth as UserAuthSession;
    const orgs = await SalesforceOrg.findByUserId(userId);
    sendJson(res, orgs);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

// TODO: this is not yet implemented in UI
export async function deleteOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.session.auth as UserAuthSession;
    const existingOrg = await SalesforceOrg.findByUniqueId(userId, req.params.uniqueId);
    if (!existingOrg) {
      return next(new UserFacingError('An org was not found with the provided id'));
    }

    await existingOrg.remove();

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

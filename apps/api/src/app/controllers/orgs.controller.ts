import { UserProfileServer } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export async function getOrgs(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const orgs = await SalesforceOrg.findByUserId(user.id);
    sendJson(res, orgs);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function updateOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const existingOrg = await SalesforceOrg.findByUniqueId(user.id, req.params.uniqueId);
    if (!existingOrg) {
      return next(new UserFacingError('An org was not found with the provided id'));
    }

    // update specific properties
    existingOrg.label = req.body.label;

    await existingOrg.save();

    sendJson(res, undefined, 201);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

export async function deleteOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const existingOrg = await SalesforceOrg.findByUniqueId(user.id, req.params.uniqueId);
    if (!existingOrg) {
      return next(new UserFacingError('An org was not found with the provided id'));
    }

    await existingOrg.remove();

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

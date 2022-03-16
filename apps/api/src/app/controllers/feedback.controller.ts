import { logger } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { body } from 'express-validator';
import { createIssue } from '../services/github';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  submit: [body('title').isString().isLength({ min: 1, max: 256 }), body('body').isString()],
};

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const { title, body } = req.body as { title: string; body: string; ticketContent: string };
    const results = await createIssue(title, body);

    /**
     * TODO: email user with ticket title and number and let them know we received their request
     */
    logger.debug('[FEEDBACK ISSUE CREATED] %s', user.id, { title, ticket: results.data.number });
    sendJson(res, { id: results.data.number }, 200);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}

import { logger, mailgun } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { AxiosError } from 'axios';
import * as express from 'express';
import { body, query as queryString } from 'express-validator';
import { deleteUserAndOrgs } from '../db/transactions.db';
import * as auth0Service from '../services/auth0';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  updateProfile: [body('name').isString().isLength({ min: 1, max: 255 })],
  unlinkIdentity: [queryString('provider').isString().isLength({ min: 1 }), queryString('userId').isString().isLength({ min: 1 })],
  resendVerificationEmail: [queryString('provider').isString().isLength({ min: 1 }), queryString('userId').isString().isLength({ min: 1 })],
  deleteAccount: [body('reason').isString().optional()],
};

export async function getUserProfile(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  sendJson(res, user._json);
}

/** Get profile from Auth0 */
export async function getFullUserProfile(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  try {
    const auth0User = await auth0Service.getUser(user);
    sendJson(res, auth0User);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][PROFILE FETCH][ERROR] %o', error.response.data, { userId: user.id });
      } else if (error.request) {
        logger.error('[AUTH0][PROFILE FETCH][ERROR] %s', error.message || 'An unknown error has occurred.', { userId: user.id });
      }
    }
    throw new UserFacingError('There was an error obtaining your profile information');
  }
}

export async function updateProfile(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  const userProfile = { name: req.body.name };

  try {
    const auth0User = await auth0Service.updateUser(user, userProfile);
    sendJson(res, auth0User);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][PROFILE][ERROR] %o', error.response.data, { userId: user.id });
      } else if (error.request) {
        logger.error('[AUTH0][PROFILE][ERROR] %s', error.message || 'An unknown error has occurred.', { userId: user.id });
      }
    }
    throw new UserFacingError('There was an error updating the user profile');
  }
}

export async function unlinkIdentity(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  try {
    const provider = req.query.provider as string;
    const userId = req.query.userId as string;

    const auth0User = await auth0Service.unlinkIdentity(user, { provider, userId });
    sendJson(res, auth0User);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][UNLINK][ERROR] %o', error.response.data, { userId: user.id });
      } else if (error.request) {
        logger.error('[AUTH0][UNLINK][ERROR] %s', error.message || 'An unknown error has occurred.', { userId: user.id });
      }
    }
    throw new UserFacingError('There was an error unlinking the account');
  }
}

export async function resendVerificationEmail(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  const provider = req.query.provider as string;
  const userId = req.query.userId as string;
  try {
    const auth0User = await auth0Service.resendVerificationEmail(user, { provider, userId });
    sendJson(res, auth0User);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][EMAIL VERIFICATION][ERROR] %o', error.response.data, { userId: user.id });
      } else if (error.request) {
        logger.error('[AUTH0][EMAIL VERIFICATION][ERROR] %s', error.message || 'An unknown error has occurred.', { userId: user.id });
      }
    }
    throw new UserFacingError('There was an error re-sending the verification email');
  }
}

export async function deleteAccount(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  try {
    const reason = req.body.reason as string | undefined;

    // delete from Auth0
    await auth0Service.deleteUser(user);

    // delete locally
    await deleteUserAndOrgs(user);

    try {
      // Send email to team about account deletion - if user provided a reason, then we can capture that
      mailgun.messages
        .create('mail.getjetstream.app', {
          from: 'Jetstream Support <support@getjetstream.app>',
          to: 'support@getjetstream.app',
          subject: 'Jetstream - Account deletion notification',
          template: 'generic_notification',
          'h:X-Mailgun-Variables': JSON.stringify({
            title: 'Jetstream account deleted',
            previewText: 'Account was deleted',
            headline: `Account was deleted`,
            bodySegments: [
              {
                text: `The account ${user.id} was deleted.`,
              },
              {
                text: reason ? `Reason: ${reason}` : `The user did not provide any reason.`,
              },
              {
                text: JSON.stringify(user, null, 2),
              },
            ],
          }),
          'h:Reply-To': 'support@getjetstream.app',
        })
        .then((results) => {
          logger.info('[ACCOUNT DELETE][EMAIL SENT] %s', results.data.id);
        })
        .catch((error) => {
          logger.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', error.message);
        });
    } catch (ex) {
      logger.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', ex.message);
    }

    // Destroy session - don't wait for response
    req.session.destroy((error) => {
      if (error) {
        logger.error('[ACCOUNT DELETE][ERROR DESTROYING SESSION] %s', error.message);
      }
    });

    sendJson(res);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[ACCOUNT DELETE][FATAL ERROR] %o', error.response.data, { userId: user.id });
      } else if (error.request) {
        logger.error('[ACCOUNT DELETE][FATAL ERROR] %s', error.message || 'An unknown error has occurred.', { userId: user.id });
      }
    }
    throw new UserFacingError('There was a problem deleting your account, contact support@getjetstream.app for assistance.');
  }
}

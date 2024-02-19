import { ENV, logger, mailgun } from '@jetstream/api-config';
import { UserProfileAuth0Ui, UserProfileServer, UserProfileUi, UserProfileUiWithIdentities } from '@jetstream/types';
import { AxiosError } from 'axios';
import { body, query as queryString } from 'express-validator';
import { deleteUserAndOrgs } from '../db/transactions.db';
import * as userDbService from '../db/user.db';
import * as auth0Service from '../services/auth0';
import { Request, Response } from '../types/types';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

export const routeValidators = {
  updateProfile: [body('name').isString().isLength({ min: 1, max: 255 }), body('preferences').isObject().optional()],
  unlinkIdentity: [queryString('provider').isString().isLength({ min: 1 }), queryString('userId').isString().isLength({ min: 1 })],
  resendVerificationEmail: [queryString('provider').isString().isLength({ min: 1 }), queryString('userId').isString().isLength({ min: 1 })],
  deleteAccount: [body('reason').isString().optional()],
};

export async function emailSupport(req: Request<unknown, { emailBody?: any }, unknown>, res: Response) {
  const user = req.user as UserProfileServer;
  const files = Array.isArray(req.files) ? req.files : [];
  const { emailBody } = req.body || {};

  try {
    const results = await mailgun.messages.create('mail.getjetstream.app', {
      from: 'Jetstream Support <support@getjetstream.app>',
      to: 'support@getjetstream.app',
      subject: 'Jetstream - User submitted feedback',
      template: 'generic_notification',
      attachment: files?.map((file) => ({ data: file.buffer, filename: file.originalname })),
      'h:X-Mailgun-Variables': JSON.stringify({
        title: 'User submitted feedback',
        previewText: 'User submitted feedback',
        headline: `User submitted feedback`,
        bodySegments: [
          {
            text: emailBody,
          },
          {
            text: `The account ${user.id} has submitted feedback.`,
          },
          {
            text: JSON.stringify(user, null, 2),
          },
        ],
      }),
      'h:Reply-To': 'support@getjetstream.app',
    });
    logger.info('[SUPPORT EMAIL][EMAIL SENT] %s', results.id, { requestId: res.locals.requestId });
    sendJson(res);
  } catch (ex) {
    logger.error('[SUPPORT EMAIL][ERROR] %s', ex.message || 'An unknown error has occurred.', {
      userId: user.id,
      requestId: res.locals.requestId,
    });
    logger.error('%o', ex.stack, { requestId: res.locals.requestId });
    throw new UserFacingError('There was a problem sending the email');
  }
}

export async function getUserProfile(req: Request<unknown, unknown, unknown>, res: Response) {
  const auth0User = req.user as UserProfileServer;

  // use fallback locally and on CI
  if (ENV.EXAMPLE_USER_OVERRIDE && ENV.EXAMPLE_USER_PROFILE && req.hostname === 'localhost') {
    sendJson(res, ENV.EXAMPLE_USER_PROFILE);
    return;
  }

  const user = await userDbService.findByUserId(auth0User.id);
  if (!user) {
    throw new UserFacingError('User not found');
  }
  const userProfileUi: UserProfileUi = {
    ...(auth0User._json as any),
    id: user.id,
    userId: user.userId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    preferences: {
      skipFrontdoorLogin: user.preferences?.skipFrontdoorLogin,
    },
  };
  sendJson(res, userProfileUi);
}

async function getFullUserProfileFn(sessionUser: UserProfileServer, auth0User?: UserProfileAuth0Ui) {
  auth0User = auth0User || (await auth0Service.getUser(sessionUser));
  const jetstreamUser = await userDbService.findByUserId(sessionUser.id);
  if (!jetstreamUser) {
    throw new UserFacingError('User not found');
  }
  const response: UserProfileUiWithIdentities = {
    id: jetstreamUser.id,
    userId: sessionUser.id,
    name: jetstreamUser.name || '',
    email: jetstreamUser.email,
    emailVerified: auth0User.email_verified,
    username: auth0User.username || '',
    nickname: auth0User.nickname,
    picture: auth0User.picture,
    preferences: {
      skipFrontdoorLogin: jetstreamUser.preferences?.skipFrontdoorLogin ?? false,
    },
    identities: auth0User.identities,
    createdAt: jetstreamUser.createdAt.toISOString(),
    updatedAt: jetstreamUser.updatedAt.toISOString(),
  };
  return response;
}

/** Get profile from Auth0 */
export async function getFullUserProfile(req: Request<unknown, unknown, unknown>, res: Response) {
  const user = req.user as UserProfileServer;
  try {
    const response = await getFullUserProfileFn(user);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][PROFILE FETCH][ERROR] %o', error.response.data, { userId: user.id, requestId: res.locals.requestId });
      } else if (error.request) {
        logger.error('[AUTH0][PROFILE FETCH][ERROR] %s', error.message || 'An unknown error has occurred.', {
          userId: user.id,
          requestId: res.locals.requestId,
        });
      }
    }
    throw new UserFacingError('There was an error obtaining your profile information');
  }
}

export async function updateProfile(req: Request<unknown, unknown, unknown>, res: Response) {
  const user = req.user as UserProfileServer;
  const userProfile = req.body as UserProfileUiWithIdentities;

  try {
    // check for name change, if so call auth0 to update
    const auth0User = await auth0Service.updateUser(user, userProfile);
    // update name and preferences locally
    const response = await getFullUserProfileFn(user, auth0User);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][PROFILE][ERROR] %o', error.response.data, { userId: user.id, requestId: res.locals.requestId });
      } else if (error.request) {
        logger.error('[AUTH0][PROFILE][ERROR] %s', error.message || 'An unknown error has occurred.', {
          userId: user.id,
          requestId: res.locals.requestId,
        });
      }
    }
    throw new UserFacingError('There was an error updating the user profile');
  }
}

export async function unlinkIdentity(req: Request<unknown, unknown, { provider: string; userId: string }>, res: Response) {
  const user = req.user as UserProfileServer;
  try {
    const provider = req.query.provider;
    const userId = req.query.userId;

    const auth0User = await auth0Service.unlinkIdentity(user, { provider, userId });
    const response = await getFullUserProfileFn(user, auth0User);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][UNLINK][ERROR] %o', error.response.data, { userId: user.id, requestId: res.locals.requestId });
      } else if (error.request) {
        logger.error('[AUTH0][UNLINK][ERROR] %s', error.message || 'An unknown error has occurred.', {
          userId: user.id,
          requestId: res.locals.requestId,
        });
      }
    }
    throw new UserFacingError('There was an error unlinking the account');
  }
}

export async function resendVerificationEmail(req: Request<unknown, unknown, { provider: string; userId: string }>, res: Response) {
  const user = req.user as UserProfileServer;
  const provider = req.query.provider;
  const userId = req.query.userId;
  try {
    await auth0Service.resendVerificationEmail(user, { provider, userId });
    sendJson(res);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[AUTH0][EMAIL VERIFICATION][ERROR] %o', error.response.data, { userId: user.id, requestId: res.locals.requestId });
      } else if (error.request) {
        logger.error('[AUTH0][EMAIL VERIFICATION][ERROR] %s', error.message || 'An unknown error has occurred.', {
          userId: user.id,
          requestId: res.locals.requestId,
        });
      }
    }
    throw new UserFacingError('There was an error re-sending the verification email');
  }
}

export async function deleteAccount(req: Request<unknown, { reason?: string }, unknown>, res: Response) {
  const user = req.user as UserProfileServer;
  try {
    const reason = req.body.reason;

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
          logger.info('[ACCOUNT DELETE][EMAIL SENT] %s', results.id, { requestId: res.locals.requestId });
        })
        .catch((error) => {
          logger.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', error.message, { requestId: res.locals.requestId });
        });
    } catch (ex) {
      logger.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', ex.message, { requestId: res.locals.requestId });
    }

    // Destroy session - don't wait for response
    req.session.destroy((error) => {
      if (error) {
        logger.error('[ACCOUNT DELETE][ERROR DESTROYING SESSION] %s', error.message, { requestId: res.locals.requestId });
      }
    });

    sendJson(res);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error('[ACCOUNT DELETE][FATAL ERROR] %o', error.response.data, { userId: user.id, requestId: res.locals.requestId });
      } else if (error.request) {
        logger.error('[ACCOUNT DELETE][FATAL ERROR] %s', error.message || 'An unknown error has occurred.', {
          userId: user.id,
          requestId: res.locals.requestId,
        });
      }
    }
    throw new UserFacingError('There was a problem deleting your account, contact support@getjetstream.app for assistance.');
  }
}

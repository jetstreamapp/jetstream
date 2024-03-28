import { ENV, getExceptionLog, mailgun } from '@jetstream/api-config';
import { UpdateProfileRequestSchema } from '@jetstream/api-types';
import { UserProfileAuth0Ui, UserProfileServer, UserProfileUi, UserProfileUiWithIdentities } from '@jetstream/types';
import { AxiosError } from 'axios';
import { z } from 'zod';
import { deleteUserAndOrgs } from '../db/transactions.db';
import * as userDbService from '../db/user.db';
import * as auth0Service from '../services/auth0';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  emailSupport: {
    controllerFn: () => emailSupport,
    validators: {
      hasSourceOrg: false,
    },
  },
  getUserProfile: {
    controllerFn: () => getUserProfile,
    validators: {
      hasSourceOrg: false,
    },
  },
  getFullUserProfile: {
    controllerFn: () => getFullUserProfile,
    validators: {
      hasSourceOrg: false,
    },
  },
  updateProfile: {
    controllerFn: () => updateProfile,
    validators: {
      hasSourceOrg: false,
      body: UpdateProfileRequestSchema,
    },
  },
  unlinkIdentity: {
    controllerFn: () => unlinkIdentity,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        provider: z.string().min(1),
        userId: z.string().min(1),
      }),
    },
  },
  resendVerificationEmail: {
    controllerFn: () => resendVerificationEmail,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        provider: z.string().min(1),
        userId: z.string().min(1),
      }),
    },
  },
  deleteAccount: {
    controllerFn: () => deleteAccount,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        reason: z.string().nullish(),
      }),
    },
  },
};

const emailSupport = createRoute(routeDefinition.emailSupport.validators, async ({ body, user }, req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const { emailBody } = body || {};

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
    req.log.info('[SUPPORT EMAIL][EMAIL SENT] %s', results.id);
    sendJson(res);
  } catch (ex) {
    req.log.error(getExceptionLog(ex), '[SUPPORT EMAIL][ERROR] %s', ex.message || 'An unknown error has occurred.');
    throw new UserFacingError('There was a problem sending the email');
  }
});

const getUserProfile = createRoute(routeDefinition.getUserProfile.validators, async ({ user: auth0User }, req, res, next) => {
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
});

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
const getFullUserProfile = createRoute(routeDefinition.getFullUserProfile.validators, async ({ user }, req, res, next) => {
  try {
    const response = await getFullUserProfileFn(user);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        req.log.error(getExceptionLog(ex), '[AUTH0][PROFILE FETCH][ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error(getExceptionLog(ex), '[AUTH0][PROFILE FETCH][ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was an error obtaining your profile information');
  }
});

const updateProfile = createRoute(routeDefinition.updateProfile.validators, async ({ body, user }, req, res, next) => {
  const userProfile = body;

  try {
    // check for name change, if so call auth0 to update
    const auth0User = await auth0Service.updateUser(user, userProfile as any);
    // update name and preferences locally
    const response = await getFullUserProfileFn(user, auth0User);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        req.log.error(getExceptionLog(ex), '[AUTH0][PROFILE][ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error(getExceptionLog(ex), '[AUTH0][PROFILE][ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was an error updating the user profile');
  }
});

const unlinkIdentity = createRoute(routeDefinition.unlinkIdentity.validators, async ({ query, user }, req, res, next) => {
  try {
    const provider = query.provider;
    const userId = query.userId;

    const auth0User = await auth0Service.unlinkIdentity(user, { provider, userId });
    const response = await getFullUserProfileFn(user, auth0User);
    sendJson(res, response);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        req.log.error(getExceptionLog(ex), '[AUTH0][UNLINK][ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error(getExceptionLog(ex), '[AUTH0][UNLINK][ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was an error unlinking the account');
  }
});

const resendVerificationEmail = createRoute(routeDefinition.resendVerificationEmail.validators, async ({ query, user }, req, res, next) => {
  const provider = query.provider;
  const userId = query.userId;
  try {
    await auth0Service.resendVerificationEmail(user, { provider, userId });
    sendJson(res);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        req.log.error(getExceptionLog(ex), '[AUTH0][EMAIL VERIFICATION][ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error(getExceptionLog(ex), '[AUTH0][EMAIL VERIFICATION][ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was an error re-sending the verification email');
  }
});

const deleteAccount = createRoute(routeDefinition.deleteAccount.validators, async ({ body, user, requestId }, req, res, next) => {
  try {
    const reason = body.reason;

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
          req.log.info('[ACCOUNT DELETE][EMAIL SENT] %s', results.id);
        })
        .catch((error) => {
          req.log.error({ requestId, ...getExceptionLog(error) }, '[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', error.message);
        });
    } catch (ex) {
      req.log.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', ex.message);
    }

    // Destroy session - don't wait for response
    req.session.destroy((error) => {
      if (error) {
        req.log.error({ requestId, ...getExceptionLog(error) }, '[ACCOUNT DELETE][ERROR DESTROYING SESSION] %s', error.message);
      }
    });

    sendJson(res);
  } catch (ex) {
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        req.log.error(getExceptionLog(ex), '[ACCOUNT DELETE][FATAL ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error(getExceptionLog(ex), '[ACCOUNT DELETE][FATAL ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was a problem deleting your account, contact support@getjetstream.app for assistance.');
  }
});

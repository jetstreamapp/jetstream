import { ENV, getExceptionLog } from '@jetstream/api-config';
import {
  clearOauthCookies,
  convertBase32ToHex,
  createOrUpdateOtpAuthFactor,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  deleteAuthFactor,
  generate2faTotpUrl,
  generatePasswordResetToken,
  getAuthorizationUrl,
  getCookieConfig,
  getUserSessions,
  PASSWORD_RESET_DURATION_MINUTES,
  removeIdentityFromUser,
  removePasswordFromUser,
  revokeAllUserSessions,
  revokeUserSession,
  setPasswordForUser,
  toggleEnableDisableAuthFactor,
  verify2faTotpOrThrow,
} from '@jetstream/auth/server';
import { OauthProviderTypeSchema } from '@jetstream/auth/types';
import {
  sendAuthenticationChangeConfirmation,
  sendGoodbyeEmail,
  sendInternalAccountDeletionEmail,
  sendPasswordReset,
} from '@jetstream/email';
import { AxiosError } from 'axios';
import { z } from 'zod';
import * as userDbService from '../db/user.db';
import { UserFacingError } from '../utils/error-handler';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getUserProfile: {
    controllerFn: () => getUserProfile,
    validators: {
      hasSourceOrg: false,
    },
  },
  initPassword: {
    controllerFn: () => initPassword,
    validators: {
      body: z.object({
        password: z.string().min(8).max(255),
      }),
      hasSourceOrg: false,
    },
  },
  initResetPassword: {
    controllerFn: () => initResetPassword,
    validators: {
      hasSourceOrg: false,
    },
  },
  deletePassword: {
    controllerFn: () => deletePassword,
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
  getSessions: {
    controllerFn: () => getSessions,
    validators: {
      hasSourceOrg: false,
    },
  },
  revokeSession: {
    controllerFn: () => revokeSession,
    validators: {
      params: z.object({
        id: z.string().min(32).max(64),
      }),
      hasSourceOrg: false,
    },
  },
  revokeAllSessions: {
    controllerFn: () => revokeAllSessions,
    validators: {
      body: z
        .object({
          exceptId: z.string().min(32).max(64).nullish(),
        })
        .nullish(),
      hasSourceOrg: false,
    },
  },
  updateProfile: {
    controllerFn: () => updateProfile,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        name: z.string().min(1).max(255).trim().optional(),
        preferences: z
          .object({
            skipFrontdoorLogin: z.boolean().optional(),
            recordSyncEnabled: z.boolean().optional(),
          })
          .optional(),
      }),
    },
  },
  getOtpQrCode: {
    controllerFn: () => getOtpQrCode,
    validators: {
      hasSourceOrg: false,
    },
  },
  saveOtpAuthFactor: {
    controllerFn: () => saveOtpAuthFactor,
    validators: {
      body: z.object({
        code: z.string().min(6).max(6),
        secretToken: z.string().min(32).max(32),
      }),
      hasSourceOrg: false,
    },
  },
  toggleEnableDisableAuthFactor: {
    controllerFn: () => toggleEnableDisableAuthFactorRoute,
    validators: {
      params: z.object({
        type: z.enum(['2fa-otp', '2fa-email']),
        action: z.enum(['enable', 'disable']),
      }),
      hasSourceOrg: false,
    },
  },
  deleteAuthFactor: {
    controllerFn: () => deleteAuthFactorRoute,
    validators: {
      params: z.object({
        type: z.enum(['2fa-otp', '2fa-email']),
      }),
      hasSourceOrg: false,
    },
  },
  unlinkIdentity: {
    controllerFn: () => unlinkIdentity,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        provider: OauthProviderTypeSchema,
        providerAccountId: z.string().min(1),
      }),
    },
  },
  linkIdentity: {
    controllerFn: () => linkIdentity,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        provider: OauthProviderTypeSchema,
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

const getUserProfile = createRoute(routeDefinition.getUserProfile.validators, async ({ user }, req, res) => {
  const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id });
  sendJson(res, userProfile);
});

const getFullUserProfile = createRoute(routeDefinition.getFullUserProfile.validators, async ({ user }, req, res) => {
  sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
});

const initPassword = createRoute(routeDefinition.initPassword.validators, async ({ body, user }, req, res) => {
  const { password } = body;
  const results = await setPasswordForUser(user.id, password);
  if ('error' in results) {
    throw new UserFacingError(results.error);
  }
  sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));

  createUserActivityFromReq(req, res, {
    action: 'PASSWORD_SET',
    method: 'USER_PROFILE',
    success: true,
  });
});

const initResetPassword = createRoute(routeDefinition.initResetPassword.validators, async ({ user }, req, res) => {
  const { email, token } = await generatePasswordResetToken(user.email);
  await sendPasswordReset(email, token, PASSWORD_RESET_DURATION_MINUTES);
  sendJson(res);
  createUserActivityFromReq(req, res, {
    action: 'PASSWORD_RESET_REQUEST',
    method: 'USER_PROFILE',
    success: true,
  });
});

const deletePassword = createRoute(routeDefinition.deletePassword.validators, async ({ user }, req, res) => {
  await removePasswordFromUser(user.id);

  await sendAuthenticationChangeConfirmation(user.email, 'Your password has been removed from your account', {
    preview: 'Your password has been removed from your account.',
    heading: 'You have removed your password as a login method',
  });

  sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
});

const updateProfile = createRoute(routeDefinition.updateProfile.validators, async ({ body, user }, req, res) => {
  const userProfile = body;

  try {
    await userDbService.updateUser(user, userProfile);
    sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
  } catch (ex) {
    throw new UserFacingError('There was an error updating the user profile');
  }
});

const getSessions = createRoute(routeDefinition.getSessions.validators, async ({ user }, req, res) => {
  const sessions = await getUserSessions(user.id);
  sendJson(res, {
    currentSessionId: req.session.id,
    sessions,
  });
});

const revokeSession = createRoute(routeDefinition.revokeSession.validators, async ({ params, user }, req, res) => {
  const sessions = await revokeUserSession(user.id, params.id);
  sendJson(res, {
    currentSessionId: req.session.id,
    sessions,
  });

  createUserActivityFromReq(req, res, {
    action: 'REVOKE_SESSION',
    method: 'SINGLE',
    success: true,
  });
});

const revokeAllSessions = createRoute(routeDefinition.revokeAllSessions.validators, async ({ body, user }, req, res) => {
  const sessions = await revokeAllUserSessions(user.id, body?.exceptId);
  sendJson(res, {
    currentSessionId: req.session.id,
    sessions,
  });

  createUserActivityFromReq(req, res, {
    action: 'REVOKE_SESSION',
    method: 'ALL',
    success: true,
  });
});

const getOtpQrCode = createRoute(routeDefinition.getOtpQrCode.validators, async ({ user }, req, res) => {
  const { secret, imageUri, uri } = await generate2faTotpUrl(user.id);
  sendJson(res, { secret, secretToken: new URL(uri).searchParams.get('secret'), imageUri, uri });
});

const saveOtpAuthFactor = createRoute(routeDefinition.saveOtpAuthFactor.validators, async ({ body, user }, req, res) => {
  const { code, secretToken } = body;
  const secret = await convertBase32ToHex(secretToken);
  await verify2faTotpOrThrow(secret, code);
  const authFactors = await createOrUpdateOtpAuthFactor(user.id, secret);
  sendJson(res, authFactors);

  await sendAuthenticationChangeConfirmation(user.email, 'A new 2FA method has been added to your account', {
    preview: 'A new 2FA method has been added to your account.',
    heading: 'Authenticator app added',
  });

  createUserActivityFromReq(req, res, {
    action: '2FA_SETUP',
    method: '2FA-OTP',
    success: true,
  });
});

const toggleEnableDisableAuthFactorRoute = createRoute(
  routeDefinition.toggleEnableDisableAuthFactor.validators,
  async ({ params, user }, req, res) => {
    const { type, action } = params;
    const authFactors = await toggleEnableDisableAuthFactor(user.id, type, action);
    sendJson(res, authFactors);

    createUserActivityFromReq(req, res, {
      action: action === 'enable' ? '2FA_ACTIVATE' : '2FA_DEACTIVATE',
      method: type.toUpperCase(),
      success: true,
    });
  }
);

const deleteAuthFactorRoute = createRoute(routeDefinition.deleteAuthFactor.validators, async ({ params, user }, req, res) => {
  const { type } = params;
  const authFactors = await deleteAuthFactor(user.id, type);
  sendJson(res, authFactors);

  await sendAuthenticationChangeConfirmation(user.email, 'Two-factor authentication method removed', {
    preview: 'Two-factor authentication method removed.',
    heading: 'An authentication method has been removed',
  });

  createUserActivityFromReq(req, res, {
    action: '2FA_REMOVAL',
    method: type.toUpperCase(),
    success: true,
  });
});

const unlinkIdentity = createRoute(routeDefinition.unlinkIdentity.validators, async ({ query, user }, req, res) => {
  try {
    const { provider, providerAccountId } = query;

    await removeIdentityFromUser(user.id, provider, providerAccountId);
    const updatedUser = await userDbService.findUserWithIdentitiesById(user.id);

    sendJson(res, updatedUser);

    createUserActivityFromReq(req, res, {
      action: 'UNLINK_IDENTITY',
      method: provider.toUpperCase(),
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'UNLINK_IDENTITY',
      method: query?.provider?.toUpperCase(),
      success: false,
    });

    throw new UserFacingError('There was an error unlinking the account');
  }
});

const linkIdentity = createRoute(routeDefinition.linkIdentity.validators, async ({ query, user, setCookie }, req, res) => {
  const { provider } = query;
  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

  clearOauthCookies(res);
  const { authorizationUrl, code_verifier, nonce } = await getAuthorizationUrl(provider);
  if (code_verifier) {
    setCookie(cookieConfig.pkceCodeVerifier.name, code_verifier, cookieConfig.pkceCodeVerifier.options);
  }
  if (nonce) {
    setCookie(cookieConfig.nonce.name, nonce, cookieConfig.nonce.options);
  }
  setCookie(cookieConfig.linkIdentity.name, '1', cookieConfig.linkIdentity.options);
  setCookie(cookieConfig.returnUrl.name, `${ENV.JETSTREAM_CLIENT_URL}/app/profile`, cookieConfig.returnUrl.options);
  redirect(res, authorizationUrl.toString());

  await sendAuthenticationChangeConfirmation(user.email, 'A new identity has been linked to your account', {
    preview: 'A new identity has been linked to your account.',
    heading: 'A new login method has been added to your account',
  });

  createUserActivityFromReq(req, res, {
    action: 'LINK_IDENTITY_INIT',
    method: 'USER_PROFILE',
    success: true,
  });
});

const deleteAccount = createRoute(routeDefinition.deleteAccount.validators, async ({ body, user, requestId }, req, res) => {
  try {
    const reason = body.reason;

    await userDbService.deleteUserAndAllRelatedData(user.id);
    // Destroy session - don't wait for response
    req.session.destroy((error) => {
      if (error) {
        req.log.error({ requestId, ...getExceptionLog(error) }, '[ACCOUNT DELETE][ERROR DESTROYING SESSION]');
      }
    });

    try {
      await sendGoodbyeEmail(user.email);
      await sendInternalAccountDeletionEmail(user.id, reason);
    } catch (ex) {
      req.log.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', ex.message);
    }

    createUserActivityFromReq(req, res, {
      action: 'DELETE_ACCOUNT',
      method: 'USER_PROFILE',
      email: user.email,
      success: true,
    });

    sendJson(res);
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'DELETE_ACCOUNT',
      method: 'USER_PROFILE',
      email: user.email,
      success: false,
    });

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

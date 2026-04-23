import { ENV, logger } from '@jetstream/api-config';
import {
  AuthError,
  convertBase32ToHex,
  createOrUpdateOtpAuthFactor,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  deleteAuthFactor,
  generate2faTotpUrl,
  generatePasswordResetToken,
  getAllSessions,
  getLoginConfiguration,
  InvalidVerificationToken,
  PASSWORD_RESET_DURATION_MINUTES,
  removeIdentityFromUser,
  removePasswordFromUser,
  revokeAllUserSessions,
  revokeExternalSession,
  revokeUserSession,
  setPasswordForUser,
  toggleEnableDisableAuthFactor,
  verify2faTotpOrThrow,
} from '@jetstream/auth/server';
import { LoginConfigurationUI, OauthProviderTypeSchema } from '@jetstream/auth/types';
import {
  sendAuthenticationChangeConfirmation,
  sendGoodbyeEmail,
  sendInternalAccountDeletionEmail,
  sendPasswordReset,
} from '@jetstream/email';
import { getErrorMessage } from '@jetstream/shared/utils';
import { PasswordSchema, SoqlQueryFormatOptionsSchema, UserProfileUiSchema } from '@jetstream/types';
import { AxiosError } from 'axios';
import { z } from 'zod';
import * as userDbService from '../db/user.db';
import * as stripeService from '../services/stripe.service';
import { AuthenticationError, UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  getUserProfile: {
    controllerFn: () => getUserProfile,
    responseType: UserProfileUiSchema,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  initPassword: {
    controllerFn: () => initPassword,
    responseType: z.any(), // FIXME: need zod type for FullUserFacingProfileSelect
    validators: {
      body: z.object({
        password: PasswordSchema,
      }),
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  initResetPassword: {
    controllerFn: () => initResetPassword,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  deletePassword: {
    controllerFn: () => deletePassword,
    responseType: z.any(), // FIXME: need zod type for FullUserFacingProfileSelect
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  getFullUserProfile: {
    controllerFn: () => getFullUserProfile,
    responseType: z.any(), // FIXME: need zod type for FullUserFacingProfileSelect
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  getSessions: {
    controllerFn: () => getSessions,
    responseType: z.any(), // FIXME: need zod type for UserSessionAndExtTokensAndActivityWithLocation
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  revokeSession: {
    controllerFn: () => revokeSession,
    responseType: z.any(), // FIXME: need zod type for UserSessionAndExtTokensAndActivityWithLocation
    validators: {
      params: z.object({
        id: z.string().min(32).max(64),
      }),
      query: z.object({
        type: z.enum(['SESSION', 'EXTERNAL_SESSION']).optional().default('SESSION'),
      }),
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  revokeAllSessions: {
    controllerFn: () => revokeAllSessions,
    responseType: z.any(), // FIXME: need zod type for UserSessionAndExtTokensAndActivityWithLocation
    validators: {
      body: z
        .object({
          exceptId: z.string().min(32).max(64).nullish(),
        })
        .nullish(),
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  updateProfile: {
    controllerFn: () => updateProfile,
    responseType: z.any(), // FIXME: need zod type for FullUserFacingProfileSelect
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        name: z.string().min(1).max(255).trim().optional(),
        preferences: z
          .object({
            skipFrontdoorLogin: z.boolean().optional(),
            recordSyncEnabled: z.boolean().optional(),
            soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.optional(),
          })
          .optional(),
      }),
    } satisfies RouteValidator,
  },
  getUserLoginConfiguration: {
    controllerFn: () => getUserLoginConfiguration,
    responseType: z.any(), // FIXME: need zod type
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  getOtpQrCode: {
    controllerFn: () => getOtpQrCode,
    responseType: z.any(), // FIXME: need zod type
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  saveOtpAuthFactor: {
    controllerFn: () => saveOtpAuthFactor,
    responseType: z.any(), // FIXME: need zod type authFactors
    validators: {
      body: z.object({
        code: z.string().min(6).max(6),
        secretToken: z.string().min(32).max(32),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  toggleEnableDisableAuthFactor: {
    controllerFn: () => toggleEnableDisableAuthFactorRoute,
    responseType: z.any(), // FIXME: need zod type authFactors
    validators: {
      params: z.object({
        type: z.enum(['2fa-otp', '2fa-email']),
        action: z.enum(['enable', 'disable']),
      }),
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  deleteAuthFactor: {
    controllerFn: () => deleteAuthFactorRoute,
    responseType: z.any(), // FIXME: need zod type authFactors
    validators: {
      params: z.object({
        type: z.enum(['2fa-otp', '2fa-email']),
      }),
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    } satisfies RouteValidator,
  },
  unlinkIdentity: {
    controllerFn: () => unlinkIdentity,
    responseType: z.any(), // FIXME: need zod type for FullUserFacingProfileSelect
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      query: z.object({
        provider: OauthProviderTypeSchema,
        providerAccountId: z.string().min(1),
      }),
    } satisfies RouteValidator,
  },
  deleteAccount: {
    controllerFn: () => deleteAccount,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      body: z.object({
        reason: z.string().nullish(),
      }),
    } satisfies RouteValidator,
  },
};

const getUserProfile = createRoute(routeDefinition.getUserProfile.validators, async ({ user }, req, res, next) => {
  try {
    const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id });
    sendJson(res, userProfile);
  } catch (ex) {
    res.log.error({ err: ex }, 'Error fetching user profile');
    req.session.destroy(() => {
      next(new AuthenticationError('Unable to get user profile, please log in again'));
    });
  }
});

const getFullUserProfile = createRoute(routeDefinition.getFullUserProfile.validators, async ({ user }, _, res) => {
  sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
});

const initPassword = createRoute(routeDefinition.initPassword.validators, async ({ body, user }, req, res) => {
  const { password } = body;
  const results = await setPasswordForUser(user.id, password);
  if ('error' in results) {
    throw new UserFacingError(results.error);
  }
  // Revoke other sessions so an attacker with a stolen session loses access when the legitimate user rotates credentials.
  await revokeAllUserSessions(user.id, req.session.id);
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

  // Revoke other sessions so an attacker with a stolen session loses access when the legitimate user rotates credentials.
  await revokeAllUserSessions(user.id, req.session.id);

  await sendAuthenticationChangeConfirmation(user.email, 'Your password has been removed from your account', {
    heading: 'You have removed your password as a login method',
  });

  sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
  createUserActivityFromReq(req, res, {
    action: 'PASSWORD_REMOVE',
    method: 'USER_PROFILE',
    success: true,
  });
});

const updateProfile = createRoute(routeDefinition.updateProfile.validators, async ({ body, user }, _, res) => {
  const userProfile = body;

  try {
    await userDbService.updateUser(user, userProfile);
    sendJson(res, await userDbService.findUserWithIdentitiesById(user.id));
  } catch {
    throw new UserFacingError('There was an error updating the user profile');
  }
});

const getSessions = createRoute(routeDefinition.getSessions.validators, async ({ user }, req, res) => {
  const sessions = await getAllSessions(user.id, req.session.id);
  sendJson(res, sessions);
});

const revokeSession = createRoute(routeDefinition.revokeSession.validators, async ({ params, query, user }, req, res) => {
  const { type } = query;
  if (type === 'SESSION') {
    await revokeUserSession(user.id, params.id);
  } else if (type === 'EXTERNAL_SESSION') {
    await revokeExternalSession(user.id, params.id);
  }
  const sessions = await getAllSessions(user.id, req.session.id);
  sendJson(res, sessions);

  createUserActivityFromReq(req, res, {
    action: 'REVOKE_SESSION',
    method: 'SINGLE',
    success: true,
    userId: user.id,
  });
});

const revokeAllSessions = createRoute(routeDefinition.revokeAllSessions.validators, async ({ body, user }, req, res) => {
  await revokeAllUserSessions(user.id, body?.exceptId);
  const sessions = await getAllSessions(user.id, req.session.id);
  sendJson(res, sessions);

  createUserActivityFromReq(req, res, {
    action: 'REVOKE_SESSION',
    method: 'ALL',
    success: true,
    userId: user.id,
  });
});

const getUserLoginConfiguration = createRoute(routeDefinition.getUserLoginConfiguration.validators, async ({ teamMembership }, _, res) => {
  const defaultLoginConfiguration: LoginConfigurationUI = {
    isPasswordAllowed: true,
    isGoogleAllowed: true,
    isSalesforceAllowed: true,
    requireMfa: false,
    allowIdentityLinking: true,
    allowedMfaMethods: {
      email: true,
      otp: true,
    },
  };

  if (!teamMembership?.teamId) {
    sendJson(res, defaultLoginConfiguration);
    return;
  }

  const loginConfiguration = await getLoginConfiguration({ teamId: teamMembership.teamId }).then((response): LoginConfigurationUI => {
    if (!response) {
      return defaultLoginConfiguration;
    }
    return {
      isPasswordAllowed: response.allowedProviders.has('credentials'),
      isGoogleAllowed: response.allowedProviders.has('google'),
      isSalesforceAllowed: response.allowedProviders.has('salesforce'),
      requireMfa: response.requireMfa,
      allowIdentityLinking: response.allowIdentityLinking,
      allowedMfaMethods: {
        email: response.allowedMfaMethods.has('2fa-email'),
        otp: response.allowedMfaMethods.has('2fa-otp'),
      },
    };
  });
  sendJson(res, loginConfiguration);
});

const getOtpQrCode = createRoute(routeDefinition.getOtpQrCode.validators, async ({ user }, _, res) => {
  const { secret, imageUri, uri } = await generate2faTotpUrl(user.id);
  sendJson(res, { secret, secretToken: new URL(uri).searchParams.get('secret'), imageUri, uri });
});

const saveOtpAuthFactor = createRoute(routeDefinition.saveOtpAuthFactor.validators, async ({ body, user }, req, res) => {
  try {
    const { code, secretToken } = body;
    const secret = await convertBase32ToHex(secretToken);
    await verify2faTotpOrThrow(secret, code);
    const authFactors = await createOrUpdateOtpAuthFactor(user.id, secret);
    sendJson(res, authFactors);

    await sendAuthenticationChangeConfirmation(user.email, 'A new 2FA method has been added to your account', {
      heading: 'Authenticator app added',
    });

    createUserActivityFromReq(req, res, {
      action: '2FA_SETUP',
      method: '2FA-OTP',
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: '2FA_SETUP',
      method: '2FA-OTP',
      success: false,
    });
    if (ex instanceof InvalidVerificationToken) {
      throw new UserFacingError('Your verification code is invalid or has expired. Please try again.');
    }
    throw new UserFacingError('There was an error setting up the 2FA method');
  }
});

const toggleEnableDisableAuthFactorRoute = createRoute(
  routeDefinition.toggleEnableDisableAuthFactor.validators,
  async ({ params, user }, req, res) => {
    const { type, action } = params;
    try {
      const authFactors = await toggleEnableDisableAuthFactor(user, type, action);
      sendJson(res, authFactors);

      const emailAction = action === 'enable' ? 'enabled' : 'disabled';
      if (type === '2fa-email') {
        await sendAuthenticationChangeConfirmation(user.email, `Email 2FA has been ${emailAction}`, {
          heading: `Email 2FA has been ${emailAction}`,
        });
      } else if (type === '2fa-otp') {
        await sendAuthenticationChangeConfirmation(user.email, `Authenticator app 2FA has been ${emailAction}`, {
          heading: `Authenticator app 2FA has been ${emailAction}`,
        });
      }

      createUserActivityFromReq(req, res, {
        action: action === 'enable' ? '2FA_ACTIVATE' : '2FA_DEACTIVATE',
        method: type.toUpperCase(),
        success: true,
      });
    } catch (ex) {
      createUserActivityFromReqWithError(req, res, ex, {
        action: action === 'enable' ? '2FA_ACTIVATE' : '2FA_DEACTIVATE',
        method: type.toUpperCase(),
        success: false,
      });
      if (ex instanceof AuthError) {
        throw ex;
      }
      throw new UserFacingError(`There was an error ${action === 'enable' ? 'enabling' : 'disabling'} the authentication factor`);
    }
  },
);

const deleteAuthFactorRoute = createRoute(routeDefinition.deleteAuthFactor.validators, async ({ params, user }, req, res) => {
  const { type } = params;
  try {
    const authFactors = await deleteAuthFactor(user, type);
    sendJson(res, authFactors);

    await sendAuthenticationChangeConfirmation(user.email, 'Two-factor authentication method removed', {
      heading: 'An authentication method has been removed',
    });

    createUserActivityFromReq(req, res, {
      action: '2FA_REMOVAL',
      method: type.toUpperCase(),
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: '2FA_REMOVAL',
      method: type?.toUpperCase(),
      success: false,
    });
    if (ex instanceof AuthError) {
      throw ex;
    }
    throw new UserFacingError('There was an error removing the authentication factor');
  }
});

const unlinkIdentity = createRoute(routeDefinition.unlinkIdentity.validators, async ({ query, user }, req, res) => {
  try {
    const { provider, providerAccountId } = query;

    // Atomically remove the identity and revoke sessions/tokens authenticated via it so an
    // attacker with a stolen OAuth session loses access when the legitimate user unlinks.
    // The current session is preserved so the user stays signed in on the device unlinking.
    await removeIdentityFromUser(user.id, provider, providerAccountId, req.session.id);
    const updatedUser = await userDbService.findUserWithIdentitiesById(user.id);

    sendJson(res, updatedUser);

    await sendAuthenticationChangeConfirmation(user.email, 'An linked identity has been removed from your account', {
      heading: 'An linked identity has been removed from your account',
      additionalTextSegments: [`The ${provider} identity has been removed from your account.`, 'You can link a new identity at any time.'],
    });

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

const deleteAccount = createRoute(routeDefinition.deleteAccount.validators, async ({ body, user, requestId }, req, res) => {
  try {
    const reason = body.reason;
    let billingResultsJson = '';
    let billingPortalLinkText = '';

    if (req.session.user?.teamMembership) {
      throw new UserFacingError('You cannot delete your account while you are a member of a team. Contact support for assistance.');
    }

    const userWithSubscriptions = await userDbService.findByIdWithSubscriptions(user.id);
    if (userWithSubscriptions.billingAccount?.customerId) {
      const results = await stripeService.cancelAllSubscriptions({ customerId: userWithSubscriptions.billingAccount.customerId });
      billingResultsJson = JSON.stringify(results);
      billingPortalLinkText = `If you need to access any of your billing information or history, you can continue to do so here: ${ENV.STRIPE_BILLING_PORTAL_LINK}`;
      logger.info({ requestId, results }, '[ACCOUNT DELETE][CANCEL SUBSCRIPTIONS]');
    }

    await userDbService.deleteUserAndAllRelatedData(user.id);
    // Destroy session - don't wait for response
    req.session.destroy((error) => {
      if (error) {
        req.log.error({ requestId, err: error }, '[ACCOUNT DELETE][ERROR DESTROYING SESSION]');
      }
    });

    try {
      await sendGoodbyeEmail(user.email, billingPortalLinkText);
      await sendInternalAccountDeletionEmail(user.id, reason, billingResultsJson);
    } catch (ex) {
      req.log.error('[ACCOUNT DELETE][ERROR SENDING EMAIL SUMMARY] %s', getErrorMessage(ex));
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
        req.log.error({ err: ex }, '[ACCOUNT DELETE][FATAL ERROR] %o', error.response.data);
      } else if (error.request) {
        req.log.error({ err: ex }, '[ACCOUNT DELETE][FATAL ERROR] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new UserFacingError('There was a problem deleting your account, contact support@getjetstream.app for assistance.');
  }
});

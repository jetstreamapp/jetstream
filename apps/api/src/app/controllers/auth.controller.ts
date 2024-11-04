import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import {
  AuthError,
  clearOauthCookies,
  createRememberDevice,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  ensureAuthError,
  ExpiredVerificationToken,
  generatePasswordResetToken,
  generateRandomCode,
  generateRandomString,
  getAuthorizationUrl,
  getCookieConfig,
  getTotpAuthenticationFactor,
  handleSignInOrRegistration,
  hasRememberDeviceRecord,
  InvalidAction,
  InvalidParameters,
  InvalidProvider,
  InvalidSession,
  InvalidVerificationToken,
  InvalidVerificationType,
  linkIdentityToUser,
  getProviders as listProviders,
  resetUserPassword,
  setUserEmailVerified,
  validateCallback,
  verify2faTotpOrThrow,
  verifyCSRFFromRequestOrThrow,
} from '@jetstream/auth/server';
import { OauthProviderType, OauthProviderTypeSchema, Provider, ProviderKeysSchema, UserProfileSession } from '@jetstream/auth/types';
import {
  sendAuthenticationChangeConfirmation,
  sendEmailVerification,
  sendPasswordReset,
  sendVerificationCode,
  sendWelcomeEmail,
} from '@jetstream/email';
import { ensureBoolean } from '@jetstream/shared/utils';
import { parse as parseCookie } from 'cookie';
import { addMinutes } from 'date-fns';
import { z } from 'zod';
import { Request } from '../types/types';
import { redirect, sendJson, setCsrfCookie } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  logout: {
    controllerFn: () => logout,
    validators: {
      hasSourceOrg: false,
    },
  },
  getProviders: {
    controllerFn: () => getProviders,
    validators: {
      hasSourceOrg: false,
    },
  },
  getCsrfToken: {
    controllerFn: () => getCsrfToken,
    validators: {
      query: z.record(z.any()),
      hasSourceOrg: false,
    },
  },
  getSession: {
    controllerFn: () => getSession,
    validators: {
      hasSourceOrg: false,
    },
  },
  signin: {
    controllerFn: () => signin,
    validators: {
      params: z.object({ provider: OauthProviderTypeSchema }),
      query: z.object({ returnUrl: z.string().nullish(), isAccountLink: z.literal('true').nullish() }),
      body: z.object({ csrfToken: z.string(), callbackUrl: z.string().url() }),
      hasSourceOrg: false,
    },
  },
  callback: {
    controllerFn: () => callback,
    validators: {
      query: z.record(z.any()),
      params: z.object({ provider: ProviderKeysSchema }),
      body: z.union([
        z.discriminatedUnion('action', [
          z.object({
            action: z.literal('login'),
            csrfToken: z.string(),
            captchaToken: z.string().nullish(),
            email: z.string().email().min(5).max(255),
            password: z.string().min(8).max(255),
          }),
          z.object({
            action: z.literal('register'),
            csrfToken: z.string(),
            captchaToken: z.string().nullish(),
            email: z.string().email().min(5).max(255),
            name: z.string().min(1).max(255).trim(),
            password: z.string().min(8).max(255),
          }),
        ]),
        z.object({}).nullish(),
      ]),
      hasSourceOrg: false,
    },
  },
  verification: {
    controllerFn: () => verification,
    validators: {
      body: z.object({
        csrfToken: z.string(),
        captchaToken: z.string().nullish(),
        rememberDevice: z
          .union([z.enum(['true', 'false']), z.boolean()])
          .nullish()
          .transform(ensureBoolean),
        code: z.string(),
        type: z.enum(['email', '2fa-otp', '2fa-email']),
      }),
      hasSourceOrg: false,
    },
  },
  verifyEmailViaLink: {
    controllerFn: () => verifyEmailViaLink,
    validators: {
      query: z.object({
        type: z.literal('email'),
        code: z.string(),
      }),
      hasSourceOrg: false,
    },
  },
  resendVerification: {
    controllerFn: () => resendVerification,
    validators: {
      body: z.object({ captchaToken: z.string().nullish(), csrfToken: z.string(), type: z.enum(['email', '2fa-email']) }),
      hasSourceOrg: false,
    },
  },
  requestPasswordReset: {
    controllerFn: () => requestPasswordReset,
    validators: {
      body: z.object({ captchaToken: z.string().nullish(), email: z.string(), csrfToken: z.string() }),
      hasSourceOrg: false,
    },
  },
  validatePasswordReset: {
    controllerFn: () => validatePasswordReset,
    validators: {
      body: z.object({
        email: z.string().email(),
        token: z.string(),
        password: z.string(),
        csrfToken: z.string(),
        captchaToken: z.string().nullish(),
      }),
      hasSourceOrg: false,
    },
  },
};

function initSession(
  req: Request<unknown, unknown, unknown>,
  { user, isNewUser, verificationRequired, provider }: Awaited<ReturnType<typeof handleSignInOrRegistration>>
) {
  const userAgent = req.get('User-Agent');
  if (userAgent) {
    req.session.userAgent = req.get('User-Agent');
  }
  req.session.ipAddress = req.ip;
  req.session.loginTime = new Date().getTime();
  req.session.provider = provider;
  req.session.user = user as UserProfileSession;
  req.session.pendingVerification = null;

  if (verificationRequired) {
    const exp = addMinutes(new Date(), 10).getTime();
    const token = generateRandomCode(6);
    if (isNewUser) {
      req.session.sendNewUserEmailAfterVerify = true;
    }
    if (verificationRequired.email) {
      // If email verification is required, we can consider that as 2fa as well, so do not need to combine with other 2fa factors
      req.session.pendingVerification = [{ type: 'email', exp, token }];
    } else if (verificationRequired.twoFactor?.length > 0) {
      req.session.pendingVerification = verificationRequired.twoFactor.map((factor) => {
        switch (factor.type) {
          case '2fa-otp':
            return { type: '2fa-otp', exp };
          case '2fa-email':
            return { type: '2fa-email', exp, token };
          default:
            throw new InvalidVerificationType('Invalid two factor type');
        }
      });
    }
  }
}

const logout = createRoute(routeDefinition.logout.validators, async ({}, req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ ...getExceptionLog(err) }, '[AUTH][LOGOUT][ERROR] Error destroying session');
    }
    redirect(res, ENV.JETSTREAM_SERVER_URL);
  });
});

const getProviders = createRoute(routeDefinition.getProviders.validators, async ({}, req, res, next) => {
  try {
    const providers = listProviders();

    sendJson(res, providers);
  } catch (ex) {
    next(ensureAuthError(ex));
  }
});

const getCsrfToken = createRoute(routeDefinition.getCsrfToken.validators, async (_, req, res, next) => {
  try {
    const csrfToken = await setCsrfCookie(res);
    sendJson(res, { csrfToken });
  } catch (ex) {
    next(ensureAuthError(ex));
  }
});

const getSession = createRoute(routeDefinition.getSession.validators, async (_, req, res, next) => {
  try {
    let isVerificationExpired = false;

    if (req.session.pendingVerification?.some(({ exp }) => exp && exp <= new Date().getTime())) {
      isVerificationExpired = true;
    }

    sendJson(res, {
      isLoggedIn: !!req.session.user && !req.session.pendingVerification?.length,
      email:
        req.session.user?.email && req.session.pendingVerification?.some(({ type }) => type === 'email' || type === '2fa-email')
          ? req.session.user.email
          : null,
      pendingVerifications: req.session.pendingVerification?.map(({ type }) => type) || false,
      isVerificationExpired,
    });
  } catch (ex) {
    next(ensureAuthError(ex));
  }
});

/**
 * For OAuth:
 * * Get Authorization URL, set cookies, and redirect
 * For Magic Link:
 * * Potentially supported in the future
 * For Credentials
 * * Not Used
 */
const signin = createRoute(routeDefinition.signin.validators, async ({ body, params, query, setCookie }, req, res, next) => {
  let provider: Provider | null = null;
  try {
    const { isAccountLink, returnUrl } = query;
    const { csrfToken } = body;

    const providers = listProviders();

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');
    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

    provider = providers[params.provider];
    if (provider.type === 'oauth') {
      clearOauthCookies(res);

      if (isAccountLink) {
        if (!req.session.user) {
          throw new InvalidSession();
        }
        setCookie(cookieConfig.linkIdentity.name, 'true', cookieConfig.linkIdentity.options);
      }

      const { authorizationUrl, code_verifier, nonce } = await getAuthorizationUrl(provider.provider as OauthProviderType);
      if (code_verifier) {
        setCookie(cookieConfig.pkceCodeVerifier.name, code_verifier, cookieConfig.pkceCodeVerifier.options);
      }
      if (nonce) {
        setCookie(cookieConfig.nonce.name, nonce, cookieConfig.nonce.options);
      }
      if (returnUrl) {
        setCookie(cookieConfig.returnUrl.name, returnUrl, cookieConfig.returnUrl.options);
      }

      createUserActivityFromReq(req, res, {
        action: isAccountLink ? 'LINK_IDENTITY_INIT' : 'OAUTH_INIT',
        method: provider.provider.toUpperCase(),
        success: true,
      });
      redirect(res, authorizationUrl.toString());
      return;
    }

    throw new InvalidAction();
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: query?.isAccountLink ? 'LINK_IDENTITY_INIT' : 'OAUTH_INIT',
      method: provider?.provider?.toUpperCase(),
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

/**
 * FIXME: This should probably be broken up and logic moved to the auth service
 */
const callback = createRoute(routeDefinition.callback.validators, async ({ body, params, query, clearCookie }, req, res, next) => {
  let provider: Provider | null = null;
  try {
    const providers = listProviders();

    provider = providers[params.provider];
    if (!provider) {
      throw new InvalidParameters();
    }

    let isNewUser = false;
    const {
      pkceCodeVerifier,
      nonce,
      linkIdentity: linkIdentityCookie,
      returnUrl,
      rememberDevice,
    } = getCookieConfig(ENV.USE_SECURE_COOKIES);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cookies = parseCookie(req.headers.cookie!);
    clearOauthCookies(res);

    if (provider.type === 'oauth') {
      // oauth flow
      const { userInfo } = await validateCallback(
        provider.provider as OauthProviderType,
        new URLSearchParams(query),
        cookies[pkceCodeVerifier.name],
        cookies[nonce.name]
      );

      if (!userInfo.email) {
        throw new InvalidParameters();
      }

      const providerUser = {
        id: userInfo.sub,
        email: userInfo.email,
        emailVerified: userInfo.email_verified ?? false,
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
        username: userInfo.preferred_username || (userInfo.username as string | undefined) || userInfo.email,
        name:
          userInfo.name ??
          (userInfo.given_name && userInfo.family_name ? `${userInfo.given_name} ${userInfo.family_name}` : userInfo.email),
        picture: (userInfo.picture_thumbnail as string | undefined) || userInfo.picture,
      };

      // If user has an active session and user is linking an identity to an existing account
      // link and redirect to profile page
      if (req.session.user && cookies[linkIdentityCookie.name] === 'true') {
        await linkIdentityToUser({
          userId: req.session.user.id,
          provider: provider.provider,
          providerUser,
        });
        createUserActivityFromReq(req, res, {
          action: 'LINK_IDENTITY',
          method: provider.provider.toUpperCase(),
          success: true,
        });
        redirect(res, cookies[returnUrl.name] || `${ENV.JETSTREAM_CLIENT_URL}/profile`);
        return;
      }

      const sessionData = await handleSignInOrRegistration({
        providerType: provider.type,
        provider: provider.provider,
        providerUser,
      });
      isNewUser = sessionData.isNewUser;

      initSession(req, sessionData);
    } else if (provider.type === 'credentials' && req.method === 'POST') {
      if (!body || !('action' in body)) {
        throw new InvalidAction();
      }
      const { action, csrfToken, email, password } = body;
      await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

      const sessionData =
        action === 'login'
          ? await handleSignInOrRegistration({
              providerType: 'credentials',
              action,
              email,
              password,
            })
          : await handleSignInOrRegistration({
              providerType: 'credentials',
              action,
              email,
              name: body.name,
              password,
            });

      isNewUser = sessionData.isNewUser;

      initSession(req, sessionData);
    } else {
      throw new InvalidProvider();
    }

    if (!req.session.user) {
      throw new AuthError();
    }

    // check for remembered device - emailVerification cannot be bypassed
    if (
      cookies[rememberDevice.name] &&
      Array.isArray(req.session.pendingVerification) &&
      req.session.pendingVerification.length > 0 &&
      req.session.pendingVerification.find((item) => item.type !== 'email')
    ) {
      const deviceId = cookies[rememberDevice.name];
      const isDeviceRemembered = await hasRememberDeviceRecord({
        userId: req.session.user.id,
        deviceId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      if (isDeviceRemembered) {
        req.session.pendingVerification = null;
      } else {
        // deviceId is not valid, remove cookie
        clearCookie(rememberDevice.name, rememberDevice.options);
      }
    }

    if (Array.isArray(req.session.pendingVerification) && req.session.pendingVerification.length > 0) {
      const initialVerification = req.session.pendingVerification[0];

      if (initialVerification.type === 'email') {
        await sendEmailVerification(req.session.user.email, initialVerification.token);
      } else if (initialVerification.type === '2fa-email') {
        await sendVerificationCode(req.session.user.email, initialVerification.token);
      }

      await setCsrfCookie(res);

      if (provider.type === 'oauth') {
        redirect(res, `/auth/verify`);
      } else {
        sendJson(res, { error: false, redirect: `/auth/verify` });
      }
    } else {
      if (isNewUser) {
        await sendWelcomeEmail(req.session.user.email);
      }
      // No verification required
      if (provider.type === 'oauth') {
        redirect(res, ENV.JETSTREAM_CLIENT_URL);
      } else {
        // this was an API call, client will handle redirect
        sendJson(res, {
          error: false,
          redirect: ENV.JETSTREAM_CLIENT_URL,
        });
      }
    }

    createUserActivityFromReq(req, res, {
      action: 'LOGIN',
      method: provider.provider.toUpperCase(),
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'LOGIN',
      email: body && 'email' in body ? body.email : undefined,
      method: provider?.provider?.toUpperCase(),
      success: false,
    });
    next(ensureAuthError(ex));
  }
});

const verification = createRoute(routeDefinition.verification.validators, async ({ body, user, setCookie }, req, res, next) => {
  try {
    if (!req.session.user || !req.session.pendingVerification) {
      throw new InvalidSession();
    }

    const { csrfToken, code, type, rememberDevice } = body;
    const pendingVerification = req.session.pendingVerification.find((item) => item.type === type);
    let rememberDeviceId: string | undefined;

    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

    if (!pendingVerification) {
      throw new InvalidSession();
    }

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    if (pendingVerification.exp <= new Date().getTime()) {
      throw new ExpiredVerificationToken();
    }

    switch (pendingVerification.type) {
      case 'email': {
        const { token } = pendingVerification;
        if (token !== code) {
          throw new InvalidVerificationToken();
        }
        req.session.user = (await setUserEmailVerified(req.session.user.id)) as UserProfileSession;
        break;
      }
      case '2fa-email': {
        const { token } = pendingVerification;
        if (token !== code) {
          throw new InvalidVerificationToken();
        }
        rememberDeviceId = rememberDevice ? generateRandomString(32) : undefined;
        break;
      }
      case '2fa-otp': {
        const { secret } = await getTotpAuthenticationFactor(req.session.user.id);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await verify2faTotpOrThrow(secret!, code);
        rememberDeviceId = rememberDevice ? generateRandomString(32) : undefined;
        break;
      }
      default: {
        throw new InvalidVerificationToken();
      }
    }

    if (rememberDeviceId) {
      await createRememberDevice({
        userId: user.id,
        deviceId: rememberDeviceId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      setCookie(cookieConfig.rememberDevice.name, rememberDeviceId, cookieConfig.rememberDevice.options);
    }

    req.session.pendingVerification = null;

    if (req.session.sendNewUserEmailAfterVerify && req.session.user) {
      req.session.sendNewUserEmailAfterVerify = undefined;
      await sendWelcomeEmail(req.session.user.email);
    }

    createUserActivityFromReq(req, res, {
      action: '2FA_VERIFICATION',
      method: type.toUpperCase(),
      success: true,
    });

    sendJson(res, {
      error: false,
      redirect: ENV.JETSTREAM_CLIENT_URL,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: '2FA_VERIFICATION',
      method: body?.type?.toUpperCase(),
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

const resendVerification = createRoute(routeDefinition.resendVerification.validators, async ({ body }, req, res, next) => {
  try {
    if (!req.session.user || !req.session.pendingVerification) {
      throw new InvalidSession();
    }

    const { csrfToken, type } = body;
    const pendingVerification = req.session.pendingVerification.find((item) => item.type === type);

    if (!pendingVerification) {
      throw new InvalidSession();
    }

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');
    const exp = addMinutes(new Date(), 10).getTime();
    const token = generateRandomCode(6);

    // Refresh all pending verifications
    req.session.pendingVerification = req.session.pendingVerification.map((item) => {
      switch (item.type) {
        case 'email': {
          return { ...item, exp, token };
        }
        case '2fa-email': {
          return { ...item, exp, token };
        }
        case '2fa-otp': {
          return { ...item, exp };
        }
        default: {
          return item;
        }
      }
    });

    switch (type) {
      case 'email': {
        await sendEmailVerification(req.session.user.email, token);
        break;
      }
      case '2fa-email': {
        await sendVerificationCode(req.session.user.email, token);
        break;
      }
      default: {
        break;
      }
    }

    createUserActivityFromReq(req, res, {
      action: '2FA_RESEND_VERIFICATION',
      method: type.toUpperCase(),
      success: true,
    });

    sendJson(res, { error: false });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: '2FA_RESEND_VERIFICATION',
      method: body?.type?.toUpperCase(),
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

const requestPasswordReset = createRoute(routeDefinition.requestPasswordReset.validators, async ({ body }, req, res, next) => {
  try {
    const { csrfToken, email } = body;
    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    try {
      const { token } = await generatePasswordResetToken(email);
      await sendPasswordReset(email, token);

      sendJson(res, { error: false });
    } catch (ex) {
      res.log.warn('[AUTH][PASSWORD_RESET] Attempt to reset a password for an email that does not exist %o', { email });
      sendJson(res, { error: false });
    }

    createUserActivityFromReq(req, res, {
      action: 'PASSWORD_RESET_REQUEST',
      method: 'UNAUTHENTICATED',
      email,
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'PASSWORD_RESET_REQUEST',
      method: 'UNAUTHENTICATED',
      email: body?.email,
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

const validatePasswordReset = createRoute(routeDefinition.validatePasswordReset.validators, async ({ body }, req, res, next) => {
  try {
    const { csrfToken, email, password, token } = body;
    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    await resetUserPassword(email, token, password);

    await sendAuthenticationChangeConfirmation(email, 'Password change confirmation', {
      preview: 'Your password has been successfully changed.',
      heading: 'Password changed',
    });

    createUserActivityFromReq(req, res, {
      action: 'PASSWORD_RESET_COMPLETION',
      method: 'UNAUTHENTICATED',
      email,
      success: true,
    });

    sendJson(res, { error: false });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'PASSWORD_RESET_COMPLETION',
      method: 'UNAUTHENTICATED',
      email: body?.email,
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

const verifyEmailViaLink = createRoute(routeDefinition.verification.validators, async ({ query }, req, res, next) => {
  try {
    if (!req.session.user) {
      throw new InvalidSession();
    }

    if (!req.session.pendingVerification?.length) {
      sendJson(res, {
        error: false,
        redirect: ENV.JETSTREAM_CLIENT_URL,
      });
      return;
    }

    const { code } = query;

    const pendingVerification = req.session.pendingVerification.find(({ type }) => {
      type === 'email';
    });

    if (!pendingVerification) {
      throw new InvalidSession();
    }

    if (pendingVerification.exp <= new Date().getTime()) {
      throw new ExpiredVerificationToken();
    }

    switch (pendingVerification.type) {
      case 'email': {
        const { token } = pendingVerification;
        if (token !== code) {
          throw new InvalidVerificationToken();
        }
        req.session.user = (await setUserEmailVerified(req.session.user.id)) as UserProfileSession;
        break;
      }
      default: {
        throw new InvalidVerificationToken();
      }
    }

    createUserActivityFromReq(req, res, {
      action: 'EMAIL_VERIFICATION',
      success: true,
    });

    req.session.pendingVerification = null;
    redirect(res, ENV.JETSTREAM_CLIENT_URL);
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'EMAIL_VERIFICATION',
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

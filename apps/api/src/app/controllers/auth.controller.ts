import { ENV, getExceptionLog } from '@jetstream/api-config';
import {
  AuthError,
  clearOauthCookies,
  convertBase32ToHex,
  createOrUpdateOtpAuthFactor,
  createRememberDevice,
  createUserActivityFromReq,
  createUserActivityFromReqWithError,
  discoverSsoConfigByDomain,
  EMAIL_VERIFICATION_TOKEN_DURATION_HOURS,
  ensureAuthError,
  ExpiredVerificationToken,
  generate2faTotpUrl,
  generatePasswordResetToken,
  generateRandomCode,
  generateRandomString,
  getApiAddressFromReq,
  getAuthorizationUrl,
  getCookieConfig,
  getLoginConfiguration,
  getTeamLoginConfigWithSso,
  getTotpAuthenticationFactor,
  handleSignInOrRegistration,
  handleSsoLogin,
  hasRememberDeviceRecord,
  IdentityLinkingNotAllowed,
  initSession,
  InvalidAction,
  InvalidParameters,
  InvalidProvider,
  InvalidSession,
  InvalidVerificationToken,
  linkIdentityToUser,
  getProviders as listProviders,
  oidcService,
  PASSWORD_RESET_DURATION_MINUTES,
  PLACEHOLDER_USER_ID,
  ProviderEmailNotVerified,
  ProviderNotAllowed,
  resetUserPassword,
  samlService,
  setUserEmailVerified,
  timingSafeStringCompare,
  TOKEN_DURATION_MINUTES,
  validateCallback,
  validateRedirectUrl,
  verify2faTotpOrThrow,
  verifyCSRFFromRequestOrThrow,
} from '@jetstream/auth/server';
import {
  OauthProviderType,
  OauthProviderTypeSchema,
  Provider,
  ProviderKeysSchema,
  ProvidersSchema,
  UserProfileSession,
} from '@jetstream/auth/types';
import {
  sendAuthenticationChangeConfirmation,
  sendEmailVerification,
  sendPasswordReset,
  sendVerificationCode,
  sendWelcomeEmail,
} from '@jetstream/email';
import { ensureBoolean, getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, PasswordSchema } from '@jetstream/types';
import { parseCookie } from 'cookie';
import { addMinutes } from 'date-fns/addMinutes';
import { z } from 'zod';
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
    responseType: ProvidersSchema,
    validators: {
      hasSourceOrg: false,
    },
  },
  getCsrfToken: {
    controllerFn: () => getCsrfToken,
    responseType: z.object({ csrfToken: z.string() }),
    validators: {
      hasSourceOrg: false,
    },
  },
  getSession: {
    controllerFn: () => getSession,
    responseType: z.object({
      isLoggedIn: z.boolean(),
      email: z.email().nullable(),
      pendingVerifications: z
        .array(z.enum(['email', '2fa-otp', '2fa-email']))
        .nullable()
        .or(z.literal(false)),
      isVerificationExpired: z.boolean(),
    }),
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
    responseType: z.object({ error: z.boolean(), redirect: z.string() }).nullable(),
    validators: {
      query: z.looseObject({ returnUrl: z.string().optional() }),
      params: z.object({ provider: ProviderKeysSchema }),
      body: z.union([
        z.discriminatedUnion('action', [
          z.object({
            action: z.literal('login'),
            csrfToken: z.string(),
            captchaToken: z.string().nullish(),
            email: z.email().max(255).toLowerCase(),
            password: z.string().min(8).max(255), // Keep lenient for login (existing users)
          }),
          z.object({
            action: z.literal('register'),
            csrfToken: z.string(),
            captchaToken: z.string().nullish(),
            email: z.email().max(255).toLowerCase(),
            name: z.string().min(1).max(255).trim(),
            password: PasswordSchema,
          }),
        ]),
        z.object({}).nullish(),
      ]),
      hasSourceOrg: false,
    },
  },
  verification: {
    controllerFn: () => verification,
    responseType: z.object({ error: z.boolean(), redirect: z.string() }).nullable(),
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
    responseType: z.object({ error: z.boolean() }).nullable(),
    validators: {
      body: z.object({ captchaToken: z.string().nullish(), csrfToken: z.string(), type: z.enum(['email', '2fa-email']) }),
      hasSourceOrg: false,
    },
  },
  requestPasswordReset: {
    controllerFn: () => requestPasswordReset,
    responseType: z.object({ error: z.boolean() }).nullable(),
    validators: {
      body: z.object({ captchaToken: z.string().nullish(), email: z.string().toLowerCase(), csrfToken: z.string() }),
      hasSourceOrg: false,
    },
  },
  validatePasswordReset: {
    controllerFn: () => validatePasswordReset,
    responseType: z.object({ error: z.boolean() }).nullable(),
    validators: {
      body: z.object({
        email: z.email().toLowerCase(),
        token: z.string(),
        password: PasswordSchema,
        csrfToken: z.string(),
        captchaToken: z.string().nullish(),
      }),
      hasSourceOrg: false,
    },
  },
  getOtpEnrollmentData: {
    controllerFn: () => getOtpEnrollmentData,
    responseType: z.object({ secret: z.string(), secretToken: z.string(), imageUri: z.string(), uri: z.string() }),
    validators: {
      hasSourceOrg: false,
    },
  },
  enrollOtpFactor: {
    controllerFn: () => enrollOtpFactor,
    responseType: z.object({ error: z.boolean(), redirectUrl: z.string() }).nullable(),
    validators: {
      body: z.object({
        code: z.string().min(6).max(6),
        secretToken: z.string().min(32).max(32),
        csrfToken: z.string(),
      }),
      hasSourceOrg: false,
    },
  },
  // SSO Routes
  discoverSso: {
    controllerFn: () => discoverSso,
    validators: {
      body: z.object({ csrfToken: z.string(), email: z.email().toLowerCase() }),
      hasSourceOrg: false,
    },
  },
  startSso: {
    controllerFn: () => startSso,
    validators: {
      body: z.object({ csrfToken: z.string(), email: z.email().toLowerCase() }),
      query: z.object({ returnUrl: z.string().optional() }),
      hasSourceOrg: false,
    },
  },
  handleSamlCallback: {
    controllerFn: () => handleSamlCallback,
    validators: {
      params: z.object({ teamId: z.uuid() }),
      body: z.object({ SAMLResponse: z.string() }),
      hasSourceOrg: false,
    },
  },
  getSamlMetadata: {
    controllerFn: () => getSamlMetadata,
    validators: {
      params: z.object({ teamId: z.uuid() }),
      hasSourceOrg: false,
    },
  },
  handleOidcCallback: {
    controllerFn: () => handleOidcCallback,
    validators: {
      params: z.object({ teamId: z.uuid() }),
      query: z.object({}).loose(),
      hasSourceOrg: false,
    },
  },
};

const logout = createRoute(routeDefinition.logout.validators, async ({}, req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.log.error({ ...getExceptionLog(err) }, '[AUTH][LOGOUT][ERROR] Error destroying session');
    }
    redirect(res, ENV.JETSTREAM_SERVER_URL);
  });
});

const getProviders = createRoute(routeDefinition.getProviders.validators, async ({}, _, res, next) => {
  try {
    const providers = listProviders();

    sendJson(res, providers);
  } catch (ex) {
    next(ensureAuthError(ex));
  }
});

const getCsrfToken = createRoute(routeDefinition.getCsrfToken.validators, async (_, __, res, next) => {
  try {
    const csrfToken = setCsrfCookie(res);
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
          throw new InvalidSession('Cannot link account without an active session');
        }

        const loginConfiguration = req.session.user?.teamMembership
          ? await getLoginConfiguration({ teamId: req.session.user.teamMembership.teamId })
          : null;
        if (loginConfiguration && !loginConfiguration.allowIdentityLinking) {
          throw new IdentityLinkingNotAllowed();
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

    throw new InvalidAction(`Can only sign in with OAuth providers. isAccountLink=${isAccountLink}, provider:${JSON.stringify(provider)}`);
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
const callback = createRoute(
  routeDefinition.callback.validators,
  async ({ body, params, query, setCookie, clearCookie }, req, res, next) => {
    let provider: Provider | null = null;
    try {
      const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
      const { returnUrl: returnUrlQuery } = query;

      if (returnUrlQuery) {
        setCookie(cookieConfig.returnUrl.name, returnUrlQuery, cookieConfig.returnUrl.options);
      }

      const providers = listProviders();

      provider = providers[params.provider];
      if (!provider) {
        throw new InvalidParameters('Missing provider');
      }

      let isNewUser = false;
      const {
        pkceCodeVerifier,
        nonce,
        linkIdentity: linkIdentityCookie,
        returnUrl: returnUrlCookie,
        rememberDevice,
        redirectUrl: redirectUrlCookie,
        teamInviteState,
      } = getCookieConfig(ENV.USE_SECURE_COOKIES);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cookies = parseCookie(req.headers.cookie!);
      clearOauthCookies(res);

      const returnUrl = returnUrlQuery || cookies[returnUrlCookie.name] || null;

      let teamInvite: Maybe<{ token: string; teamId: string }>;
      if (cookies[teamInviteState.name]) {
        const teamInviteParams = new URLSearchParams(cookies[teamInviteState.name]);
        const token = teamInviteParams.get('token');
        const teamId = teamInviteParams.get('teamId');
        if (token && teamId) {
          teamInvite = { token, teamId };
        }
      }

      if (provider.type === 'oauth') {
        // oauth flow
        // Validate required cookies exist before calling OAuth library
        const pkce = cookies[pkceCodeVerifier.name];
        if (!pkce) {
          throw new InvalidSession('Missing PKCE code verifier - invalid OAuth flow. Please start the login process again.');
        }

        // Validate OAuth callback has required parameters
        const queryParams = new URLSearchParams(query as Record<string, string>);
        if (!queryParams.has('code') && !queryParams.has('error')) {
          throw new InvalidParameters('Missing OAuth callback parameters. Please start the login process again.');
        }

        const { userInfo } = await validateCallback(provider.provider as OauthProviderType, queryParams, pkce, cookies[nonce.name]);

        if (!userInfo.email) {
          throw new InvalidParameters('Missing email from OAuth provider');
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

        /**
         * IDENTITY LINKING
         * If user has an active session and user is linking an identity to an existing account
         * link and redirect to profile page
         */
        if (req.session.user && cookies[linkIdentityCookie.name] === 'true') {
          const loginConfiguration = req.session.user?.teamMembership
            ? await getLoginConfiguration({ teamId: req.session.user.teamMembership.teamId })
            : null;

          const providerAllowed = !loginConfiguration || loginConfiguration.allowedProviders.has(provider.provider);

          if (!providerAllowed) {
            throw new ProviderNotAllowed(`Provider ${provider.provider} is not allowed for user ${userInfo.email}`);
          }

          if (loginConfiguration && !loginConfiguration?.allowIdentityLinking) {
            throw new IdentityLinkingNotAllowed();
          }

          if (!providerUser.emailVerified) {
            throw new ProviderEmailNotVerified();
          }

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
          const validatedReturnUrl = validateRedirectUrl(
            returnUrl,
            [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
            `${ENV.JETSTREAM_CLIENT_URL}/profile`,
          );
          redirect(res, validatedReturnUrl);
          return;
        }

        const sessionData = await handleSignInOrRegistration({
          teamInvite,
          providerType: provider.type,
          provider: provider.provider,
          providerUser,
        });
        isNewUser = sessionData.isNewUser;

        await initSession(req, sessionData);
      } else if (provider.type === 'credentials' && req.method === 'POST') {
        if (!body || !('action' in body)) {
          throw new InvalidAction('Missing action in body');
        }
        const { action, csrfToken, email, password } = body;
        await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

        const sessionData =
          action === 'login'
            ? await handleSignInOrRegistration({
                teamInvite,
                providerType: 'credentials',
                action,
                email,
                password,
              })
            : await handleSignInOrRegistration({
                teamInvite,
                providerType: 'credentials',
                action,
                email,
                name: body.name,
                password,
              });

        isNewUser = sessionData.isNewUser;

        await initSession(req, sessionData);
      } else {
        throw new InvalidProvider(`Provider type ${provider.type} is not supported. Method=${req.method}`);
      }

      if (!req.session.user) {
        throw new AuthError('Session not initialized');
      }

      // Clear team invite cookies if user was added to team
      if (teamInviteState && req.session.user?.teamMembership) {
        clearCookie(teamInviteState.name, teamInviteState.options);
        clearCookie(redirectUrlCookie.name, redirectUrlCookie.options);
      }

      // check for remembered device - emailVerification cannot be bypassed
      const deviceId = cookies[rememberDevice.name];
      if (
        deviceId &&
        Array.isArray(req.session.pendingVerification) &&
        req.session.pendingVerification.length > 0 &&
        req.session.pendingVerification.find((item) => item.type !== 'email')
      ) {
        const isDeviceRemembered = await hasRememberDeviceRecord({
          userId: req.session.user.id,
          deviceId,
          ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
          userAgent: req.get('User-Agent'),
        });
        if (isDeviceRemembered) {
          req.session.pendingVerification = null;
          // update cookie expiration date
          setCookie(rememberDevice.name, deviceId, rememberDevice.options);
        } else {
          // deviceId is not valid, remove cookie
          clearCookie(rememberDevice.name, rememberDevice.options);
        }
      }

      if (Array.isArray(req.session.pendingVerification) && req.session.pendingVerification.length > 0) {
        const initialVerification = req.session.pendingVerification[0];

        if (initialVerification.type === 'email') {
          await sendEmailVerification(req.session.user.email, initialVerification.token, EMAIL_VERIFICATION_TOKEN_DURATION_HOURS);
        } else if (initialVerification.type === '2fa-email') {
          await sendVerificationCode(req.session.user.email, initialVerification.token, TOKEN_DURATION_MINUTES);
        }

        setCsrfCookie(res);

        if (provider.type === 'oauth') {
          redirect(res, `/auth/verify`);
        } else {
          sendJson(res, { error: false, redirect: `/auth/verify` });
        }
      } else if (req.session.pendingMfaEnrollment) {
        if (provider.type === 'oauth') {
          redirect(res, `/auth/mfa-enroll`);
        } else {
          sendJson(res, { error: false, redirect: `/auth/mfa-enroll` });
        }
      } else {
        if (isNewUser) {
          await sendWelcomeEmail(req.session.user.email);
        }

        let redirectUrl = returnUrl || ENV.JETSTREAM_CLIENT_URL;

        const redirectValue = cookies[redirectUrlCookie.name];
        if (!returnUrl && redirectValue) {
          redirectUrl = redirectValue.startsWith('/') ? `${ENV.JETSTREAM_CLIENT_URL}${redirectValue}` : redirectValue;
          redirectUrl = redirectUrl.replace('/app/app', '/app');
          clearCookie(redirectUrlCookie.name, redirectUrlCookie.options);
        } else if (cookies[redirectUrlCookie.name]) {
          clearCookie(redirectUrlCookie.name, redirectUrlCookie.options);
        }

        // Validate redirect URL to prevent open redirect
        const safeRedirectUrl = validateRedirectUrl(
          redirectUrl,
          [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
          ENV.JETSTREAM_CLIENT_URL,
        );

        // No verification required
        if (provider.type === 'oauth') {
          redirect(res, safeRedirectUrl);
        } else {
          // this was an API call, client will handle redirect
          sendJson(res, { error: false, redirect: safeRedirectUrl });
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
  },
);

const verification = createRoute(
  routeDefinition.verification.validators,
  async ({ body, user, setCookie, clearCookie }, req, res, next) => {
    try {
      if (!req.session.user || !req.session.pendingVerification) {
        throw new InvalidSession('Missing user or pending verification');
      }

      const isPlaceholderUser = !!req.session.sessionDetails?.isTemporary || req.session.user.id === PLACEHOLDER_USER_ID;

      const { csrfToken, code, type, rememberDevice } = body;
      const pendingVerification = req.session.pendingVerification.find((item) => item.type === type);
      let rememberDeviceId: string | undefined;

      const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cookies = parseCookie(req.headers.cookie!);

      if (!pendingVerification) {
        throw new InvalidSession('Missing pending verification');
      }

      await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

      if (pendingVerification.exp <= new Date().getTime()) {
        throw new ExpiredVerificationToken(`Pending verification is expired: ${pendingVerification.exp}`);
      }

      switch (pendingVerification.type) {
        case 'email': {
          const { token } = pendingVerification;
          if (!timingSafeStringCompare(token, code)) {
            throw new InvalidVerificationToken('Provided code does not match');
          }
          if (!isPlaceholderUser) {
            req.session.user = (await setUserEmailVerified(req.session.user.id)) as UserProfileSession;
          }
          break;
        }
        case '2fa-email': {
          const { token } = pendingVerification;
          if (!timingSafeStringCompare(token, code)) {
            throw new InvalidVerificationToken('Provided code does not match');
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
          throw new InvalidVerificationToken(`Invalid verification type`);
        }
      }

      // Redirect back to sign in page
      if (isPlaceholderUser) {
        res.log.info(
          '[AUTH][PLACEHOLDER_USER] User registration with placeholder user - destroying session and redirecting to login with error',
        );
        req.session.destroy((err) => {
          if (err) {
            res.log.error({ ...getExceptionLog(err) }, '[AUTH][PLACEHOLDER_USER][ERROR] Error destroying session');
          }
          const searchParams = new URLSearchParams({ error: 'InvalidRegistration' });
          sendJson(res, { error: false, redirect: `/auth/login/?${searchParams.toString()}` });
        });
        return;
      }

      if (rememberDeviceId) {
        await createRememberDevice({
          userId: user.id,
          deviceId: rememberDeviceId,
          ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
          userAgent: req.get('User-Agent'),
        });
        setCookie(cookieConfig.rememberDevice.name, rememberDeviceId, cookieConfig.rememberDevice.options);
      }

      req.session.pendingVerification = null;

      if (req.session.sendNewUserEmailAfterVerify && req.session.user) {
        req.session.sendNewUserEmailAfterVerify = undefined;
        await sendWelcomeEmail(req.session.user.email);
      }

      let redirectUrl = ENV.JETSTREAM_CLIENT_URL;

      /**
       * FIXME: if the user invite works correctly, then we don't need to redirect
       */

      const redirectValue = cookies[cookieConfig.redirectUrl.name];
      if (redirectValue) {
        redirectUrl = redirectValue.startsWith('/') ? `${ENV.JETSTREAM_CLIENT_URL}${redirectValue}` : redirectValue;
        redirectUrl = redirectUrl.replace('/app/app', '/app');
        clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);
      }

      // Validate redirect URL to prevent open redirect
      const safeRedirectUrl = validateRedirectUrl(
        redirectUrl,
        [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
        ENV.JETSTREAM_CLIENT_URL,
      );

      createUserActivityFromReq(req, res, {
        action: '2FA_VERIFICATION',
        method: type.toUpperCase(),
        success: true,
      });

      if (req.session.pendingMfaEnrollment) {
        setCookie(cookieConfig.redirectUrl.name, safeRedirectUrl, cookieConfig.redirectUrl.options);
        sendJson(res, { error: false, redirect: '/auth/mfa-enroll' });
      } else {
        sendJson(res, { error: false, redirect: safeRedirectUrl });
      }
    } catch (ex) {
      createUserActivityFromReqWithError(req, res, ex, {
        action: '2FA_VERIFICATION',
        method: body?.type?.toUpperCase(),
        success: false,
      });

      next(ensureAuthError(ex));
    }
  },
);

const resendVerification = createRoute(routeDefinition.resendVerification.validators, async ({ body }, req, res, next) => {
  try {
    if (!req.session.user || !req.session.pendingVerification) {
      throw new InvalidSession('Missing user or pending verification');
    }

    const { csrfToken, type } = body;
    const pendingVerification = req.session.pendingVerification.find((item) => item.type === type);

    if (!pendingVerification) {
      throw new InvalidSession('Missing pending verification');
    }

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');
    const exp = addMinutes(new Date(), TOKEN_DURATION_MINUTES).getTime();
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
        await sendEmailVerification(req.session.user.email, token, EMAIL_VERIFICATION_TOKEN_DURATION_HOURS);
        break;
      }
      case '2fa-email': {
        await sendVerificationCode(req.session.user.email, token, TOKEN_DURATION_MINUTES);
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

    let success = true;
    let userId: string | undefined;

    try {
      const { token, userId: _userId } = await generatePasswordResetToken(email);
      userId = _userId;
      await sendPasswordReset(email, token, PASSWORD_RESET_DURATION_MINUTES);

      sendJson(res, { error: false });
    } catch (ex) {
      res.log.warn({ email }, `[AUTH][PASSWORD_RESET] ${getErrorMessage(ex)}`);
      success = false;
      sendJson(res, { error: false });
    }

    createUserActivityFromReq(req, res, {
      action: 'PASSWORD_RESET_REQUEST',
      method: 'UNAUTHENTICATED',
      userId,
      email,
      success,
    });
  } catch (ex) {
    res.log.warn(getErrorMessageAndStackObj(ex), `[AUTH][PASSWORD_RESET] Fatal error when processing password reset`);
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

    const userId = await resetUserPassword(email, token, password);

    await sendAuthenticationChangeConfirmation(email, 'Password change confirmation', {
      heading: 'Password changed',
    });

    createUserActivityFromReq(req, res, {
      action: 'PASSWORD_RESET_COMPLETION',
      method: 'UNAUTHENTICATED',
      userId,
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

const verifyEmailViaLink = createRoute(
  routeDefinition.verifyEmailViaLink.validators,
  async ({ query, setCookie, clearCookie }, req, res, next) => {
    try {
      if (!req.session.user) {
        throw new InvalidSession('User not set on session');
      }

      const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cookies = parseCookie(req.headers.cookie!);

      let redirectUrl = ENV.JETSTREAM_CLIENT_URL;

      const redirectValue = cookies[cookieConfig.redirectUrl.name];
      if (redirectValue) {
        redirectUrl = redirectValue.startsWith('/') ? `${ENV.JETSTREAM_CLIENT_URL}${redirectValue}` : redirectValue;
        redirectUrl = redirectUrl.replace('/app/app', '/app');
        clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);
      }

      // Validate redirect URL to prevent open redirect
      const safeRedirectUrl = validateRedirectUrl(
        redirectUrl,
        [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
        ENV.JETSTREAM_CLIENT_URL,
      );

      if (!req.session.pendingVerification?.length) {
        if (req.session.pendingMfaEnrollment) {
          setCookie(cookieConfig.redirectUrl.name, safeRedirectUrl, cookieConfig.redirectUrl.options);
          redirect(res, '/auth/mfa-enroll');
        } else {
          redirect(res, safeRedirectUrl);
        }
        return;
      }

      const { code } = query;

      const pendingVerification = req.session.pendingVerification.find(({ type }) => type === 'email');

      if (!pendingVerification) {
        throw new InvalidSession('Missing pending verification');
      }

      if (pendingVerification.exp <= new Date().getTime()) {
        throw new ExpiredVerificationToken(`Pending verification is expired: ${pendingVerification.exp}`);
      }

      switch (pendingVerification.type) {
        case 'email': {
          const { token } = pendingVerification;
          if (!timingSafeStringCompare(token, code)) {
            throw new InvalidVerificationToken('Provided code does not match');
          }
          req.session.user = (await setUserEmailVerified(req.session.user.id)) as UserProfileSession;
          break;
        }
        default: {
          throw new InvalidVerificationToken('Invalid verification type');
        }
      }

      createUserActivityFromReq(req, res, {
        action: 'EMAIL_VERIFICATION',
        success: true,
      });

      req.session.pendingVerification = null;

      if (req.session.pendingMfaEnrollment) {
        setCookie(cookieConfig.redirectUrl.name, safeRedirectUrl, cookieConfig.redirectUrl.options);
        redirect(res, '/auth/mfa-enroll');
      } else {
        redirect(res, safeRedirectUrl);
      }
    } catch (ex) {
      createUserActivityFromReqWithError(req, res, ex, {
        action: 'EMAIL_VERIFICATION',
        success: false,
      });

      next(ensureAuthError(ex));
    }
  },
);

const getOtpEnrollmentData = createRoute(routeDefinition.getOtpEnrollmentData.validators, async ({ user }, req, res, next) => {
  try {
    if (!req.session.user) {
      throw new InvalidSession('User not set on session');
    }

    if (!req.session.pendingMfaEnrollment) {
      res.status(403);
      throw new InvalidAction('There is no pending MFA enrollment');
    }

    const { secret, imageUri, uri } = await generate2faTotpUrl(user.id);

    sendJson(res, { secret, secretToken: new URL(uri).searchParams.get('secret'), imageUri, uri });
  } catch (ex) {
    next(ensureAuthError(ex));
  }
});

const enrollOtpFactor = createRoute(routeDefinition.enrollOtpFactor.validators, async ({ body, user, clearCookie }, req, res, next) => {
  try {
    if (!req.session.user) {
      throw new InvalidSession('User not set on session');
    }

    if (!req.session.pendingMfaEnrollment) {
      res.status(403);
      throw new InvalidAction('There is no pending MFA enrollment');
    }

    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cookies = parseCookie(req.headers.cookie!);

    const { csrfToken, code, secretToken } = body;
    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    const secret = await convertBase32ToHex(secretToken);
    await verify2faTotpOrThrow(secret, code);
    await createOrUpdateOtpAuthFactor(user.id, secret);

    req.session.pendingMfaEnrollment = null;

    let redirectUrl = ENV.JETSTREAM_CLIENT_URL;
    const redirectValue = cookies[cookieConfig.redirectUrl.name];
    if (redirectValue) {
      redirectUrl = redirectValue.startsWith('/') ? `${ENV.JETSTREAM_CLIENT_URL}${redirectValue}` : redirectValue;
      redirectUrl = redirectUrl.replace('/app/app', '/app');
      clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);
    }

    // Validate redirect URL to prevent open redirect
    const safeRedirectUrl = validateRedirectUrl(
      redirectUrl,
      [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
      ENV.JETSTREAM_CLIENT_URL,
    );

    sendJson(res, { error: false, redirectUrl: safeRedirectUrl });

    createUserActivityFromReq(req, res, {
      action: '2FA_SETUP',
      success: true,
    });
  } catch (ex) {
    createUserActivityFromReqWithError(req, res, ex, {
      action: '2FA_SETUP',
      success: false,
    });

    next(ensureAuthError(ex));
  }
});

/**
 * SSO Controllers
 */

const discoverSso = createRoute(routeDefinition.discoverSso.validators, async ({ body }, req, res, next) => {
  const { email, csrfToken } = body;
  try {
    const domain = email.split('@')[1];

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    const ssoConfig = await discoverSsoConfigByDomain(domain);

    if (!ssoConfig || !ssoConfig.ssoEnabled) {
      res.log.info({ email, ssoDiscoverSuccess: false }, '[AUTH][DISCOVER_SSO] No SSO configuration found for email domain');
      sendJson(res, { available: false });
      return;
    }

    res.log.info({ email, ssoDiscoverSuccess: true }, '[AUTH][DISCOVER_SSO] SSO configuration found for email domain');
    createUserActivityFromReq(req, res, {
      action: 'SSO_DISCOVER',
      method: ssoConfig.ssoProvider,
      email,
      teamId: ssoConfig.teamId,
      success: true,
    });
    sendJson(res, { available: true });
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), '[AUTH][DISCOVER_SSO] Error discovering SSO configuration');
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'SSO_DISCOVER',
      email,
      errorMessage: getErrorMessage(ex),
      success: false,
    });
    next(ensureAuthError(ex));
  }
});

const startSso = createRoute(routeDefinition.startSso.validators, async ({ body, query, setCookie }, req, res, next) => {
  const { returnUrl } = query;
  const { email, csrfToken } = body;
  try {
    const domain = email.split('@')[1];

    await verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

    const ssoConfig = await discoverSsoConfigByDomain(domain);

    if (!ssoConfig || !ssoConfig.ssoEnabled) {
      throw new InvalidProvider('SSO not configured for this domain');
    }

    const { teamId, ssoProvider } = ssoConfig;

    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

    if (returnUrl) {
      setCookie(cookieConfig.returnUrl.name, returnUrl, cookieConfig.returnUrl.options);
    }

    if (ssoProvider === 'OIDC') {
      const team = await getTeamLoginConfigWithSso(teamId);
      if (!team?.loginConfig.oidcConfiguration) {
        throw new InvalidProvider('OIDC not configured for this team');
      }

      const config = team.loginConfig.oidcConfiguration;
      const { url, codeVerifier, state, nonce } = await oidcService.getAuthorizationUrl(config, teamId);

      setCookie(cookieConfig.pkceCodeVerifier.name, codeVerifier, cookieConfig.pkceCodeVerifier.options);
      setCookie(cookieConfig.state.name, state, cookieConfig.state.options);
      setCookie(cookieConfig.nonce.name, nonce, cookieConfig.nonce.options);

      createUserActivityFromReq(req, res, {
        action: 'SSO_START',
        method: ssoProvider,
        email,
        teamId,
        success: true,
      });
      sendJson(res, { redirectUrl: url });
      return;
    }

    if (ssoProvider === 'SAML') {
      const team = await getTeamLoginConfigWithSso(teamId);
      if (!team?.loginConfig.samlConfiguration) {
        throw new InvalidProvider('SAML not configured for this team');
      }

      const config = team.loginConfig.samlConfiguration;
      const redirectUrl = await samlService.getAuthorizationUrl(config, teamId, returnUrl);

      createUserActivityFromReq(req, res, {
        action: 'SSO_START',
        method: ssoProvider,
        email,
        teamId,
        success: true,
      });
      sendJson(res, { redirectUrl });
      return;
    }
    throw new InvalidProvider('Unsupported SSO provider');
  } catch (ex) {
    res.log.error({ email, returnUrl, ...getErrorMessageAndStackObj(ex) }, '[AUTH][START_SSO] Error starting SSO');
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'SSO_START',
      email,
      success: false,
    });
    next(ensureAuthError(ex));
  }
});

const handleSamlCallback = createRoute(routeDefinition.handleSamlCallback.validators, async ({ params, body }, req, res, next) => {
  try {
    const { teamId } = params;
    const { SAMLResponse } = body;

    const team = await getTeamLoginConfigWithSso(teamId);

    if (!team?.loginConfig.samlConfiguration) {
      throw new InvalidProvider('SAML not configured for this team');
    }

    const config = team.loginConfig.samlConfiguration;

    // Validate SAML response
    const profile = await samlService.validateSamlResponse(SAMLResponse, config, teamId);

    // Extract user info from SAML assertion
    const attributeMapping = config.attributeMapping as any;
    const userInfo = samlService.extractUserInfo(profile, attributeMapping);

    // Handle SSO login (create/update user, add to team, create session)
    const user = await handleSsoLogin('saml', teamId, userInfo, req as any);

    // Log success
    createUserActivityFromReq(req, res, {
      action: 'SSO_LOGIN',
      method: 'SAML',
      userId: user.id,
      email: user.email,
      teamId,
      success: true,
    });

    const { returnUrl: returnUrlCookie } = getCookieConfig(ENV.USE_SECURE_COOKIES);
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
    clearOauthCookies(res);
    const returnUrl = validateRedirectUrl(
      cookies[returnUrlCookie.name],
      [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
      ENV.JETSTREAM_CLIENT_URL,
    );

    redirect(res, returnUrl);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), '[AUTH][SAML_CALLBACK] Error processing SAML callback');
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'SSO_LOGIN',
      method: 'SAML',
      teamId: params.teamId,
      success: false,
    });

    req.session.destroy(() => {
      next(ensureAuthError(ex));
    });
  }
});

const getSamlMetadata = createRoute(routeDefinition.getSamlMetadata.validators, async ({ params }, req, res, next) => {
  try {
    const { teamId } = params;

    const team = await getTeamLoginConfigWithSso(teamId);

    if (!team?.loginConfig.samlConfiguration) {
      res.set('Content-Type', 'application/xml');
      res.send(samlService.generatePlaceholderSamlConfiguration(teamId));
      return;
    }

    const config = team.loginConfig.samlConfiguration;
    const metadata = await samlService.generateServiceProviderMetadata(teamId, config);

    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), '[AUTH][SAML_METADATA] Error generating SAML metadata');
    res.status(500).send('Error generating SAML metadata');
  }
});

const handleOidcCallback = createRoute(routeDefinition.handleOidcCallback.validators, async ({ params }, req, res, next) => {
  try {
    const { teamId } = params;

    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};

    const state = cookies[cookieConfig.state.name];
    const codeVerifier = cookies[cookieConfig.pkceCodeVerifier.name];
    const nonce = cookies[cookieConfig.nonce.name];
    const returnUrl = validateRedirectUrl(
      cookies[cookieConfig.returnUrl.name],
      [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL],
      ENV.JETSTREAM_CLIENT_URL,
    );

    // Clear cookies
    clearOauthCookies(res);

    if (!state || !codeVerifier || !nonce) {
      throw new InvalidSession('Missing or invalid OIDC state');
    }

    const team = await getTeamLoginConfigWithSso(teamId);

    if (!team?.loginConfig.oidcConfiguration) {
      throw new InvalidProvider('OIDC not configured for this team');
    }

    const config = team.loginConfig.oidcConfiguration;

    // Build current URL from request
    const currentUrl = new URL(`${ENV.JETSTREAM_SERVER_URL}${req.originalUrl}`);

    // Validate callback and exchange code for tokens
    const { claims, idTokenResult } = await oidcService.validateOidcCallback(config, teamId, currentUrl, state, codeVerifier, nonce);

    // Extract user info from claims
    const attributeMapping = config.attributeMapping as any;
    const userInfo = await oidcService.extractUserInfo(config, claims, idTokenResult.access_token, attributeMapping);

    // Handle SSO login (create/update user, add to team, create session)
    const user = await handleSsoLogin('oidc', teamId, userInfo, req as any);

    // Log success
    createUserActivityFromReq(req, res, {
      action: 'SSO_LOGIN',
      method: 'OIDC',
      userId: user.id,
      email: user.email,
      teamId,
      success: true,
    });

    redirect(res, returnUrl);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), '[AUTH][OIDC_CALLBACK] Error processing OIDC callback');
    createUserActivityFromReqWithError(req, res, ex, {
      action: 'SSO_LOGIN',
      method: 'OIDC',
      teamId: params.teamId,
      success: false,
    });

    req.session.destroy(() => {
      next(ensureAuthError(ex));
    });
  }
});

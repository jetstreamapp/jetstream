import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import {
  AuthError,
  ExpiredVerificationToken,
  InvalidCaptcha,
  MissingEntitlement,
  PLACEHOLDER_USER_ID,
  checkUserAgentSimilarity,
  generateHMACDoubleCSRFToken,
  getApiAddressFromReq,
  getCookieConfig,
  validateHMACDoubleCSRFToken,
} from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, getDefaultAppState, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { parse as parseCookie } from 'cookie';
import { addDays, getUnixTime, isBefore } from 'date-fns';
import * as express from 'express';
import pino from 'pino';
import { v4 as uuid } from 'uuid';
import { environment } from '../../environments/environment';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { checkUserEntitlement } from '../db/user.db';
import * as sfdcEncService from '../services/salesforce-org-encryption.service';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

export function basicAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string') {
      return res.status(401).send('Unauthorized');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Basic') {
      return res.status(401).send('Unauthorized');
    }
    if (!ENV.BASIC_AUTH_USERNAME || !ENV.BASIC_AUTH_PASSWORD) {
      logger.error('BASIC_AUTH_USERNAME/BASIC_AUTH_PASSWORD environment variables are not set');
      return res.status(401).send('Unauthorized');
    }
    const [username, password] = Buffer.from(token, 'base64').toString().split(':');
    if (username !== ENV.BASIC_AUTH_USERNAME || password !== ENV.BASIC_AUTH_PASSWORD) {
      return res.status(401).send('Unauthorized');
    }
    next();
  } catch {
    res.header('WWW-Authenticate', 'Basic realm="Jetstream OpenAPI"');
    return res.status(401).send('Unauthorized');
  }
}

export function addContextMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.requestId = res.locals.requestId || req.get('rndr-id') || uuid();
  const clientReqId = req.header(HTTP.HEADERS.X_CLIENT_REQUEST_ID);
  if (clientReqId) {
    res.setHeader(HTTP.HEADERS.X_CLIENT_REQUEST_ID, clientReqId);
  }
  res.setHeader(HTTP.HEADERS.X_REQUEST_ID, res.locals.requestId);
  next();
}

/**
 * Set's cookie that is used by front-end application
 * @param req
 * @param res
 * @param next
 */
export function setApplicationCookieMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const appCookie = getDefaultAppState({
    serverUrl: ENV.JETSTREAM_SERVER_URL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_API_VERSION}`,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_appId: ENV.GOOGLE_APP_ID!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_apiKey: ENV.GOOGLE_API_KEY!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_clientId: ENV.GOOGLE_CLIENT_ID!,
  });
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false, sameSite: 'strict' });
  next();
}

export function notFoundMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const error = new NotFoundError('Route not found');
  next(error);
}

/**
 * Check user agent and block if it does not appear to be a browser
 * @param req
 * @param res
 * @param next
 * @returns
 */
export function blockBotByUserAgentMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userAgent = req.get('User-Agent');
  if (userAgent?.toLocaleLowerCase().includes('python')) {
    (res.log || logger).debug(
      {
        blocked: true,
        method: req.method,
        url: req.originalUrl,
        requestId: res.locals.requestId,
        agent: req.get('User-Agent'),
        referrer: req.get('Referrer'),
        ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
        country: req.headers[HTTP.HEADERS.CF_IPCountry],
        userAgent,
      },
      '[BLOCKED REQUEST][USER AGENT] %s %s',
      req.method,
      req.originalUrl,
    );
    return res.status(403).send('Forbidden');
  }
  next();
}

export function destroySessionIfPendingVerificationIsExpired(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.pendingVerification?.length) {
    const { exp } = req.session.pendingVerification[0];
    if (exp < new Date().getTime()) {
      req.session.destroy(() => {
        next(new ExpiredVerificationToken());
      });
      return;
    }
  }
  next();
}

export async function redirectIfPendingVerificationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.pendingVerification?.length) {
    const { exp } = req.session.pendingVerification[0];
    if (exp < getUnixTime(new Date())) {
      req.session.destroy(() => {
        return next(new ExpiredVerificationToken());
      });
    }

    const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

    if (!isJson) {
      res.redirect(302, `/auth/verify`);
      return;
    } else {
      next(new AuthError('Pending verification token'));
      return;
    }
  }
  next();
}

export async function redirectIfMfaEnrollmentRequiredMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.pendingMfaEnrollment) {
    const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

    if (!isJson) {
      res.redirect(302, `/auth/mfa-enroll`);
      return;
    } else {
      next(new AuthError('Pending Multi-factor authentication enrollment. Login again to finish the enrollment.'));
      return;
    }
  }
  next();
}

export async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userAgent = req.get('User-Agent');

  const user = req.session.user;
  const pendingVerification = req.session.pendingVerification;

  if (req.session.userAgent && req.session.userAgent !== userAgent) {
    if (!checkUserAgentSimilarity(req.session.userAgent, userAgent || '')) {
      req.log.error(`[AUTH][UNAUTHORIZED] User-Agent mismatch: ${req.session.userAgent} !== ${userAgent}`);
      req.session.destroy((err) => {
        if (err) {
          (res.log || logger).error({ ...getExceptionLog(err) }, '[AUTH][UNAUTHORIZED][ERROR] Error destroying session');
        }
        // TODO: Send email to user about potential suspicious activity
        next(new AuthenticationError('Unauthorized'));
      });
      return;
    }
  }

  if (user && user.id !== PLACEHOLDER_USER_ID && !pendingVerification) {
    return next();
  }

  req.log.error('[AUTH][UNAUTHORIZED]');
  next(new AuthenticationError('Unauthorized'));
}

export async function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (req.get(HTTP.HEADERS.X_SFDC_ID) || req.query[HTTP.HEADERS.X_SFDC_ID]) {
      res.locals = res.locals || {};
      const results = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION, res.locals.requestId);
      if (results) {
        const { org, jetstreamConn } = results;
        res.locals.org = org;
        res.locals.jetstreamConn = jetstreamConn;
      }
    }
    if (req.get(HTTP.HEADERS.X_SFDC_ID_TARGET) || req.query[HTTP.HEADERS.X_SFDC_ID_TARGET]) {
      res.locals = res.locals || {};
      const results = await getOrgFromHeaderOrQuery(
        req,
        HTTP.HEADERS.X_SFDC_ID_TARGET,
        HTTP.HEADERS.X_SFDC_API_TARGET_VERSION,
        res.locals.requestId,
      );
      if (results) {
        if (results) {
          const { org, jetstreamConn } = results;
          res.locals.targetOrg = org;
          res.locals.targetJetstreamConn = jetstreamConn;
        }
      }
    }
  } catch (ex) {
    req.log.warn(getExceptionLog(ex), '[INIT-ORG][ERROR]');
    if (ex instanceof NotFoundError) {
      return next(ex);
    }
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

export const verifyEntitlement =
  (entitlement: Parameters<typeof checkUserEntitlement>[0]['entitlement']) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      if (!req.session.user) {
        return next(new UserFacingError('User is required'));
      }

      if (!(await checkUserEntitlement({ userId: req.session.user.id, entitlement }))) {
        next(new MissingEntitlement());
        return;
      }

      next();
    } catch (ex) {
      res.status(403);
      next(new UserFacingError('You do not have access to this feature'));
    }
  };

export function ensureOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.jetstreamConn) {
    req.log.info('[INIT-ORG][ERROR] An org did not exist on locals');
    return next(new UserFacingError('An org is required for this action'));
  }
  next();
}

export function ensureTargetOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.targetJetstreamConn) {
    req.log.info('[INIT-ORG][ERROR] A target org did not exist on locals');
    return next(new UserFacingError('A target org is required for this action'));
  }
  next();
}

/**
 * Get org id from header/query param
 * query org for user
 * add refresh token callback
 * return org
 *
 * @param req
 * @param headerKey
 * @param versionHeaderKey
 */
export async function getOrgFromHeaderOrQuery(req: express.Request, headerKey: string, versionHeaderKey: string, requestId?: string) {
  const uniqueId = (req.get(headerKey) || req.query[headerKey]) as string;
  // TODO: not yet implemented on the front-end
  const apiVersion = (req.get(versionHeaderKey) || req.query[versionHeaderKey]) as string | undefined;
  const includeCallOptions = ensureBoolean(
    req.get(HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS) || (req.query.includeCallOptions as string | undefined),
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = req.session.user!;

  if (!uniqueId) {
    return;
  }

  return getOrgForRequest(user, uniqueId, req.log, apiVersion, includeCallOptions, requestId);
}

export async function getOrgForRequest(
  user: UserProfileSession,
  uniqueId: string,
  logger: pino.Logger | typeof console = console,
  apiVersion?: string,
  includeCallOptions?: boolean,
  requestId?: string,
) {
  const org = await salesforceOrgsDb.findByUniqueId_UNSAFE(user.id, uniqueId);
  if (!org || org.jetstreamUserId2 !== user.id) {
    throw new NotFoundError('An org with the provided id does not exist');
  }

  const { accessToken: encryptedAccessToken, instanceUrl, orgNamespacePrefix, userId: salesforceUserId, organizationId } = org;
  const [accessToken, refreshToken] = await sfdcEncService.decryptAccessToken({ encryptedAccessToken, userId: user.id });

  // Early exit if org is expired and the connection is invalid - this avoids updating activity and attempting to call salesforce
  if (accessToken === sfdcEncService.DUMMY_INVALID_ENCRYPTED_TOKEN && org.expirationScheduledFor) {
    throw new UserFacingError('This org has expired due to inactivity. Reconnect the org to continue using it.');
  }

  // Clear expiration and update last activity when org is accessed
  // This should be done after decryption so that the org stays expired if decryption failed (we use placeholder decryption token)
  if (org.expirationScheduledFor) {
    salesforceOrgsDb.clearExpiration(org.id, user.id).catch((err) => {
      logger.error({ orgId: org.id, userId: user.id, ...getExceptionLog(err) }, '[ORG][UPDATE] Error clearing expirationScheduledFor');
    });
  } else {
    // Only update lastActivityAt if it's null or older than 1 day to reduce DB writes
    const oneDayAgo = addDays(new Date(), -1);
    if (!org.lastActivityAt || isBefore(new Date(org.lastActivityAt), oneDayAgo)) {
      salesforceOrgsDb.updateLastActivity(org.id).catch((err) => {
        logger.error({ orgId: org.id, userId: user.id, ...getExceptionLog(err) }, '[ORG][UPDATE] Error updating lastActivityAt');
      });
    }
  }

  apiVersion = apiVersion || org.apiVersion || ENV.SFDC_API_VERSION;
  let callOptions: Record<string, string> = {
    client: 'jetstream',
  };

  if (orgNamespacePrefix && includeCallOptions) {
    callOptions = { ...callOptions, defaultNamespace: orgNamespacePrefix };
  }

  // Handle org refresh - then remove event listener if refreshed
  const handleRefresh = async (accessToken: string, refreshToken: string) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      if (!refreshToken) {
        return;
      }
      await salesforceOrgsDb.updateAccessToken_UNSAFE({ accessToken, refreshToken, org, userId: user.id });
    } catch (ex) {
      logger.error({ requestId, ...getExceptionLog(ex) }, '[ORG][REFRESH] Error saving refresh token');
    }
  };

  const handleConnectionError = async (error: string) => {
    try {
      await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError: error });
    } catch (ex) {
      logger.error({ requestId, ...getExceptionLog(ex) }, '[ORG][UPDATE] Error updating connection error on org');
    }
  };

  const jetstreamConn = new ApiConnection(
    {
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: salesforceUserId,
      organizationId,
      accessToken,
      apiVersion,
      callOptions,
      instanceUrl,
      refreshToken,
      logging: ENV.LOG_LEVEL === 'trace',
      logger,
      sfdcClientId: ENV.SFDC_CONSUMER_KEY,
      sfdcClientSecret: ENV.SFDC_CONSUMER_SECRET,
    },
    handleRefresh,
    handleConnectionError,
  );

  return { org, jetstreamConn };
}

export function verifyCaptcha(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ENV.CAPTCHA_SECRET_KEY || ENV.CI) {
    return next();
  }
  const token = req.body?.[ENV.CAPTCHA_PROPERTY];
  if (!token) {
    return next(new InvalidCaptcha());
  }

  fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    body: JSON.stringify({
      secret: ENV.CAPTCHA_SECRET_KEY,
      response: token,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      remoteip: res.locals.ipAddress || getApiAddressFromReq(req as any),
    }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((res) => {
      if (res.ok) {
        return res.json();
      }
      throw new InvalidCaptcha();
    })
    .then((res) => {
      if (res.success) {
        return next();
      }
      (res.log || logger).warn({ token, res }, '[CAPTCHA][FAILED]');
      throw new InvalidCaptcha();
    })
    .catch(() => {
      next(new InvalidCaptcha());
    });
}

/**
 * HMAC Double CSRF Token validation middleware with logging-only mode
 * This validates the HMAC double CSRF token but only logs violations without blocking requests
 * Once all client applications are updated, change logOnly to false to start blocking
 */
export function validateDoubleCSRF(req: express.Request, res: express.Response, next: express.NextFunction) {
  const skipMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  if (skipMethods.has(req.method)) {
    return next();
  }

  // Skip if user is not logged in (no session)
  if (!req.session?.user) {
    // Log for monitoring
    (res.log || logger).warn(
      {
        path: req.path,
        method: req.method,
        hasUser: !!req.session?.user,
      },
      '[CSRF][SKIP] No user session',
    );
    return next();
  }

  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
  const cookies = parseCookie(req.headers.cookie || '');
  let cookieToken = cookies?.[cookieConfig.doubleCSRFToken.name];
  const requestToken = decodeURIComponent(req.get(HTTP.HEADERS.X_CSRF_TOKEN) || req.body?.[HTTP.BODY.CSRF_TOKEN] || '');

  // Migration support: Generate CSRF token for authenticated users who don't have one
  // This handles existing sessions from before CSRF implementation
  // TODO: Remove this migration logic after at least 48 hours after the release with CSRF enforcement (sessions without use expire in 2 days, others would have been fixed)
  let isNewTokenGenerated = false;
  if (!cookieToken && req.session?.id) {
    cookieToken = generateHMACDoubleCSRFToken(ENV.JETSTREAM_SESSION_SECRET, req.session.id);
    res.cookie(cookieConfig.doubleCSRFToken.name, cookieToken, cookieConfig.doubleCSRFToken.options);
    isNewTokenGenerated = true;

    (res.log || logger).info(
      {
        sessionAge: req.session.loginTime ? Date.now() - req.session.loginTime : 'unknown',
      },
      '[CSRF][MIGRATION] Generated CSRF token for existing session',
    );
  }

  try {
    // For newly generated tokens during migration, skip validation since the client
    // hasn't had a chance to send the new token in the header yet
    // TODO: Remove the isNewTokenGenerated bypass after migration period ends
    const isValid =
      isNewTokenGenerated || validateHMACDoubleCSRFToken(ENV.JETSTREAM_SESSION_SECRET, cookieToken, requestToken, req.session.id);

    if (!isValid) {
      // Log the CSRF violation
      (res.log || logger).warn(
        {
          hasCookieToken: !!cookieToken,
          hasHeaderToken: !!requestToken,
          cookieTokenLength: cookieToken?.length,
          headerTokenLength: requestToken?.length,
          tokensMatch: cookieToken === requestToken,
        },
        '[CSRF][VIOLATION] HMAC Double CSRF token validation failed',
      );

      return res.status(403).json({
        error: true,
        message: 'Invalid CSRF token',
      });
    }
  } catch (error) {
    // Log validation errors
    (res.log || logger).error(
      {
        ...getErrorMessageAndStackObj(error),
        path: req.path,
        method: req.method,
        userId: req.session?.user?.id,
      },
      '[CSRF][ERROR] Error validating HMAC double CSRF token',
    );

    return res.status(403).json({
      error: true,
      message: 'Invalid CSRF token',
    });
  }

  next();
}

export function setPermissionPolicy(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'clipboard-read=(self)',
      'clipboard-write=(self)',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'hid=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'usb=()',
      'serial=()',
      'xr-spatial-tracking=()',
      'screen-wake-lock=()',
    ].join(', '),
  );
  next();
}

/**
 * Only set this for static assets that should not be loaded by other origins
 */
export function setCrossOriginResourcePolicy(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (environment.production) {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }
  next();
}

export function setCacheControlForApiRoutes(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  next();
}

import { WithAuthProp } from '@clerk/clerk-sdk-node';
import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean } from '@jetstream/shared/utils';
import { ApplicationCookie } from '@jetstream/types';
import { addDays, getUnixTime } from 'date-fns';
import * as express from 'express';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { v4 as uuid } from 'uuid';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { clerkClient, incomingMessageToClerkRequest } from '../services/auth.service';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

export const rateLimitStandardMiddleware = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 900, // limit each IP to 1000 requests per minute (15/RPS)
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimitMediumMiddleware = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 1000, // limit each IP to 1000 requests per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimitStrictMiddleware = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 100, // limit each IP to 100 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
});

export function addContextMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.requestId = res.locals.requestId || uuid();
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
  const appCookie: ApplicationCookie = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    serverUrl: ENV.JETSTREAM_SERVER_URL!,
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_API_VERSION}`,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_appId: ENV.GOOGLE_APP_ID!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_apiKey: ENV.GOOGLE_API_KEY!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    google_clientId: ENV.GOOGLE_CLIENT_ID!,
  };
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
  const userAgent = req.header('User-Agent');
  if (userAgent?.toLocaleLowerCase().includes('python')) {
    logger.debug(
      {
        blocked: true,
        method: req.method,
        url: req.originalUrl,
        requestId: res.locals.requestId,
        agent: req.header('User-Agent'),
        referrer: req.get('Referrer'),
        ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
        country: req.headers[HTTP.HEADERS.CF_IPCountry],
        userAgent,
      },
      '[BLOCKED REQUEST][USER AGENT] %s %s',
      req.method,
      req.originalUrl
    );
    return res.status(403).send('Forbidden');
  }
  next();
}

function getActivityExp() {
  return getUnixTime(addDays(new Date(), 1));
}

export async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (ENV.EXAMPLE_USER_OVERRIDE && ENV.EXAMPLE_USER && req.hostname === 'localhost') {
    // req.user = ENV.EXAMPLE_USER;
    return next();
  }

  // This is used in SFDC oauth flow, the clerk uat token does not carry through on the redirect back from SFDC
  const extraHeaders: Record<string, string> = {};
  if (req.path === '/sfdc/callback' && !req.cookies.__client_uat && req.cookies[HTTP.COOKIE.PKCE_CLERK_UAT]) {
    extraHeaders.cookie = req.headers.cookie + `; __client_uat=${req.cookies[HTTP.COOKIE.PKCE_CLERK_UAT]}`;
  }

  const authResults = await clerkClient.authenticateRequest(incomingMessageToClerkRequest(req, extraHeaders), {});
  (req as WithAuthProp<any>).auth = {
    ...authResults.toAuth(),
    claims: authResults.toAuth()?.sessionClaims,
  };

  if (authResults.isSignedIn) {
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
        res.locals.requestId
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
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

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
    req.get(HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS) || (req.query.includeCallOptions as string | undefined)
  );
  const userId = req.auth?.userId;

  if (!userId || !uniqueId) {
    return;
  }

  return getOrgForRequest(userId, uniqueId, req.log, apiVersion, includeCallOptions, requestId);
}

export async function getOrgForRequest(
  userId: string,
  uniqueId: string,
  logger: pino.Logger | typeof console = console,
  apiVersion?: string,
  includeCallOptions?: boolean,
  requestId?: string
) {
  const org = await salesforceOrgsDb.findByUniqueId_UNSAFE(userId, uniqueId);
  if (!org) {
    throw new UserFacingError('An org was not found with the provided id');
  }

  const { accessToken: encryptedAccessToken, instanceUrl, orgNamespacePrefix, userId: sfdcUserId, organizationId } = org;
  const [accessToken, refreshToken] = salesforceOrgsDb.decryptAccessToken(encryptedAccessToken);

  apiVersion = apiVersion || org.apiVersion || ENV.SFDC_API_VERSION;
  let callOptions = {
    client: 'jetstream',
  };

  if (orgNamespacePrefix && includeCallOptions) {
    callOptions = { ...callOptions, defaultNamespace: orgNamespacePrefix } as any;
  }

  // Handle org refresh - then remove event listener if refreshed
  const handleRefresh = async (accessToken: string, refreshToken: string) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      if (!refreshToken) {
        return;
      }
      await salesforceOrgsDb.updateAccessToken_UNSAFE(org, accessToken, refreshToken);
    } catch (ex) {
      logger.error({ requestId, ...getExceptionLog(ex) }, '[ORG][REFRESH] Error saving refresh token');
    }
  };

  const jetstreamConn = new ApiConnection(
    {
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: sfdcUserId,
      organizationId,
      accessToken,
      apiVersion,
      callOptions,
      instanceUrl,
      refreshToken,
      logging: ENV.ENVIRONMENT === 'development',
      logger,
      sfdcClientId: ENV.SFDC_CONSUMER_KEY,
      sfdcClientSecret: ENV.SFDC_CONSUMER_SECRET,
    },
    handleRefresh
  );

  return { org, jetstreamConn };
}

import { ENV } from '@jetstream/api-config';
import { getApiAddressFromReq, getCookieConfig, InvalidSession, MissingEntitlement } from '@jetstream/auth/server';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { fromUnixTime } from 'date-fns';
import { z } from 'zod';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import * as userSyncDbService from '../db/data-sync.db';
import * as userDbService from '../db/user.db';
import { checkUserEntitlement } from '../db/user.db';
import * as webExtDb from '../db/web-extension.db';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import * as externalAuthService from '../services/external-auth.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  initAuthMiddleware: {
    controllerFn: () => initAuthMiddleware,
    validators: {
      hasSourceOrg: false,
    },
  },
  logout: {
    controllerFn: () => logout,
    validators: {
      body: z.object({
        deviceId: z.string(),
        accessToken: z.string(),
      }),
      hasSourceOrg: false,
    },
  },
  initSession: {
    controllerFn: () => initSession,
    validators: {
      query: z.object({
        deviceId: z.string().uuid(),
      }),
      hasSourceOrg: false,
    },
  },
  verifyTokens: {
    controllerFn: () => verifyTokens,
    validators: {
      body: z.object({
        deviceId: z.string(),
        accessToken: z.string(),
      }),
      hasSourceOrg: false,
    },
  },
  dataSyncPull: {
    controllerFn: () => dataSyncPull,
    validators: {
      ...dataSyncController.pull.validators,
    },
  },
  dataSyncPush: {
    controllerFn: () => dataSyncPush,
    validators: {
      ...dataSyncController.push.validators,
    },
  },
};

/**
 * Render static page for web extension to initialize session
 * Page calls back to API to initialize session so that we do not generate tokens in source code
 */
const initAuthMiddleware = createRoute(routeDefinition.initAuthMiddleware.validators, async ({ setCookie }, req, res, next) => {
  // redirect to login flow if user is not signed in
  if (!req.session.user) {
    const { redirectUrl: redirectUrlCookie } = getCookieConfig(ENV.USE_SECURE_COOKIES);
    setCookie(redirectUrlCookie.name, `${ENV.JETSTREAM_SERVER_URL}/web-extension/init`, redirectUrlCookie.options);
    redirect(res as any, '/auth/login/');
    return;
  }
  next();
});

/**
 * This issues access tokens or returns existing access tokens
 * This route is called after the user is already authenticated through normal means
 */
const initSession = createRoute(routeDefinition.initSession.validators, async ({ query, user }, req, res, next) => {
  const { deviceId } = query;

  if (!req.session.user) {
    next(new InvalidSession());
    return;
  }

  if (!(await checkUserEntitlement({ userId: user.id, entitlement: 'chromeExtension' }))) {
    next(new MissingEntitlement());
    return;
  }

  let accessToken = '';

  const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id, omitSubscriptions: true });
  const existingRecord = await webExtDb.findByUserIdAndDeviceId({
    userId: user.id,
    deviceId,
    type: webExtDb.TOKEN_TYPE_AUTH,
    expiresAtBufferDays: externalAuthService.TOKEN_AUTO_REFRESH_DAYS,
  });

  // issue a new token if one does not exist withing the auto-refresh buffer
  if (!existingRecord) {
    accessToken = await externalAuthService.issueAccessToken(userProfile, externalAuthService.AUDIENCE_WEB_EXT);
    await webExtDb.create(user.id, {
      type: 'AUTH_TOKEN',
      source: webExtDb.TOKEN_SOURCE_BROWSER_EXTENSION,
      token: accessToken,
      deviceId,
      ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
      userAgent: req.get('User-Agent') || 'unknown',
      expiresAt: fromUnixTime(externalAuthService.decodeToken(accessToken).exp),
    });
  } else {
    // return existing token since it is still valid
    accessToken = existingRecord.token;
  }

  sendJson(res, { accessToken });
});

const verifyTokens = createRoute(routeDefinition.verifyTokens.validators, async ({ body }, req, res, next) => {
  try {
    const { accessToken, deviceId } = body;
    // This validates the token against the database record
    const { userProfile } = await externalAuthService.verifyToken({ token: accessToken, deviceId }, externalAuthService.AUDIENCE_WEB_EXT);
    res.log.info({ userId: userProfile.id, deviceId }, 'Web extension token verified');

    sendJson(res, { success: true });
  } catch (ex) {
    res.log.error({ deviceId: body?.deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error verifying web extension token');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const logout = createRoute(routeDefinition.logout.validators, async ({ body }, req, res, next) => {
  try {
    const { accessToken, deviceId } = body;
    // This validates the token against the database record
    const { userProfile } = await externalAuthService.verifyToken({ token: accessToken, deviceId }, externalAuthService.AUDIENCE_WEB_EXT);
    webExtDb.deleteByUserIdAndDeviceId({ userId: userProfile.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });
    res.log.info({ userId: userProfile.id, deviceId }, 'User logged out of browser extension');

    sendJson(res, { success: true });
  } catch (ex) {
    res.log.error({ deviceId: body?.deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error logging out of browser extension');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const dataSyncPull = createRoute(routeDefinition.dataSyncPull.validators, async ({ user, query }, req, res) => {
  const { lastKey, updatedAt, limit } = query;
  const response = await userSyncDbService.findByUpdatedAt({
    userId: user.id,
    lastKey,
    updatedAt,
    limit,
  });
  sendJson(res, response);
});

/**
 * Push changes to server and emit to any other clients the user has active
 */
const dataSyncPush = createRoute(routeDefinition.dataSyncPush.validators, async ({ user, body: records, query }, req, res) => {
  const response = await userSyncDbService.syncRecordChanges({
    updatedAt: query.updatedAt,
    userId: user.id,
    records,
    includeAllIfUpdatedAtNull: query.includeAllIfUpdatedAtNull,
  });

  const syncEvent: SyncEvent = {
    clientId: query.clientId,
    data: { hashedKeys: response.records.map(({ hashedKey }) => hashedKey) },
    userId: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const deviceId = req.get(HTTP.HEADERS.X_EXT_DEVICE_ID)! || req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID)!;
  emitRecordSyncEventsToOtherClients(deviceId, syncEvent);

  sendJson(res, response);
});

import { ENV } from '@jetstream/api-config';
import {
  createUserActivityFromReq,
  getApiAddressFromReq,
  getCookieConfig,
  InvalidSession,
  MissingEntitlement,
} from '@jetstream/auth/server';
import { NotificationMessageV1Response } from '@jetstream/desktop/types';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { UserProfileUiSchema } from '@jetstream/types';
import { fromUnixTime } from 'date-fns';
import { z } from 'zod';
import * as userSyncDbService from '../db/data-sync.db';
import * as userDbService from '../db/user.db';
import { checkUserEntitlement } from '../db/user.db';
import * as webExtDb from '../db/web-extension.db';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import * as externalAuthService from '../services/external-auth.service';
import { decryptJwtTokenOrPlaintext } from '../services/jwt-token-encryption.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';
import { routeDefinition as dataSyncController } from './data-sync.controller';

export const routeDefinition = {
  initAuthMiddleware: {
    controllerFn: () => initAuthMiddleware,
    validators: {
      hasSourceOrg: false,
    },
  },
  logout: {
    controllerFn: () => logout,
    responseType: z.object({ success: z.boolean(), error: z.string().nullish() }),
    validators: {
      /**
       * @deprecated, prefer headers for passing deviceId and accessToken
       * For backwards compatibility, auth checks attempt to pull from body if headers are not present
       */
      body: z
        .object({
          deviceId: z.string().optional(),
          accessToken: z.string().optional(),
        })
        .optional(),
      hasSourceOrg: false,
    },
  },
  initSession: {
    controllerFn: () => initSession,
    responseType: z.object({ accessToken: z.string() }),
    validators: {
      hasSourceOrg: false,
    },
  },
  verifyToken: {
    controllerFn: () => verifyToken,
    responseType: z.object({ success: z.boolean(), error: z.string().nullish(), userProfile: UserProfileUiSchema.optional() }),
    validators: {
      /**
       * @deprecated, prefer headers for passing deviceId and accessToken
       * For backwards compatibility, auth checks attempt to pull from body if headers are not present
       */
      body: z
        .object({
          deviceId: z.string().optional(),
          accessToken: z.string().optional(),
        })
        .optional(),
      hasSourceOrg: false,
    },
  },
  dataSyncPull: {
    controllerFn: () => dataSyncPull,
    responseType: z.any(),
    validators: {
      ...dataSyncController.pull.validators,
    },
  },
  dataSyncPush: {
    controllerFn: () => dataSyncPush,
    responseType: z.any(),
    validators: {
      ...dataSyncController.push.validators,
    },
  },
  notifications: {
    controllerFn: () => notifications,
    responseType: z.any(),
    validators: {
      query: z.object({ os: z.string(), version: z.string(), isPackaged: z.union([z.string(), z.boolean()]).optional().default(true) }),
      hasSourceOrg: false,
    },
  },
};

/**
 * Render static page for Desktop App to initialize session
 * Page calls back to API to initialize session so that we do not generate tokens in source code
 */
const initAuthMiddleware = createRoute(routeDefinition.initAuthMiddleware.validators, async ({ setCookie }, req, res, next) => {
  // redirect to login flow if user is not signed in
  if (!req.session.user) {
    const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
    const { redirectUrl: redirectUrlCookie } = getCookieConfig(ENV.USE_SECURE_COOKIES);
    setCookie(redirectUrlCookie.name, `${ENV.JETSTREAM_SERVER_URL}/desktop-app/auth?${queryParams}`, redirectUrlCookie.options);
    redirect(res, '/auth/login/');
    return;
  }
  next();
});

/**
 * This issues access tokens or returns existing access tokens
 * This route is called after the user is already authenticated through normal means
 */
const initSession = createRoute(routeDefinition.initSession.validators, async ({ user }, req, res, next) => {
  const { deviceId } = res.locals;

  if (!req.session.user || !deviceId) {
    next(new InvalidSession());
    return;
  }

  if (!(await checkUserEntitlement({ userId: user.id, entitlement: 'desktop' }))) {
    next(new MissingEntitlement());
    return;
  }

  const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id, omitSubscriptions: true });

  // Check for existing valid token with refresh buffer (7 days)
  const existingTokenRecord = await webExtDb.findByUserIdAndDeviceId({
    userId: user.id,
    deviceId,
    type: webExtDb.TOKEN_TYPE_AUTH,
    expiresAtBufferDays: externalAuthService.TOKEN_AUTO_REFRESH_DAYS,
  });

  if (existingTokenRecord) {
    // Decrypt the stored token and return it (supports both encrypted and legacy plaintext)
    const decryptedToken = decryptJwtTokenOrPlaintext(existingTokenRecord.token);
    const decoded = externalAuthService.decodeToken(decryptedToken);
    const expiresAt = fromUnixTime(decoded.exp);

    res.log.info({ userId: user.id, deviceId, expiresAt }, 'Reusing existing desktop token');

    sendJson(res, { accessToken: decryptedToken });
    createUserActivityFromReq(req, res, {
      action: 'DESKTOP_LOGIN_TOKEN_REUSED',
      success: true,
    });
    return;
  }

  // Issue new token if none exists or about to expire
  const accessToken = await externalAuthService.issueAccessToken(userProfile, externalAuthService.AUDIENCE_DESKTOP);
  await webExtDb.create(user.id, {
    type: webExtDb.TOKEN_TYPE_AUTH,
    source: webExtDb.TOKEN_SOURCE_DESKTOP,
    token: accessToken,
    deviceId,
    ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
    userAgent: req.get('User-Agent') || 'unknown',
    expiresAt: fromUnixTime(externalAuthService.decodeToken(accessToken).exp),
  });

  res.log.info({ userId: user.id, deviceId }, 'Issued new desktop token');

  sendJson(res, { accessToken });

  createUserActivityFromReq(req, res, {
    action: 'DESKTOP_LOGIN_TOKEN_ISSUED',
    success: true,
  });
});

const verifyToken = createRoute(routeDefinition.verifyToken.validators, async ({ user }, _, res) => {
  const { deviceId } = res.locals;
  try {
    if (!user) {
      throw new InvalidSession();
    }

    const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id, omitSubscriptions: true });
    res.log.info({ userId: userProfile.id, deviceId }, 'Desktop App token verified');

    sendJson(res, { success: true, userProfile });
  } catch (ex) {
    res.log.error({ userId: user?.id, deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error verifying Desktop App token');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const logout = createRoute(routeDefinition.logout.validators, async ({ user }, _, res) => {
  const { deviceId } = res.locals;
  try {
    if (!deviceId || !user) {
      throw new InvalidSession();
    }
    await webExtDb.deleteByUserIdAndDeviceId({ userId: user.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });
    res.log.info({ userId: user.id, deviceId }, 'User logged out of desktop app');

    sendJson(res, { success: true });
  } catch (ex) {
    res.log.error({ userId: user?.id, deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error logging out of desktop app');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const dataSyncPull = createRoute(routeDefinition.dataSyncPull.validators, async ({ user, query }, _, res) => {
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
  const deviceId = req.get(HTTP.HEADERS.X_EXT_DEVICE_ID)!;
  emitRecordSyncEventsToOtherClients(deviceId, syncEvent);

  sendJson(res, response);
});

const notifications = createRoute(routeDefinition.notifications.validators, async ({ query, user }, req, res) => {
  // TODO: reserved for future use (e.g. check if there is a critical update required, or auto-update is broken etc..)
  const { os, version } = query;
  const { deviceId } = res.locals;

  // TODO: potentially message user based on some conditions

  res.log.info({ userId: user?.id, deviceId, os, version }, '[DESKTOP NOTIFICATIONS] User requested notifications');

  const response: NotificationMessageV1Response = {
    success: true,
    severity: 'normal',
    title: null,
    action: null,
    actionUrl: null,
    message: null,
  };

  sendJson(res, response);
});

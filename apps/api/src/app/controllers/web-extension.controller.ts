import { ENV } from '@jetstream/api-config';
import { getCookieConfig, InvalidSession, MissingEntitlement } from '@jetstream/auth/server';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { UserProfileUi } from '@jetstream/types';
import { serialize } from 'cookie';
import { addDays, fromUnixTime, isAfter } from 'date-fns';
import { z } from 'zod';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import * as userSyncDbService from '../db/data-sync.db';
import * as userDbService from '../db/user.db';
import { checkUserEntitlement } from '../db/user.db';
import * as webExtDb from '../db/web-extension.db';
import * as webExtensionService from '../services/auth-web-extension.service';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute, getApiAddressFromReq } from '../utils/route.utils';

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

  // Allow browser to access id from cookie
  res.appendHeader(
    'Set-Cookie',
    serialize('WEB_EXTENSION_ID', ENV.WEB_EXTENSION_ID, {
      expires: addDays(new Date(), 365),
      path: '/web-extension',
      httpOnly: false,
      sameSite: 'strict',
      secure: false,
    })
  );

  next();
});

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

  const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id }).then(
    (user): UserProfileUi => ({
      id: user.id,
      userId: user.userId,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      picture: user.picture,
      preferences: { skipFrontdoorLogin: false },
      billingAccount: user.billingAccount,
      entitlements: {
        chromeExtension: true,
        recordSync: user.entitlements?.recordSync ?? false,
        googleDrive: user.entitlements?.googleDrive ?? false,
      },
      subscriptions: [],
    })
  );
  let storedRefreshToken = await webExtDb.findByUserIdAndDeviceId({ userId: user.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });

  // if token is expiring within 7 days, issue a new token
  if (!storedRefreshToken || isAfter(storedRefreshToken.expiresAt, addDays(new Date(), -webExtensionService.TOKEN_AUTO_REFRESH_DAYS))) {
    accessToken = await webExtensionService.issueAccessToken(userProfile);
    storedRefreshToken = await webExtDb.create(user.id, {
      type: 'AUTH_TOKEN',
      token: accessToken,
      deviceId,
      ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
      userAgent: req.get('User-Agent') || 'unknown',
      expiresAt: fromUnixTime(webExtensionService.decodeToken(accessToken).exp),
    });
  } else {
    accessToken = await webExtensionService.issueAccessToken(userProfile);
  }

  sendJson(res, { accessToken });
});

const verifyTokens = createRoute(routeDefinition.verifyTokens.validators, async ({ body }, req, res, next) => {
  try {
    const { accessToken, deviceId } = body;
    // This validates the token against the database record
    const { userProfile } = await webExtensionService.verifyToken({ token: accessToken, deviceId });
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
    const { userProfile } = await webExtensionService.verifyToken({ token: accessToken, deviceId });
    webExtDb.deleteByUserIdAndDeviceId({ userId: userProfile.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });
    res.log.info({ userId: userProfile.id, deviceId }, 'User logged out of chrome extension');

    sendJson(res, { success: true });
  } catch (ex) {
    res.log.error({ deviceId: body?.deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error logging out of chrome extension');
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
    data: { keys: response.records.map(({ key }) => key) },
    userId: user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  emitRecordSyncEventsToOtherClients(req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID)!, syncEvent);

  sendJson(res, response);
});

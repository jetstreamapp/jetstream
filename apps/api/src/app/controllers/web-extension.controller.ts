import { ENV } from '@jetstream/api-config';
import {
  createUserActivityFromReq,
  getApiAddressFromReq,
  getCookieConfig,
  InvalidSession,
  MissingEntitlement,
} from '@jetstream/auth/server';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { UserProfileUiSchema } from '@jetstream/types';
import { fromUnixTime } from 'date-fns';
import { z } from 'zod';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import * as userSyncDbService from '../db/data-sync.db';
import * as userDbService from '../db/user.db';
import { checkUserEntitlement } from '../db/user.db';
import * as webExtDb from '../db/web-extension.db';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import * as externalAuthService from '../services/external-auth.service';
import { decryptJwtTokenOrPlaintext } from '../services/jwt-token-encryption.service';
import { redirect, sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  initAuthMiddleware: {
    controllerFn: () => initAuthMiddleware,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
    } satisfies RouteValidator,
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
    } satisfies RouteValidator,
  },
  initSession: {
    controllerFn: () => initSession,
    responseType: z.object({ accessToken: z.string() }),
    validators: {
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  verifyToken: {
    controllerFn: () => verifyToken,
    responseType: z.discriminatedUnion('success', [
      z.object({
        success: z.literal(true),
        userProfile: UserProfileUiSchema,
        accessToken: z.string().optional(),
      }),
      z.object({
        success: z.literal(false),
        error: z.string().nullish(),
      }),
    ]),
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
    } satisfies RouteValidator,
  },
  dataSyncPull: {
    controllerFn: () => dataSyncPull,
    responseType: z.any(),
    validators: {
      ...dataSyncController.pull.validators,
    } satisfies RouteValidator,
  },
  dataSyncPush: {
    controllerFn: () => dataSyncPush,
    responseType: z.any(),
    validators: {
      ...dataSyncController.push.validators,
    } satisfies RouteValidator,
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
    setCookie(redirectUrlCookie.name, `${ENV.JETSTREAM_SERVER_URL}/web-extension/auth`, redirectUrlCookie.options);
    redirect(res, '/auth/login');
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

  if (!(await checkUserEntitlement({ userId: user.id, entitlement: 'chromeExtension' }))) {
    next(new MissingEntitlement());
    return;
  }

  const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id, omitSubscriptions: true });
  const existingTokenRecord = await webExtDb.findByUserIdAndDeviceId({
    userId: user.id,
    deviceId,
    type: webExtDb.TOKEN_TYPE_AUTH,
    expiresAtBufferDays: externalAuthService.TOKEN_AUTO_REFRESH_DAYS,
  });

  if (existingTokenRecord) {
    // Decrypt the stored token (token reuse)
    const decryptedToken = decryptJwtTokenOrPlaintext(existingTokenRecord.token);

    // Only reuse the stored token if it still verifies. A signing-secret rotation (or any change
    // that invalidates an old signature) can leave a non-expired token in the DB whose signature
    // no longer validates — /auth/verify would then reject it immediately, leaving the user stuck
    // in a login loop. When the stored token no longer verifies, fall through and issue a fresh one
    // (the issue path upserts, replacing the stale row) so login self-heals.
    const storedTokenIsValid = await externalAuthService
      .verifyToken({ token: decryptedToken, deviceId }, externalAuthService.AUDIENCE_WEB_EXT)
      .then(() => true)
      .catch((ex) => {
        res.log.warn(
          { userId: user.id, deviceId, ...getErrorMessageAndStackObj(ex) },
          'Stored web extension token failed verification; issuing a new token',
        );
        return false;
      });

    if (storedTokenIsValid) {
      const decoded = externalAuthService.decodeToken(decryptedToken);
      const expiresAt = fromUnixTime(decoded.exp);

      res.log.debug({ userId: user.id, deviceId, expiresAt }, 'Reusing existing web extension token');

      sendJson(res, { accessToken: decryptedToken });
      createUserActivityFromReq(req, res, {
        action: 'WEB_EXTENSION_LOGIN_TOKEN_REUSED',
        success: true,
      });
      return;
    }
  }

  // Issue new token if none exists or about to expire
  const accessToken = await externalAuthService.issueAccessToken(
    userProfile,
    externalAuthService.AUDIENCE_WEB_EXT,
    externalAuthService.TOKEN_EXPIRATION_SHORT,
  );
  await webExtDb.create(user.id, {
    type: webExtDb.TOKEN_TYPE_AUTH,
    source: webExtDb.TOKEN_SOURCE_BROWSER_EXTENSION,
    token: accessToken,
    deviceId,
    ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
    userAgent: req.get('User-Agent') || 'unknown',
    expiresAt: fromUnixTime(externalAuthService.decodeToken(accessToken).exp),
    provider: req.session.provider,
    providerAccountId: req.session.providerAccountId,
  });

  sendJson(res, { accessToken });

  createUserActivityFromReq(req, res, {
    action: 'WEB_EXTENSION_LOGIN_TOKEN_ISSUED',
    success: true,
  });
});

const verifyToken = createRoute(routeDefinition.verifyToken.validators, async ({ user }, req, res) => {
  const { deviceId } = res.locals;
  try {
    if (!user) {
      throw new InvalidSession();
    }
    const userProfile = await userDbService.findIdByUserIdUserFacing({ userId: user.id, omitSubscriptions: true });

    // Token rotation: if the client supports it, issue a new short-lived JWT and replace the old one.
    const supportsRotation = req.get(HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION) === '1';
    let rotatedAccessToken: string | undefined;
    if (supportsRotation && deviceId) {
      const oldAccessToken = req.get('Authorization')?.split(' ')[1];
      // Only rotate as the token approaches expiry. Rotating on every verify churns the shared
      // token across the user's devices (browser storage.sync), which can lose the rotation race
      // and force a premature logout. The auth middleware still fully validates the token on
      // every verify, so skipping rotation here does not weaken verification.
      if (oldAccessToken && externalAuthService.isTokenWithinRefreshWindow(oldAccessToken)) {
        const result = await externalAuthService.rotateToken({
          userProfile,
          audience: externalAuthService.AUDIENCE_WEB_EXT,
          source: webExtDb.TOKEN_SOURCE_BROWSER_EXTENSION,
          deviceId,
          oldAccessToken,
          ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
          userAgent: req.get('User-Agent') || 'unknown',
        });
        if (result.outcome === 'race-loss-none') {
          // Token was deleted from the DB between middleware auth and rotation (typically a
          // concurrent logout). Force a 401 so the client clears state and re-authenticates
          // rather than continuing to use a token that no longer exists server-side.
          throw new InvalidSession();
        }
        rotatedAccessToken = result.token;
        res.log.debug({ userId: userProfile.id, deviceId, rotationOutcome: result.outcome }, 'Web extension token verified');
      }
    }

    if (!supportsRotation) {
      res.log.debug({ userId: userProfile.id, deviceId }, 'Web extension token verified');
    }

    sendJson(res, { success: true, userProfile, accessToken: rotatedAccessToken });
  } catch (ex) {
    res.log.error({ userId: user?.id, deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error verifying web extension token');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const logout = createRoute(routeDefinition.logout.validators, async ({ user }, req, res) => {
  const { deviceId } = res.locals;
  try {
    if (!deviceId || !user) {
      throw new InvalidSession();
    }
    // This validates the token against the database record
    await webExtDb.deleteByUserIdAndDeviceId({ userId: user.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });
    // Invalidate the LRU cache so the token is rejected immediately rather than serving from cache
    // Check both Authorization header and body for legacy clients that send accessToken in the body
    const accessToken = req.get('Authorization')?.split(' ')[1] || (req.body as { accessToken?: string } | undefined)?.accessToken;
    if (accessToken) {
      externalAuthService.invalidateCacheEntry(accessToken, deviceId);
    }
    res.log.info({ userId: user.id, deviceId }, 'User logged out of browser extension');

    sendJson(res, { success: true });
  } catch (ex) {
    res.log.error({ userId: user?.id, deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error logging out of browser extension');
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
  const deviceId = req.get(HTTP.HEADERS.X_EXT_DEVICE_ID)! || req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID)!;
  emitRecordSyncEventsToOtherClients(deviceId, syncEvent);

  sendJson(res, response);
});

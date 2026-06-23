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
import { createHmac } from 'crypto';
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
import { createRoute, RouteValidator } from '../utils/route.utils';
import { routeDefinition as dataSyncController } from './data-sync.controller';

export const routeDefinition = {
  initAuthMiddleware: {
    controllerFn: () => initAuthMiddleware,
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
        encryptionKey: z.string(),
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
  notifications: {
    controllerFn: () => notifications,
    responseType: z.any(),
    validators: {
      query: z.object({ os: z.string(), version: z.string(), isPackaged: z.union([z.string(), z.boolean()]).optional().default(true) }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
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
    const desktopAuthUrl = `${ENV.JETSTREAM_SERVER_URL}/desktop-app/auth`;
    const desktopReturnUrl = queryParams ? `${desktopAuthUrl}?${queryParams}` : desktopAuthUrl;
    const { redirectUrl: redirectUrlCookie } = getCookieConfig(ENV.USE_SECURE_COOKIES);
    // Keep the cookie for OAuth/credentials flows that read it server-side. The query param is
    // needed specifically for SSO: SAML's cross-site POST back from the IdP drops SameSite=Lax
    // cookies, so the frontend must pass returnUrl forward to /api/auth/sso/start where it can
    // be threaded into SAML RelayState (and the OIDC returnUrl cookie).
    setCookie(redirectUrlCookie.name, desktopReturnUrl, redirectUrlCookie.options);
    redirect(res, `/auth/login?returnUrl=${encodeURIComponent(desktopReturnUrl)}`);
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

  // Check for existing valid token with refresh buffer (TOKEN_AUTO_REFRESH_DAYS)
  const existingTokenRecord = await webExtDb.findByUserIdAndDeviceId({
    userId: user.id,
    deviceId,
    type: webExtDb.TOKEN_TYPE_AUTH,
    expiresAtBufferDays: externalAuthService.TOKEN_AUTO_REFRESH_DAYS,
  });

  if (existingTokenRecord) {
    // Decrypt the stored token (supports both encrypted and legacy plaintext)
    const decryptedToken = decryptJwtTokenOrPlaintext(existingTokenRecord.token);

    // Only reuse the stored token if it still verifies. A signing-secret rotation (or any change
    // that invalidates an old signature) can leave a non-expired token in the DB whose signature
    // no longer validates — /auth/verify would then reject it immediately, leaving the user stuck
    // in a login loop with no way out short of clearing local app data. When the stored token no
    // longer verifies, fall through and issue a fresh one (the issue path upserts, replacing the
    // stale row) so login self-heals.
    const storedTokenIsValid = await externalAuthService
      .verifyToken({ token: decryptedToken, deviceId }, externalAuthService.AUDIENCE_DESKTOP)
      .then(() => true)
      .catch((ex) => {
        res.log.warn(
          { userId: user.id, deviceId, ...getErrorMessageAndStackObj(ex) },
          'Stored desktop token failed verification; issuing a new token',
        );
        return false;
      });

    if (storedTokenIsValid) {
      const decoded = externalAuthService.decodeToken(decryptedToken);
      const expiresAt = fromUnixTime(decoded.exp);

      res.log.debug({ userId: user.id, deviceId, expiresAt }, 'Reusing existing desktop token');

      sendJson(res, { accessToken: decryptedToken });
      createUserActivityFromReq(req, res, {
        action: 'DESKTOP_LOGIN_TOKEN_REUSED',
        success: true,
      });
      return;
    }
  }

  // Issue new token if none exists or about to expire
  const accessToken = await externalAuthService.issueAccessToken(
    userProfile,
    externalAuthService.AUDIENCE_DESKTOP,
    externalAuthService.TOKEN_EXPIRATION_SHORT,
  );
  await webExtDb.create(user.id, {
    type: webExtDb.TOKEN_TYPE_AUTH,
    source: webExtDb.TOKEN_SOURCE_DESKTOP,
    token: accessToken,
    deviceId,
    ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
    userAgent: req.get('User-Agent') || 'unknown',
    expiresAt: fromUnixTime(externalAuthService.decodeToken(accessToken).exp),
    provider: req.session.provider,
    providerAccountId: req.session.providerAccountId,
  });

  res.log.info({ userId: user.id, deviceId }, 'Issued new desktop token');

  sendJson(res, { accessToken });

  createUserActivityFromReq(req, res, {
    action: 'DESKTOP_LOGIN_TOKEN_ISSUED',
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

    // Derive a per-user portable encryption key for local org data encryption on the desktop app.
    // The key is the same on any machine the user logs into; org data never leaves the device.
    const encryptionKey = createHmac('sha256', ENV.DESKTOP_ORG_ENCRYPTION_SECRET).update(user.id).digest('hex');

    // Token rotation: if the client supports it, issue a new short-lived JWT and replace the old one.
    // This limits exposure from the JWT being stored in plain text on disk (VDI environments).
    const supportsRotation = req.get(HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION) === '1';
    let rotatedAccessToken: string | undefined;
    if (supportsRotation && deviceId) {
      const oldAccessToken = req.get('Authorization')?.split(' ')[1];
      // Only rotate as the token approaches expiry. Rotating on every verify churns the shared
      // token across the user's devices, which can lose the rotation race and force a premature
      // logout. The auth middleware still fully validates the token on every verify, so skipping
      // rotation here does not weaken verification.
      if (oldAccessToken && externalAuthService.isTokenWithinRefreshWindow(oldAccessToken)) {
        const result = await externalAuthService.rotateToken({
          userProfile,
          audience: externalAuthService.AUDIENCE_DESKTOP,
          source: webExtDb.TOKEN_SOURCE_DESKTOP,
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
        res.log.debug({ userId: userProfile.id, deviceId, rotationOutcome: result.outcome }, 'Desktop App token verified');
      }
    }

    if (!supportsRotation) {
      res.log.debug({ userId: userProfile.id, deviceId }, 'Desktop App token verified');
    }

    sendJson(res, { success: true, userProfile, encryptionKey, accessToken: rotatedAccessToken });
  } catch (ex) {
    res.log.error({ userId: user?.id, deviceId, ...getErrorMessageAndStackObj(ex) }, 'Error verifying Desktop App token');
    sendJson(res, { success: false, error: 'Invalid session' }, 401);
  }
});

const logout = createRoute(routeDefinition.logout.validators, async ({ user }, req, res) => {
  const { deviceId } = res.locals;
  try {
    if (!deviceId || !user) {
      throw new InvalidSession();
    }
    await webExtDb.deleteByUserIdAndDeviceId({ userId: user.id, deviceId, type: webExtDb.TOKEN_TYPE_AUTH });
    // Invalidate the LRU cache so the token is rejected immediately rather than serving from cache
    // Check both Authorization header and body for legacy clients that send accessToken in the body
    const accessToken = req.get('Authorization')?.split(' ')[1] || (req.body as { accessToken?: string } | undefined)?.accessToken;
    if (accessToken) {
      externalAuthService.invalidateCacheEntry(accessToken, deviceId);
    }
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

import { ENV, logger } from '@jetstream/api-config';
import { convertUserProfileToSession_External, InvalidAccessToken } from '@jetstream/auth/server';
import { TokenSource, UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, UserProfileUi } from '@jetstream/types';
import { randomUUID } from 'crypto';
import { fromUnixTime } from 'date-fns';
import * as express from 'express';
import jwt from 'fast-jwt';
import { LRUCache } from 'lru-cache';
import * as webExtDb from '../db/web-extension.db';
import { decryptJwtTokenOrPlaintext, hashToken } from '../services/jwt-token-encryption.service';
import { AuthenticationError } from '../utils/error-handler';

const cache = new LRUCache<string, JwtDecodedPayload>({ max: 500 });

export const AUDIENCE_WEB_EXT = 'https://getjetstream.app/web-extension';
export const AUDIENCE_DESKTOP = 'https://getjetstream.app/desktop-app';
const ISSUER = 'https://getjetstream.app';

export const TOKEN_AUTO_REFRESH_DAYS = 2;
const TOKEN_EXPIRATION = 60 * 60 * 24 * 90 * 1000; // 90 days
export const TOKEN_EXPIRATION_SHORT = 60 * 60 * 24 * 7 * 1000; // 7 days

export type Audience = typeof AUDIENCE_WEB_EXT | typeof AUDIENCE_DESKTOP;

export interface JwtDecodedPayload {
  userProfile: UserProfileUi;
  aud: typeof AUDIENCE_WEB_EXT | typeof AUDIENCE_DESKTOP;
  iss: typeof ISSUER;
  sub: string;
  iat: number;
  exp: number;
}

function prepareJwtFns(userId: string, durationMs: number, audience: string) {
  const jwtSigner = jwt.createSigner({
    key: async () => ENV.JETSTREAM_AUTH_WEB_EXT_JWT_SECRET,
    algorithm: 'HS256',
    expiresIn: durationMs,
    aud: audience,
    iss: ISSUER,
    sub: userId,
  });
  const jwtVerifier = jwt.createVerifier({
    key: async () => ENV.JETSTREAM_AUTH_WEB_EXT_JWT_SECRET,
    algorithms: ['HS256'],
    allowedAud: audience,
    allowedIss: ISSUER,
    allowedSub: userId,
  });
  return {
    jwtSigner,
    jwtVerifier,
  };
}

async function generateJwt({ payload, durationMs }: { payload: UserProfileUi; durationMs: number }, audience: Audience) {
  const { jwtSigner } = prepareJwtFns(payload.id, durationMs, audience);
  const token = await jwtSigner({ userProfile: payload, jti: randomUUID() });
  return token;
}

export async function issueAccessToken(payload: UserProfileUi, audience: Audience, durationMs?: number) {
  return await generateJwt({ payload, durationMs: durationMs ?? TOKEN_EXPIRATION }, audience);
}

export function invalidateCacheEntry(accessToken: string, deviceId: string): void {
  const cacheKey = `${accessToken}-${deviceId}`;
  cache.delete(cacheKey);
}

/**
 * Issue a new short-lived JWT, replace the old token in the DB, and invalidate the LRU cache.
 * Used by both desktop and web extension controllers during /auth/verify when the client
 * sends the X-Supports-Token-Rotation header.
 *
 * Uses a conditional update (checking the old tokenHash) to prevent a race where two
 * concurrent requests both rotate the same token. When the conditional update misses
 * (another request already rotated), the current token is fetched from the DB and
 * returned so every racer ends up with the same valid token — preventing stale-token
 * write-backs from clients that share storage (e.g. browser storage.sync).
 *
 * The race-loss return relies on getUserAndDeviceIdForExternalAuth bypassing the LRU
 * cache when the X-Supports-Token-Rotation header is present, which guarantees the
 * caller's oldAccessToken was the current DB token at the start of this request. Without
 * that guarantee a stale cached token from a different API instance could be exchanged
 * for the current one. The bypass is gated by a per-route opt-in passed to
 * getExternalAuthMiddleware so only verify routes honor the header.
 *
 * On a race-loss lookup, the current DB row's source is also validated against the
 * expected source for this audience. If a concurrent flow replaced the row with a
 * different-source token (e.g. desktop vs browser-extension sharing a deviceId), the
 * race-loser is treated as race-loss-none rather than handed a wrong-audience token.
 */
export type RotateTokenResult =
  | { token: string; outcome: 'rotated' }
  | { token: string; outcome: 'race-loss-current' }
  | { token: undefined; outcome: 'race-loss-none' };

export async function rotateToken({
  userProfile,
  audience,
  source,
  deviceId,
  oldAccessToken,
  ipAddress,
  userAgent,
  durationMs,
}: {
  userProfile: UserProfileUi;
  audience: Audience;
  source: TokenSource;
  deviceId: string;
  oldAccessToken: string;
  ipAddress: string;
  userAgent: string;
  durationMs?: number;
}): Promise<RotateTokenResult> {
  const newAccessToken = await issueAccessToken(userProfile, audience, durationMs ?? TOKEN_EXPIRATION_SHORT);
  const oldTokenHash = hashToken(oldAccessToken);
  const wasReplaced = await webExtDb.replaceTokenIfCurrent(userProfile.id, oldTokenHash, {
    type: webExtDb.TOKEN_TYPE_AUTH,
    source,
    token: newAccessToken,
    deviceId,
    ipAddress,
    userAgent,
    expiresAt: fromUnixTime(decodeToken(newAccessToken).exp),
  });
  // Always invalidate the old token from cache — whether we won or lost the race,
  // the old token hash is no longer current in the DB and should not be served from cache.
  invalidateCacheEntry(oldAccessToken, deviceId);
  if (!wasReplaced) {
    // Another concurrent request already rotated this token. Return the current DB token
    // so the loser ends up with the winner's token rather than holding a now-invalid one.
    // The caller already authorized as (userId, deviceId), so this does not widen access.
    const currentTokenRecord = await webExtDb.findByUserIdAndDeviceId({
      userId: userProfile.id,
      deviceId,
      type: webExtDb.TOKEN_TYPE_AUTH,
    });
    if (currentTokenRecord && currentTokenRecord.source === source) {
      logger.warn({ userId: userProfile.id, deviceId, audience }, 'rotateToken: race lost — returning current DB token to caller');
      return { token: decryptJwtTokenOrPlaintext(currentTokenRecord.token), outcome: 'race-loss-current' };
    }
    if (currentTokenRecord) {
      logger.warn(
        { userId: userProfile.id, deviceId, audience, expectedSource: source, foundSource: currentTokenRecord.source },
        'rotateToken: race lost and current DB token has mismatched source — treating as race-loss-none',
      );
    } else {
      logger.warn({ userId: userProfile.id, deviceId, audience }, 'rotateToken: race lost and no current token found');
    }
    return { token: undefined, outcome: 'race-loss-none' };
  }
  return { token: newAccessToken, outcome: 'rotated' };
}

export function decodeToken(token: string): JwtDecodedPayload {
  const decoder = jwt.createDecoder();
  return decoder(token) as JwtDecodedPayload;
}

export async function verifyToken(
  { token, deviceId }: { token: string; deviceId: string },
  audience: Audience,
): Promise<JwtDecodedPayload> {
  const decoder = jwt.createDecoder();
  const decodedPayload = decoder(token) as JwtDecodedPayload;

  const userAccessToken = await webExtDb.findByAccessTokenAndDeviceId({ deviceId, token, type: webExtDb.TOKEN_TYPE_AUTH });
  const entitlements = userAccessToken?.user?.teamMembership?.team?.entitlements || userAccessToken?.user?.entitlements;
  if (!userAccessToken) {
    throw new InvalidAccessToken('Access token is invalid for device');
  } else if (userAccessToken.user.teamMembership && userAccessToken.user.teamMembership.status !== 'ACTIVE') {
    throw new InvalidAccessToken('User is not active');
  } else if (decodedPayload?.userProfile?.id !== userAccessToken.userId) {
    throw new InvalidAccessToken('Access token is invalid for user');
  } else if (audience === AUDIENCE_WEB_EXT && !entitlements?.chromeExtension) {
    throw new InvalidAccessToken('Browser extension is not enabled');
  } else if (audience === AUDIENCE_DESKTOP && !entitlements?.desktop) {
    throw new InvalidAccessToken('Desktop application is not enabled');
  }

  const { jwtVerifier } = prepareJwtFns(userAccessToken.userId, TOKEN_EXPIRATION, audience);
  return (await jwtVerifier(token)) as JwtDecodedPayload;
}

export interface ExternalAuthMiddlewareOptions {
  /**
   * When true, the middleware honors the X-Supports-Token-Rotation client header and
   * bypasses the LRU cache for that request. Should only be set for routes that actually
   * perform token rotation (i.e. /auth/verify) so other routes cannot disable the cache
   * by setting the header.
   */
  supportsTokenRotation?: boolean;
}

export async function getUserAndDeviceIdForExternalAuth(
  audience: Audience,
  req: express.Request<unknown, unknown, unknown, unknown>,
  res: express.Response,
  options?: ExternalAuthMiddlewareOptions,
) {
  const deviceId = getDeviceId(req, res);
  try {
    // Some prior endpoints may have accessToken in the body instead of Authorization header
    const accessToken = req.get('Authorization')?.split(' ')[1] || (req.body as Maybe<{ accessToken?: string }>)?.accessToken;
    // Rotation-supporting clients send this header on /auth/verify. Bypass the LRU for those
    // requests so the token is always validated against the current DB record — required so
    // rotateToken's race-loss return cannot exchange a stale cached token for the current one
    // when cache invalidations have not propagated across API instances. Gated by the
    // per-route supportsTokenRotation option so non-verify routes cannot opt into the bypass.
    const skipCache = options?.supportsTokenRotation === true && req.get(HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION) === '1';

    let user: UserProfileSession | null = null;
    if (accessToken && deviceId) {
      const cacheKey = `${accessToken}-${deviceId}`;
      const userFromCache = skipCache ? undefined : cache.get(cacheKey);
      if (!userFromCache || userFromCache.exp < Date.now() / 1000) {
        try {
          const decodedJwtToken = await verifyToken({ token: accessToken, deviceId }, audience);
          user = convertUserProfileToSession_External(decodedJwtToken.userProfile);
          // Don't populate the cache for rotation requests — rotateToken will invalidate it
          // immediately after this call, so the write+delete is wasted work and churns the LRU.
          if (!skipCache) {
            cache.set(cacheKey, decodedJwtToken);
          }
        } catch (ex) {
          // If a skipCache request fails server-side validation, evict any stale cache entry
          // for this token so a subsequent non-rotation request on this instance cannot
          // authorize against the now-invalid token via the LRU.
          if (skipCache) {
            cache.delete(cacheKey);
          }
          throw ex;
        }
      } else {
        user = convertUserProfileToSession_External(userFromCache.userProfile);
      }
    }
    return { user, deviceId };
  } catch (ex) {
    res.log.warn({ audience, deviceId, ...getErrorMessageAndStackObj(ex) }, '[EXTERNAL-AUTH][AUTH ERROR] Error decoding token');
    return { user: null, deviceId };
  }
}

export function getDeviceId(req: express.Request<unknown, unknown, unknown, unknown>, res: express.Response) {
  try {
    const deviceId =
      res.locals.deviceId ||
      req.get(HTTP.HEADERS.X_EXT_DEVICE_ID) ||
      req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID) ||
      (req.body as Maybe<{ deviceId?: string }>)?.deviceId ||
      (req.query as Maybe<{ deviceId?: string }>)?.deviceId;
    return deviceId as Maybe<string>;
  } catch {
    return null;
  }
}

export function addDeviceIdToLocals(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.deviceId = getDeviceId(req, res);
  next();
}

export function getExternalAuthMiddleware(audience: Audience, options?: ExternalAuthMiddlewareOptions) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { deviceId, user } = await getUserAndDeviceIdForExternalAuth(audience, req, res, options);
      if (!user) {
        throw new AuthenticationError('Unauthorized', { skipLogout: true });
      }
      req.externalAuth = {
        deviceId,
        user,
      };
      res.locals.deviceId = deviceId;
      next();
    } catch (ex) {
      res.log.warn(
        { audience, deviceId: getDeviceId(req, res), ...getErrorMessageAndStackObj(ex) },
        '[EXTERNAL AUTH ERROR] Error decoding token',
      );
      next(new AuthenticationError('Unauthorized', { skipLogout: true }));
    }
  };
}

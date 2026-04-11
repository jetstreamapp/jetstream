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
import { hashToken } from '../services/jwt-token-encryption.service';
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
 * concurrent requests both rotate the same token — the second attempt returns undefined
 * instead of silently overwriting the first rotation's token.
 */
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
}): Promise<string | undefined> {
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
    // Another concurrent request already rotated this token — skip to avoid invalidating the winner's token.
    // Note: if the rotation response is lost (network failure), the client will hold a stale token and must re-login.
    // This is an accepted trade-off to avoid the complexity of dual-token grace periods.
    logger.warn({ userId: userProfile.id, deviceId, audience }, 'rotateToken: race lost — token already rotated by another request');
    return undefined;
  }
  return newAccessToken;
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

export async function getUserAndDeviceIdForExternalAuth(
  audience: Audience,
  req: express.Request<unknown, unknown, unknown, unknown>,
  res: express.Response,
) {
  const deviceId = getDeviceId(req, res);
  try {
    // Some prior endpoints may have accessToken in the body instead of Authorization header
    const accessToken = req.get('Authorization')?.split(' ')[1] || (req.body as Maybe<{ accessToken?: string }>)?.accessToken;

    let user: UserProfileSession | null = null;
    if (accessToken && deviceId) {
      const cacheKey = `${accessToken}-${deviceId}`;
      const userFromCache = cache.get(cacheKey);
      if (!userFromCache || userFromCache.exp < Date.now() / 1000) {
        const decodedJwtToken = await verifyToken({ token: accessToken, deviceId }, audience);
        user = convertUserProfileToSession_External(decodedJwtToken.userProfile);
        cache.set(cacheKey, decodedJwtToken);
      } else {
        user = convertUserProfileToSession_External(userFromCache.userProfile);
      }
    }
    return { user, deviceId };
  } catch (ex) {
    req.log.info({ audience, deviceId, ...getErrorMessageAndStackObj(ex) }, '[EXTERNAL-AUTH][AUTH ERROR] Error decoding token');
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

export function getExternalAuthMiddleware(audience: Audience) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { deviceId, user } = await getUserAndDeviceIdForExternalAuth(audience, req, res);
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
      req.log.info('[EXTERNAL AUTH ERROR] Error decoding token', ex);
      next(new AuthenticationError('Unauthorized', { skipLogout: true }));
    }
  };
}

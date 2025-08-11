import { ENV } from '@jetstream/api-config';
import { convertUserProfileToSession, InvalidAccessToken } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, UserProfileUi } from '@jetstream/types';
import * as express from 'express';
import jwt from 'fast-jwt';
import { LRUCache } from 'lru-cache';
import * as webExtDb from '../db/web-extension.db';
import { AuthenticationError } from '../utils/error-handler';

const cache = new LRUCache<string, JwtDecodedPayload>({ max: 500 });

export const AUDIENCE_WEB_EXT = 'https://getjetstream.app/web-extension';
export const AUDIENCE_DESKTOP = 'https://getjetstream.app/desktop-app';
const ISSUER = 'https://getjetstream.app';

export const TOKEN_AUTO_REFRESH_DAYS = 7;
const TOKEN_EXPIRATION = 60 * 60 * 24 * 90 * 1000; // 90 days

export type Audience = typeof AUDIENCE_WEB_EXT | typeof AUDIENCE_DESKTOP;

export interface JwtDecodedPayload {
  userProfile: UserProfileUi;
  aud: typeof AUDIENCE_WEB_EXT | typeof AUDIENCE_DESKTOP;
  iss: typeof ISSUER;
  sub: string;
  iat: number;
  exp: number;
}

function prepareJwtFns(userId: string, durationMs, audience) {
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
  const token = await jwtSigner({ userProfile: payload });
  return token;
}

export async function issueAccessToken(payload: UserProfileUi, audience: Audience) {
  return await generateJwt({ payload, durationMs: TOKEN_EXPIRATION }, audience);
}

export function decodeToken(token: string): JwtDecodedPayload {
  const decoder = jwt.createDecoder();
  return decoder(token) as JwtDecodedPayload;
}

export async function verifyToken(
  { token, deviceId }: { token: string; deviceId: string },
  audience: Audience
): Promise<JwtDecodedPayload> {
  const decoder = jwt.createDecoder();
  const decodedPayload = decoder(token) as JwtDecodedPayload;

  const userAccessToken = await webExtDb.findByAccessTokenAndDeviceId({ deviceId, token, type: webExtDb.TOKEN_TYPE_AUTH });
  if (!userAccessToken) {
    throw new InvalidAccessToken('Access token is invalid for device');
  } else if (decodedPayload?.userProfile?.id !== userAccessToken.userId) {
    throw new InvalidAccessToken('Access token is invalid for user');
  } else if (audience === AUDIENCE_WEB_EXT && !userAccessToken.user.entitlements?.chromeExtension) {
    throw new InvalidAccessToken('Browser extension is not enabled');
  } else if (audience === AUDIENCE_DESKTOP && !userAccessToken.user.entitlements?.desktop) {
    throw new InvalidAccessToken('Desktop application is not enabled');
  }

  const { jwtVerifier } = prepareJwtFns(userAccessToken.userId, TOKEN_EXPIRATION, audience);
  return (await jwtVerifier(token)) as JwtDecodedPayload;
}

export async function getUserAndDeviceIdForExternalAuth(audience: Audience, req: express.Request<unknown, unknown, unknown, unknown>) {
  let deviceId: Maybe<string> = null;
  try {
    const accessToken = req.get('Authorization')?.split(' ')[1];
    deviceId = req.get(HTTP.HEADERS.X_EXT_DEVICE_ID) || req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID);
    let user: UserProfileSession | null = null;
    if (accessToken && deviceId) {
      const cacheKey = `${accessToken}-${deviceId}`;
      const userFromCache = cache.get(cacheKey);
      if (!userFromCache || userFromCache.exp < Date.now() / 1000) {
        const decodedJwtToken = await verifyToken({ token: accessToken, deviceId }, audience);
        user = convertUserProfileToSession(decodedJwtToken.userProfile);
        cache.set(cacheKey, decodedJwtToken);
      } else {
        user = convertUserProfileToSession(userFromCache.userProfile);
      }
    }
    return { user, deviceId };
  } catch (ex) {
    req.log.info({ audience, deviceId, ...getErrorMessageAndStackObj(ex) }, '[EXTERNAL-AUTH][AUTH ERROR] Error decoding token');
    return { user: null, deviceId };
  }
}

export function getExternalAuthMiddleware(audience: Audience) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { deviceId, user } = await getUserAndDeviceIdForExternalAuth(audience, req);
      if (!user) {
        throw new AuthenticationError('Unauthorized', { skipLogout: true });
      }
      req.externalAuth = {
        deviceId,
        user,
      };
      next();
    } catch (ex) {
      req.log.info('[DESKTOP-AUTH][AUTH ERROR] Error decoding token', ex);
      next(new AuthenticationError('Unauthorized', { skipLogout: true }));
    }
  };
}

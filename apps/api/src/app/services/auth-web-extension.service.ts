import { ENV } from '@jetstream/api-config';
import { InvalidAccessToken } from '@jetstream/auth/server';
import { UserProfileUi } from '@jetstream/types';
import jwt from 'fast-jwt';
import * as webExtDb from '../db/web-extension.db';

const AUDIENCE = 'https://getjetstream.app/web-extension';
const ISSUER = 'https://getjetstream.app';

export const TOKEN_AUTO_REFRESH_DAYS = 7;
const TOKEN_EXPIRATION = 60 * 60 * 24 * 90 * 1000; // 90 days

export interface JwtDecodedPayload {
  userProfile: UserProfileUi;
  aud: typeof AUDIENCE;
  iss: typeof ISSUER;
  sub: string;
  iat: number;
  exp: number;
}

function prepareJwtFns(userId: string, durationMs: number = TOKEN_EXPIRATION) {
  const jwtSigner = jwt.createSigner({
    key: async () => ENV.JETSTREAM_AUTH_WEB_EXT_JWT_SECRET,
    algorithm: 'HS256',
    expiresIn: durationMs,
    aud: AUDIENCE,
    iss: ISSUER,
    sub: userId,
  });
  const jwtVerifier = jwt.createVerifier({
    key: async () => ENV.JETSTREAM_AUTH_WEB_EXT_JWT_SECRET,
    algorithms: ['HS256'],
    allowedAud: AUDIENCE,
    allowedIss: ISSUER,
    allowedSub: userId,
  });
  return {
    jwtSigner,
    jwtVerifier,
  };
}

async function generateJwt({ payload, durationMs }: { payload: UserProfileUi; durationMs: number }) {
  const { jwtSigner } = prepareJwtFns(payload.id, durationMs);
  const token = await jwtSigner({ userProfile: payload });
  return token;
}

export async function issueAccessToken(payload: UserProfileUi) {
  return await generateJwt({ payload, durationMs: TOKEN_EXPIRATION });
}

export function decodeToken(token: string): JwtDecodedPayload {
  const decoder = jwt.createDecoder();
  return decoder(token) as JwtDecodedPayload;
}

export async function verifyToken({ token, deviceId }: { token: string; deviceId: string }): Promise<JwtDecodedPayload> {
  const decoder = jwt.createDecoder();
  const decodedPayload = decoder(token) as JwtDecodedPayload;

  const userAccessToken = await webExtDb.findByAccessTokenAndDeviceId({ deviceId, token, type: webExtDb.TOKEN_TYPE_AUTH });
  if (!userAccessToken) {
    throw new InvalidAccessToken('Access token is invalid for device');
  } else if (decodedPayload?.userProfile?.id !== userAccessToken.userId) {
    throw new InvalidAccessToken('Access token is invalid for user');
  } else if (!userAccessToken.user.entitlements?.chromeExtension) {
    throw new InvalidAccessToken('Browser extension is not enabled');
  }

  const { jwtVerifier } = prepareJwtFns(userAccessToken.userId, TOKEN_EXPIRATION);
  return (await jwtVerifier(token)) as JwtDecodedPayload;
}

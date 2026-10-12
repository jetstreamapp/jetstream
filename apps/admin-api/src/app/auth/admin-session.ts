import { AdminSessionUser } from '@jetstream/admin/types';
import type { CookieOptions, Request, Response } from 'express';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { hkdfSync } from 'node:crypto';
import { z } from 'zod';
import { ADMIN_ENV } from '../config/admin-env.config';

const TOKEN_ISSUER = 'jetstream-admin';
const SESSION_AUDIENCE = 'jetstream-admin:session';
const OAUTH_STATE_AUDIENCE = 'jetstream-admin:oauth-state';
const OAUTH_STATE_TTL_MINUTES = 10;

/** `__Host-` makes the browser reject the cookie unless it is Secure, host-only and scoped to `/` */
const cookiePrefix = ADMIN_ENV.useSecureCookies ? '__Host-' : '';
export const SESSION_COOKIE_NAME = `${cookiePrefix}jetstream-admin-session`;
export const OAUTH_STATE_COOKIE_NAME = `${cookiePrefix}jetstream-admin-oauth`;

/**
 * Sessions are stateless: the cookie is an encrypted JWT (A256GCM), so its contents can be neither
 * read nor forged without the secret. The allowlist is re-checked on every request, which makes
 * removing an email the way to cut someone off; rotating ADMIN_SESSION_SECRET signs everyone out.
 */
const encryptionKey = new Uint8Array(hkdfSync('sha256', ADMIN_ENV.ADMIN_SESSION_SECRET, TOKEN_ISSUER, 'cookie-encryption', 32));

const SessionPayloadSchema = z.object({
  email: z.string(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
});

const OauthStatePayloadSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  returnTo: z.string(),
});
export type OauthStatePayload = z.infer<typeof OauthStatePayloadSchema>;

function encryptToken(payload: Record<string, unknown>, audience: string, expiresIn: string) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .encrypt(encryptionKey);
}

async function decryptToken<T>(token: string | undefined, audience: string, schema: z.ZodType<T>): Promise<T | null> {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey, { issuer: TOKEN_ISSUER, audience });
    const result = schema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function getCookieOptions(sameSite: CookieOptions['sameSite'], maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: ADMIN_ENV.useSecureCookies,
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * SameSite=Strict is safe here because the SPA document itself needs no cookie: only its same-origin
 * `fetch` calls do, and those always carry Strict cookies.
 */
export async function setSessionCookie(res: Response, user: AdminSessionUser) {
  const token = await encryptToken({ ...user }, SESSION_AUDIENCE, `${ADMIN_ENV.ADMIN_SESSION_HOURS}h`);
  res.cookie(SESSION_COOKIE_NAME, token, getCookieOptions('strict', ADMIN_ENV.ADMIN_SESSION_HOURS * 60 * 60 * 1000));
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions('strict', 0));
}

export function readSessionCookie(req: Request): Promise<AdminSessionUser | null> {
  return decryptToken(req.cookies?.[SESSION_COOKIE_NAME], SESSION_AUDIENCE, SessionPayloadSchema);
}

/** Lax, not Strict: the cookie has to survive the top-level redirect back from Google */
export async function setOauthStateCookie(res: Response, payload: OauthStatePayload) {
  const token = await encryptToken({ ...payload }, OAUTH_STATE_AUDIENCE, `${OAUTH_STATE_TTL_MINUTES}m`);
  res.cookie(OAUTH_STATE_COOKIE_NAME, token, getCookieOptions('lax', OAUTH_STATE_TTL_MINUTES * 60 * 1000));
}

export function clearOauthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, getCookieOptions('lax', 0));
}

export function readOauthStateCookie(req: Request): Promise<OauthStatePayload | null> {
  return decryptToken(req.cookies?.[OAUTH_STATE_COOKIE_NAME], OAUTH_STATE_AUDIENCE, OauthStatePayloadSchema);
}

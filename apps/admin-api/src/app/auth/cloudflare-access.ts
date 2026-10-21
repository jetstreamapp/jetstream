import { getLogger } from '@jetstream/api-config';
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ADMIN_ENV } from '../config/admin-env.config';

const CF_ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

/**
 * When Cloudflare Access is configured, every request must carry the JWT Access adds after its own
 * login. Without this check, the service's direct Render URL would skip Access entirely.
 * Returns null when Access is not configured, leaving Google sign-in as the only gate.
 */
export function createCloudflareAccessMiddleware() {
  if (!ADMIN_ENV.cloudflareAccessEnabled) {
    return null;
  }
  const issuer = `https://${ADMIN_ENV.ADMIN_CF_ACCESS_TEAM_DOMAIN}`;
  const audience = ADMIN_ENV.ADMIN_CF_ACCESS_AUD as string;
  const keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.get(CF_ACCESS_JWT_HEADER);
    if (!token) {
      res.status(403).json({ error: true, message: 'Forbidden' });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, keySet, { issuer, audience });
      res.locals.cloudflareAccessEmail = typeof payload.email === 'string' ? payload.email : null;
      next();
    } catch (ex) {
      getLogger().warn({ err: ex }, '[ADMIN][CF_ACCESS] Rejected request with an invalid Access token');
      res.status(403).json({ error: true, message: 'Forbidden' });
    }
  };
}

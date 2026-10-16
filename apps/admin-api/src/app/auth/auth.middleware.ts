import { ADMIN_REQUEST_HEADER } from '@jetstream/admin/types';
import { enrichRequestContext, getLogger } from '@jetstream/api-config';
import type { NextFunction, Request, Response } from 'express';
import { ADMIN_ENV } from '../config/admin-env.config';
import { isAccessIdentityMatch } from './admin-access';
import { clearSessionCookie, readSessionCookie } from './admin-session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Every request re-checks the allowlist and, when Cloudflare Access is in front, that the cookie was
 * issued to the same person Access let through. Either failure clears the cookie, since it can never
 * become valid again on its own.
 */
export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await readSessionCookie(req);
    if (!user) {
      res.status(401).json({ error: true, message: 'Unauthorized' });
      return;
    }
    const { cloudflareAccessEmail } = res.locals;
    if (!ADMIN_ENV.allowedEmails.has(user.email)) {
      clearSessionCookie(res);
      res.status(401).json({ error: true, message: 'Unauthorized' });
      return;
    }
    if (ADMIN_ENV.cloudflareAccessEnabled && !isAccessIdentityMatch(user.email, cloudflareAccessEmail)) {
      getLogger().warn(
        { adminEmail: user.email, cloudflareAccessEmail, ipAddress: req.ip },
        '[ADMIN][AUTH] Session rejected: the cookie belongs to a different identity than the Cloudflare Access session',
      );
      clearSessionCookie(res);
      res.status(401).json({ error: true, message: 'Unauthorized' });
      return;
    }
    res.locals.admin = user;
    enrichRequestContext({ adminEmail: user.email, cloudflareAccessEmail });
    next();
  } catch (ex) {
    next(ex);
  }
}

/**
 * CSRF protection for state-changing requests. The session cookie is SameSite=Strict; on top of that
 * the request must carry the custom header (which a cross-site page cannot send without a CORS
 * preflight we never approve) and, when the browser reports one, our own Origin.
 */
export function requireAdminRequestHeader(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  if (req.get(ADMIN_REQUEST_HEADER) !== '1' || (origin && origin !== ADMIN_ENV.ADMIN_BASE_URL)) {
    res.status(403).json({ error: true, message: 'Forbidden' });
    return;
  }
  next();
}

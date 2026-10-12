import { ADMIN_REQUEST_HEADER } from '@jetstream/admin/types';
import { enrichRequestContext } from '@jetstream/api-config';
import type { NextFunction, Request, Response } from 'express';
import { ADMIN_ENV } from '../config/admin-env.config';
import { clearSessionCookie, readSessionCookie } from './admin-session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await readSessionCookie(req);
    if (!user || !ADMIN_ENV.allowedEmails.has(user.email)) {
      if (user) {
        clearSessionCookie(res);
      }
      res.status(401).json({ error: true, message: 'Unauthorized' });
      return;
    }
    res.locals.admin = user;
    enrichRequestContext({ adminEmail: user.email, cloudflareAccessEmail: res.locals.cloudflareAccessEmail });
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

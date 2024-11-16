import { logger, prisma } from '@jetstream/api-config';
import type { Request, Response } from 'express';
import { AuthError } from './auth.errors';

export type Action =
  | 'LOGIN'
  | 'PASSWORD_SET'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETION'
  | 'OAUTH_INIT'
  | 'LINK_IDENTITY_INIT'
  | 'LINK_IDENTITY'
  | 'UNLINK_IDENTITY'
  | 'EMAIL_VERIFICATION'
  | '2FA_VERIFICATION'
  | '2FA_RESEND_VERIFICATION'
  | '2FA_SETUP'
  | '2FA_REMOVAL'
  | '2FA_ACTIVATE'
  | '2FA_DEACTIVATE'
  | 'REVOKE_SESSION'
  | 'DELETE_ACCOUNT';

interface LoginActivity {
  action: Action;
  method?: string;
  success: boolean;
  email?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  requestId?: string;
}

export async function createUserActivityFromReq(
  req: Request<unknown, unknown, unknown, unknown>,
  res: Response<unknown>,
  data: LoginActivity
) {
  try {
    const ipAddress =
      res.locals.ipAddress || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.get('user-agent');
    const userId = data.userId || (req as any).session?.user?.id;
    const email = data.email || (req as any).session?.user?.email;
    const requestId = data.requestId || res.locals?.['requestId'];

    createUserActivity({ ...data, userId, email, ipAddress, userAgent, requestId }).catch((ex) =>
      logger.error('Error creating login activity', ex)
    );
  } catch (ex) {
    logger.error('Error creating login activity', ex);
  }
}

export async function createUserActivityFromReqWithError(
  req: Request<unknown, unknown, unknown, unknown>,
  res: Response<unknown>,
  ex: unknown,
  data: LoginActivity
) {
  try {
    data.success = false;
    if (ex instanceof AuthError) {
      data.errorMessage = `${ex.type}: ${ex.message}`;
    } else if (ex instanceof Error) {
      data.errorMessage = ex.message;
    }
    createUserActivityFromReq(req, res, data);
  } catch (ex) {
    logger.error('Error creating login activity', ex);
  }
}

export async function createUserActivity(data: LoginActivity) {
  try {
    data.success = data.success ?? false;
    prisma.loginActivity
      .create({
        data,
        select: { id: true },
      })
      .catch((ex) => logger.error('Error creating login activity', ex));
  } catch (ex) {
    logger.error('Error creating login activity', ex);
  }
}

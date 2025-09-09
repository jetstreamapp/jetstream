import { logger, prisma } from '@jetstream/api-config';
import { Maybe } from '@jetstream/types';
import type { Request, Response } from 'express';
import { AuthError } from './auth.errors';

export type Action =
  | 'LOGIN'
  | 'PASSWORD_SET'
  | 'PASSWORD_REMOVE'
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

export const actionDisplayName: Record<Action, string> = {
  LOGIN: 'Login Attempt',
  PASSWORD_SET: 'Password Set',
  PASSWORD_REMOVE: 'Password Removed',
  PASSWORD_RESET_REQUEST: 'Password Reset Request',
  PASSWORD_RESET_COMPLETION: 'Password Reset Completion',
  OAUTH_INIT: 'OAuth Login Initialization',
  LINK_IDENTITY_INIT: 'Link Identity Initialization',
  LINK_IDENTITY: 'Link Identity Completion',
  UNLINK_IDENTITY: 'Unlink Identity',
  EMAIL_VERIFICATION: 'Email Verification',
  '2FA_VERIFICATION': '2FA Verification',
  '2FA_RESEND_VERIFICATION': '2FA Resend Verification',
  '2FA_SETUP': '2FA Setup',
  '2FA_REMOVAL': '2FA Removal',
  '2FA_ACTIVATE': '2FA Activate',
  '2FA_DEACTIVATE': '2FA Deactivate',
  REVOKE_SESSION: 'Revoke Session',
  DELETE_ACCOUNT: 'Delete Account',
};

export const methodDisplayName: Record<string, string> = {
  CREDENTIALS: 'Username/Password',
  GOOGLE: 'Google',
  SALESFORCE: 'Salesforce',
};

interface LoginActivity {
  action: Action;
  method?: Maybe<string>;
  success: boolean;
  email?: Maybe<string>;
  userId?: Maybe<string>;
  ipAddress?: Maybe<string>;
  userAgent?: Maybe<string>;
  errorMessage?: Maybe<string>;
  requestId?: Maybe<string>;
}

export async function createUserActivityFromReq(
  req: Request<unknown, unknown, unknown, unknown>,
  res: Response<unknown>,
  data: LoginActivity,
) {
  try {
    const ipAddress =
      res.locals.ipAddress || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.get('user-agent');
    const userId = data.userId || (req as any).session?.user?.id;
    const email = data.email || (req as any).session?.user?.email;
    const requestId = data.requestId || res.locals?.['requestId'];

    createUserActivity({ ...data, userId, email, ipAddress, userAgent, requestId }).catch((ex) =>
      logger.error('Error creating login activity', ex),
    );
  } catch (ex) {
    logger.error('Error creating login activity', ex);
  }
}

export async function createUserActivityFromReqWithError(
  req: Request<unknown, unknown, unknown, unknown>,
  res: Response<unknown>,
  ex: unknown,
  data: LoginActivity,
) {
  try {
    data.success = false;
    if (ex instanceof AuthError) {
      data.errorMessage = `${ex.type}: ${ex.message}`;
      data.userId = data.userId || ex.userId;
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

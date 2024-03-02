/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, getExceptionLog } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { NextFunction } from 'express';
import { isString } from 'lodash';
import * as passport from 'passport';
import { URL } from 'url';
import { hardDeleteUserAndOrgs } from '../db/transactions.db';
import { createOrUpdateUser } from '../db/user.db';
import { checkAuth } from '../routes/route.middleware';
import { linkIdentity } from '../services/auth0';
import { Request, Response } from '../types/types';
import { AuthenticationError } from '../utils/error-handler';
// import { sendWelcomeEmail } from '../services/worker-jobs';

export interface OauthLinkParams {
  type: 'auth' | 'salesforce';
  error?: string;
  message?: string;
  clientUrl: string;
  data?: string;
}

export async function login(req: Request, res: Response) {
  // if user used a local login session, then we should be authenticated and can redirect to app
  if (req.user && req.hostname === 'localhost') {
    checkAuth(req, res, (err) => {
      if (err) {
        res.redirect('/');
      } else {
        const user = req.user as UserProfileServer;
        req.logIn(user, async (err) => {
          if (err) {
            req.log.warn({ ...getExceptionLog(err) }, '[AUTH][ERROR] Error logging in %o', err);
            return res.redirect('/');
          }

          createOrUpdateUser(user)
            .then(async ({ user: _user }) => {
              req.log.info('[AUTH][SUCCESS] Logged in %s', _user.email);
              res.redirect(ENV.JETSTREAM_CLIENT_URL!);
            })
            .catch((err) => {
              req.log.error({ ...getExceptionLog(err) }, '[AUTH][DB][ERROR] Error creating or sending welcome email %o', err);
              res.redirect('/');
            });
        });
      }
    });
  } else {
    res.redirect('/');
  }
}

export async function callback(req: Request, res: Response, next: NextFunction) {
  passport.authenticate(
    'auth0',
    {
      failureRedirect: '/',
    },
    (err, user, info) => {
      if (err) {
        req.log.warn({ ...getExceptionLog(err) }, '[AUTH][ERROR] Error with authentication %o', err);
        return next(new AuthenticationError(err));
      }
      if (!user) {
        req.log.warn('[AUTH][ERROR] no user');
        req.log.warn('[AUTH][ERROR] no info %o', info);
        return res.redirect('/oauth/login');
      }
      req.logIn(user, async (err) => {
        if (err) {
          req.log.warn('[AUTH][ERROR] Error logging in %o', err);
          return next(new AuthenticationError(err));
        }

        createOrUpdateUser(user).catch((err) => {
          req.log.error({ ...getExceptionLog(err) }, '[AUTH][DB][ERROR] Error creating or sending welcome email %o', err);
        });

        // TODO: confirm returnTo 0 it suddenly was reported as bad
        const returnTo = (req.session as any).returnTo;
        delete (req.session as any).returnTo;
        req.log.info('[AUTH][SUCCESS] Logged in %s', user.email);
        res.redirect(returnTo || ENV.JETSTREAM_CLIENT_URL);
      });
    }
  )(req, res, next);
}

export async function logout(req: Request, res: Response) {
  req.logout(() => {
    console.log('Logged out');
  });

  const logoutURL = new URL(`https://${ENV.AUTH0_DOMAIN}/v2/logout`);

  logoutURL.search = new URLSearchParams({
    client_id: ENV.AUTH0_CLIENT_ID!,
    returnTo: ENV.JETSTREAM_SERVER_URL!,
  }).toString();

  res.redirect(logoutURL.toString());
}

/** Callback for linking accounts */
export async function linkCallback(req: Request, res: Response, next: NextFunction) {
  passport.authorize(
    'auth0-authz',
    {
      failureRedirect: `/oauth-link/?error=${new URLSearchParams({ error: 'Unknown Error' as any }).toString()}`,
    } as any,
    async (err, userProfile, info) => {
      const params: OauthLinkParams = {
        type: 'auth',
        clientUrl: new URL(ENV.JETSTREAM_CLIENT_URL!).origin,
      };
      if (err) {
        req.log.warn({ ...getExceptionLog(err) }, '[AUTH][LINK][ERROR] Error with authentication %o', err);
        params.error = isString(err) ? err : err.message || 'Unknown Error';
        params.message = (req.query.error_description as string) || undefined;
        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}`);
      }
      if (!userProfile) {
        req.log.warn('[AUTH][LINK][ERROR] no user');
        params.error = 'Authentication Error';
        params.message = (req.query.error_description as string) || undefined;
        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}`);
      }
      try {
        const user = req.user as UserProfileServer;
        await linkIdentity(user, userProfile.user_id);
        params.data = JSON.stringify({ userId: userProfile.user_id });

        // If prior user existed with orgs and a user, then remove them
        // If user linked account for very first time, then this may not apply
        try {
          await hardDeleteUserAndOrgs(userProfile.user_id);
        } catch (ex) {
          req.log.warn(
            {
              userId: user.id,
              secondaryUserId: userProfile.user_id,

              ...getExceptionLog(ex),
            },
            '[AUTH0][IDENTITY][LINK][ERROR] Failed to delete the secondary user orgs %s',
            userProfile.user_id
          );
        }

        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}`);
      } catch (ex) {
        req.log.warn({ ...getExceptionLog(ex) }, '[AUTH][LINK][ERROR] Error linking account %s', ex);
        params.error = 'Unexpected Error';
        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}&clientUrl=${ENV.JETSTREAM_CLIENT_URL}`);
      }
    }
  )(req, res, next);
}

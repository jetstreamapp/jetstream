/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, logger } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import { isString } from 'lodash';
import * as passport from 'passport';
import { URL } from 'url';
import { hardDeleteUserAndOrgs } from '../db/transactions.db';
import { createOrUpdateUser } from '../db/user.db';
import { checkAuth } from '../routes/route.middleware';
// import { sendWelcomeEmail } from '../services/worker-jobs';
import { linkIdentity } from '../services/auth0';
import { AuthenticationError } from '../utils/error-handler';

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
            logger.warn('[AUTH][ERROR] Error logging in %o', err, { requestId: res.locals.requestId });
            return res.redirect('/');
          }

          createOrUpdateUser(user)
            .then(async ({ user: _user }) => {
              logger.info('[AUTH][SUCCESS] Logged in %s', _user.email, { userId: user.id, requestId: res.locals.requestId });
              res.redirect(ENV.JETSTREAM_CLIENT_URL!);
            })
            .catch((err) => {
              logger.error('[AUTH][DB][ERROR] Error creating or sending welcome email %o', err, { requestId: res.locals.requestId });
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
        logger.warn('[AUTH][ERROR] Error with authentication %o', err, { requestId: res.locals.requestId });
        return next(new AuthenticationError(err));
      }
      if (!user) {
        logger.warn('[AUTH][ERROR] no user', { requestId: res.locals.requestId });
        logger.warn('[AUTH][ERROR] no info %o', info, { requestId: res.locals.requestId });
        return res.redirect('/oauth/login');
      }
      req.logIn(user, async (err) => {
        if (err) {
          logger.warn('[AUTH][ERROR] Error logging in %o', err, { requestId: res.locals.requestId });
          return next(new AuthenticationError(err));
        }

        createOrUpdateUser(user).catch((err) => {
          logger.error('[AUTH][DB][ERROR] Error creating or sending welcome email %o', err, { requestId: res.locals.requestId });
        });

        // TODO: confirm returnTo 0 it suddenly was reported as bad
        const returnTo = (req.session as any).returnTo;
        delete (req.session as any).returnTo;
        logger.info('[AUTH][SUCCESS] Logged in %s', user.email, { userId: user.id, requestId: res.locals.requestId });
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
        logger.warn('[AUTH][LINK][ERROR] Error with authentication %o', err, { requestId: res.locals.requestId });
        params.error = isString(err) ? err : err.message || 'Unknown Error';
        params.message = (req.query.error_description as string) || undefined;
        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}`);
      }
      if (!userProfile) {
        logger.warn('[AUTH][LINK][ERROR] no user', { requestId: res.locals.requestId });
        logger.warn('[AUTH][LINK][ERROR] no info %o', info, { requestId: res.locals.requestId });
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
          logger.warn('[AUTH0][IDENTITY][LINK][ERROR] Failed to delete the secondary user orgs %s', userProfile.user_id, {
            userId: user.id,
            secondaryUserId: userProfile.user_id,
            requestId: res.locals.requestId,
          });
        }

        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}`);
      } catch (ex) {
        logger.warn('[AUTH][LINK][ERROR] Error linking account %o', err, { requestId: res.locals.requestId });
        params.error = 'Unexpected Error';
        return res.redirect(`/oauth-link/?${new URLSearchParams(params as any).toString()}&clientUrl=${ENV.JETSTREAM_CLIENT_URL}`);
      }
    }
  )(req, res, next);
}

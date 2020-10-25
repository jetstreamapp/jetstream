import { Request, Response, NextFunction } from 'express';
import * as passport from 'passport';
import { URL } from 'url';
import * as querystring from 'querystring';
import { AuthenticationError } from '../utils/error-handler';
import { ENV } from '../config/env-config';

export async function login(req: Request, res: Response) {
  res.redirect('/');
}

export async function callback(req: Request, res: Response, next: NextFunction) {
  passport.authenticate(
    'auth0',
    {
      failureRedirect: '/',
    },
    (err, user, info) => {
      if (err) {
        return next(new AuthenticationError(err));
      }
      if (!user) {
        return res.redirect('/oauth/login');
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(new AuthenticationError(err));
        }
        const returnTo = req.session.returnTo;
        delete req.session.returnTo;
        // TODO: figure out the route here
        res.redirect(returnTo || ENV.JETSTREAM_CLIENT_URL);
      });
    }
  )(req, res, next);
}

export async function logout(req: Request, res: Response) {
  req.logout();

  const logoutURL = new URL(`https://${ENV.AUTH0_DOMAIN}/v2/logout`);

  logoutURL.search = querystring.stringify({
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: ENV.AUTH0_CLIENT_ID,
    returnTo: ENV.JETSTREAM_SERVER_URL,
  });

  res.redirect(logoutURL.toString());
}

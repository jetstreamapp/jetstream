import { Request, Response, NextFunction } from 'express';
import * as passport from 'passport';
import { URL } from 'url';
import * as querystring from 'querystring';

export async function login(req: Request, res: Response) {
  res.redirect('/');
}

export async function callback(req: Request, res: Response, next: NextFunction) {
  passport.authenticate('auth0', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/oauth/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;
      // TODO: figure out the route here
      res.redirect(returnTo || process.env.JETSTREAM_CLIENT_URL);
    });
  })(req, res, next);
}

export async function logout(req: Request, res: Response) {
  req.logout();

  let returnTo = `${req.protocol}://${req.hostname}`;
  const port = req.connection.localPort;
  if (port !== undefined && port !== 80 && port !== 443) {
    returnTo += ':' + port;
  }
  const logoutURL = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`);

  logoutURL.search = querystring.stringify({
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: process.env.AUTH0_CLIENT_ID,
    returnTo: returnTo,
  });

  res.redirect(logoutURL.toString());
}

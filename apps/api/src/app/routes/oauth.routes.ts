import * as express from 'express';
import Router from 'express-promise-router';
import { routeDefinition as oauthController } from '../controllers/oauth.controller';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

routes.get('/signup', oauthController.signup.controllerFn());
routes.get('/login', oauthController.login.controllerFn());
routes.get('/logout', oauthController.logout.controllerFn());
routes.get('/callback', oauthController.oauthCallback.controllerFn());

routes.get('/identity/link', checkAuth, oauthController.linkIdentity.controllerFn());
routes.get('/identity/link/callback', checkAuth, oauthController.linkIdentityOauthCallback.controllerFn());

// // https://auth0.com/docs/universal-login/new-experience#signup
// routes.get(
//   '/signup',
//   passport.authenticate('oauth2', {
//     scope: 'openid email profile',
//     screen_hint: 'signup',
//     prompt: 'signup',
//   } as any),
//   authController.login
// );

// routes.get(
//   '/login',
//   passport.authenticate(
//     ['custom', 'oauth2', 'auth0'].filter(
//       (item) => item === 'oauth2' || item === 'auth0' || (ENV.EXAMPLE_USER_OVERRIDE && ENV.EXAMPLE_USER)
//     ),
//     {
//       scope: 'openid email profile',
//       prompt: 'login',
//     }
//   ),
//   authController.login
// );
// routes.get('/callback', authController.callback);
// routes.get('/logout', authController.logout);

// Link additional accounts
// routes.get('/identity/link', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
//   try {
//     // TODO: validate request
//     const connection = req.query.connection as 'google-oauth2' | 'salesforce' | 'github';
//     let connectionId;
//     switch (connection) {
//       case 'google-oauth2':
//         connectionId = ENV.AUTH_M2M_OAUTH_GOOGLE_ID;
//         break;
//       case 'salesforce':
//         connectionId = ENV.AUTH_M2M_OAUTH_SFDC_ID;
//         break;
//       case 'github':
//       default:
//         throw new Error('Invalid connection');
//     }
//     if (!connectionId) {
//       throw new Error('Connection not provided');
//     }
//     const { redirectTo } = await authM2MService.getConnectorAuthorizationUrl(req.user as UserProfileServer, connectionId);
//     res.redirect(redirectTo);
//   } catch (ex) {
//     next(ex);
//   }
// });
// routes.get('/identity/link/callback', authController.linkCallback);

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, oauthController.salesforceOauthInitAuth.controllerFn());
routes.get('/sfdc/callback', checkAuth, oauthController.salesforceOauthCallback.controllerFn());

export default routes;

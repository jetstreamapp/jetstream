import apiRoutes from './api.routes';
import landingRoutes from './landing.routes';
import oauthRoutes from './oauth.routes';
import platformEventRoutes from './platform-event.routes';
import staticAuthenticatedRoutes from './static-authenticated.routes';
import testRoutes, { registerPassportTestLoginStrategy } from './test.routes';

export {
  apiRoutes,
  platformEventRoutes,
  landingRoutes,
  oauthRoutes,
  staticAuthenticatedRoutes,
  testRoutes,
  registerPassportTestLoginStrategy,
};

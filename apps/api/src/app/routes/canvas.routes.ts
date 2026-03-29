import express, { Router } from 'express';
import helmet from 'helmet';
import { join } from 'node:path';
import { routeDefinition as canvasController } from '../controllers/canvas.controller';

const ALLOWED_REFERRER_PATTERN = /\.(salesforce\.com|force\.com|salesforce-setup\.com)$/;

/**
 * Validates that static asset requests originate from a Salesforce context or from our own host.
 * Canvas is always served in an iframe, so the Referer header should reliably be present.
 * Blocks requests from non-Salesforce origins when the header is present.
 */
function validateCanvasReferer(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const requestHost = req.hostname;

  const referrerUrl = origin || referer;

  // Allow requests with no Referer/Origin — some browser privacy extensions strip these headers.
  // The signed request verification on /canvas/app is the real auth gate.
  if (!referrerUrl) {
    next();
    return;
  }

  try {
    const { hostname } = new URL(Array.isArray(referrerUrl) ? referrerUrl[0] : referrerUrl);

    // Allow requests from Salesforce domains or from our own host (self-referencing asset loads)
    if (ALLOWED_REFERRER_PATTERN.test(hostname) || hostname === requestHost) {
      next();
      return;
    }
  } catch {
    // Invalid URL in header
  }

  res.status(403).send('Forbidden');
}

const routes: express.Router = Router();

routes.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", '*.salesforce.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'", '*.force.com', '*.salesforce.com', '*.salesforce-setup.com'],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'none'"],
      },
    },
  }),
);

routes.get('/callback', canvasController.callbackHandler.controllerFn());
routes.post('/callback', canvasController.callbackHandler.controllerFn());

routes.get('/app', canvasController.appHandler.controllerFn());
routes.post('/app', canvasController.appHandler.controllerFn());

routes.use(validateCanvasReferer, express.static(join(__dirname, '../jetstream-canvas')));

export default routes;

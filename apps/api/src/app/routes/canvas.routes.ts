import express, { Router } from 'express';
import { join } from 'node:path';
import { routeDefinition as canvasController } from '../controllers/canvas.controller';

const routes: express.Router = Router();

routes.get('/callback', canvasController.callbackHandler.controllerFn());
routes.post('/callback', canvasController.callbackHandler.controllerFn());

routes.get('/app', canvasController.appHandler.controllerFn());
routes.post('/app', canvasController.appHandler.controllerFn());

routes.use(
  (req, res, next) => {
    // res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  },
  express.static(join(__dirname, '../jetstream-canvas')),
);

export default routes;

import { createRateLimit } from '@jetstream/api-config';
import express, { Router } from 'express';
import * as desktopAssetsController from '../controllers/desktop-assets.controller';
import { rateLimitGetKeyGenerator, rateLimitGetMaxRequests } from '../utils/route.utils';
import { checkAuth } from './route.middleware';

export const DownloadRateLimit = createRateLimit('download', {
  windowMs: 1000 * 60 * 1, // 1 minutes
  limit: rateLimitGetMaxRequests(5),
  keyGenerator: rateLimitGetKeyGenerator(),
});

export const routes: express.Router = Router();

routes.get(
  '/download/:platform/:arch',
  DownloadRateLimit,
  checkAuth,
  desktopAssetsController.routeDefinition.getDownloadLink.controllerFn(),
);
routes.get('/downloads', DownloadRateLimit, checkAuth, desktopAssetsController.routeDefinition.getAllDownloadLinks.controllerFn());

export default routes;

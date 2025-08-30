import { createRateLimit, ENV } from '@jetstream/api-config';
import express, { Router } from 'express';
import * as desktopAssetsController from '../controllers/desktop-assets.controller';
import { checkAuth } from './route.middleware';

function getMaxRequests(value: number) {
  return ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : value;
}

export const DownloadRateLimit = createRateLimit('download', {
  windowMs: 1000 * 60 * 1, // 1 minutes
  limit: getMaxRequests(5),
});

export const routes: express.Router = Router();

routes.get(
  '/download/:platform/:arch',
  DownloadRateLimit,
  checkAuth,
  desktopAssetsController.routeDefinition.getDownloadLink.controllerFn()
);
routes.get('/downloads', DownloadRateLimit, checkAuth, desktopAssetsController.routeDefinition.getAllDownloadLinks.controllerFn());

export default routes;

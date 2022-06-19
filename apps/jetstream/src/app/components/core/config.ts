import { LicenseManager } from '@ag-grid-enterprise/core';
import { logger } from '@jetstream/shared/client-logger';
import { initForElectron } from '@jetstream/shared/data';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { environment } from '../../../environments/environment';
import { axiosElectronAdapter } from './electron-axios-adapter';
import * as jetstreamElectron from './electron-utils';

LicenseManager.setLicenseKey(process.env.NX_AG_GRID_KEY);

export const CONFIG = {
  Router: BrowserRouter,
  baseName: '/app',
};

if (environment.isElectron || window.electron?.isElectron) {
  CONFIG.Router = HashRouter;
  CONFIG.baseName = '/';
  initForElectron(axiosElectronAdapter);
  (async () => {
    logger.log('Loaded electron');
    jetstreamElectron.init();
  })();
}

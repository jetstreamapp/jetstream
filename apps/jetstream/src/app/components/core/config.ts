import { LicenseManager } from '@ag-grid-enterprise/core';
import { logger } from '@jetstream/shared/client-logger';
import { initForElectron } from '@jetstream/shared/data';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { environment } from '../../../environments/environment';
import { axiosElectronAdapter } from './electron-axios-adapter';
import * as jetstreamElectron from './electron-utils';

LicenseManager.setLicenseKey(
  `CompanyName=Jetstream,LicensedApplication=Jetstream,LicenseType=SingleApplication,LicensedConcurrentDeveloperCount=1,LicensedProductionInstancesCount=1,AssetReference=AG-018850,ExpiryDate=8_September_2022_[v2]_MTY2MjU5MTYwMDAwMA==6c7706e6dd6559d1b4f3c781ef0e7b61`
);

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

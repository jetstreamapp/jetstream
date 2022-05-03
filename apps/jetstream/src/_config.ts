import { LicenseManager } from '@ag-grid-enterprise/core';
import { initForElectron } from '@jetstream/shared/data';
import { environment } from './environments/environment';
import { BrowserRouter, HashRouter } from 'react-router-dom';

export const CONFIG = {
  Router: BrowserRouter,
};

if (environment.isElectron) {
  initForElectron();
  CONFIG.Router = HashRouter;
}

LicenseManager.setLicenseKey(
  `CompanyName=Jetstream,LicensedApplication=Jetstream,LicenseType=SingleApplication,LicensedConcurrentDeveloperCount=1,LicensedProductionInstancesCount=1,AssetReference=AG-018850,ExpiryDate=8_September_2022_[v2]_MTY2MjU5MTYwMDAwMA==6c7706e6dd6559d1b4f3c781ef0e7b61`
);

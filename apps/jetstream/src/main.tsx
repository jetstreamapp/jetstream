import React from 'react';
import ReactDOM from 'react-dom';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import App from './app/app';
import './main.scss';
import { BrowserRouter as Router } from 'react-router-dom';
import { LicenseManager } from '@ag-grid-enterprise/core';

LicenseManager.setLicenseKey(
  `CompanyName=Jetstream,LicensedApplication=Jetstream,LicenseType=SingleApplication,LicensedConcurrentDeveloperCount=1,LicensedProductionInstancesCount=1,AssetReference=AG-018850,ExpiryDate=8_September_2022_[v2]_MTY2MjU5MTYwMDAwMA==6c7706e6dd6559d1b4f3c781ef0e7b61`
);

ReactDOM.render(
  <div className="app">
    <Router basename="/app">
      <App />
    </Router>
  </div>,
  document.getElementById('root')
);

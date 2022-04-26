import { LicenseManager } from '@ag-grid-enterprise/core';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import React from 'react';
import { render } from 'react-dom';
// import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './app/app';
import './main.scss';

LicenseManager.setLicenseKey(
  `CompanyName=Jetstream,LicensedApplication=Jetstream,LicenseType=SingleApplication,LicensedConcurrentDeveloperCount=1,LicensedProductionInstancesCount=1,AssetReference=AG-018850,ExpiryDate=8_September_2022_[v2]_MTY2MjU5MTYwMDAwMA==6c7706e6dd6559d1b4f3c781ef0e7b61`
);

const container = document.getElementById('root');

// REACT 18 MODE
// createRoot(container).render(
//   <div className="app">
//     <Router basename="/app">
//       <App />
//     </Router>
//   </div>
// );

// REACT 17 MODE
render(
  <div className="app">
    <Router basename="/app">
      <App />
    </Router>
  </div>,
  container
);

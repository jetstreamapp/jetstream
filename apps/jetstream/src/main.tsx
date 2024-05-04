/* eslint-disable no-restricted-globals */
// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
// import React from 'react';
// import { render } from 'react-dom';
import { setJobsWorker } from '@jetstream/ui-core';
import { createRoot } from 'react-dom/client';
import App from './app/app';
import './main.scss';

const jobsWorker = new Worker(new URL('./workers/jobs.worker.ts', import.meta.url), { type: 'module' });
setJobsWorker(jobsWorker);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;

if (location.hostname === 'localhost' && !location.pathname.includes('/app')) {
  location.href = '/app';
}

createRoot(container).render(
  <div className="app">
    <CONFIG.Router basename={CONFIG.baseName}>
      <App />
    </CONFIG.Router>
  </div>
);

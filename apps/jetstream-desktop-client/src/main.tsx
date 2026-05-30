// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import { applyThemeBeforeMount } from '@jetstream/ui-core';
import '@jetstream/ui-styles/main.css';
import '@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css';
import { createRoot } from 'react-dom/client';
import App from './app/app';
import './main.css';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;

applyThemeBeforeMount().finally(() => {
  createRoot(container).render(
    <div className="app">
      <CONFIG.Router basename={CONFIG.baseName}>
        <App />
      </CONFIG.Router>
    </div>,
  );
});

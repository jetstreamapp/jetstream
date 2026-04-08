// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import { AxiosAdapterConfig } from '@jetstream/shared/data';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { Login } from './app/core/Login';
import './main.scss';
import { canvasAppAxiosAdapter } from './utils/canvas-axios-adapter';

globalThis.__IS_CANVAS_APP__ = true;

AxiosAdapterConfig.adapter = canvasAppAxiosAdapter;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const Sfdc = window.Sfdc;
// TODO: should we move this into the application?
if (window.self === window.top) {
  // Not in Iframe
  console.error('This canvas app must be included within an iframe');
  alert('This canvas app must be included within an iframe');
}

// TODO: should be configuration based (e.g. user puts something in URL and that is passed along)
Sfdc.canvas.console.enable();

Sfdc.canvas(() => {
  if (sr.client) {
    try {
      Sfdc.canvas.oauth.token(sr.client.oauthToken);
    } catch (ex) {
      console.error('Error setting oauth token for canvas client', ex);
    }
  }

  root.render(
    <Login
    // TODO: logout handling
    >
      {() => {
        Sfdc.canvas.oauth.token(sr.client.oauthToken);

        Sfdc.canvas.client.autogrow(sr.client, false);

        return (
          <div className="app">
            <CONFIG.Router basename={CONFIG.baseName}>
              <App />
            </CONFIG.Router>
          </div>
        );
      }}
    </Login>,
  );
});

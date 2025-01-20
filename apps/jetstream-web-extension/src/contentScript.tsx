/// <reference types="chrome"/>
import { SfdcPageButton } from './components/SfdcPageButton';
import { AppWrapperNotJetstreamOwnedPage } from './core/AppWrapperNotJetstreamOwnedPage';
import { initAndRenderReact } from './utils/web-extension.utils';

const elementId = 'jetstream-app-container';

function renderApp() {
  // TODO: check storage to see if app is disabled before mounting
  if (!document.getElementById(elementId)) {
    const app = document.createElement('div');
    app.id = elementId;
    document.body.appendChild(app);
    initAndRenderReact(
      <AppWrapperNotJetstreamOwnedPage>
        <SfdcPageButton />
      </AppWrapperNotJetstreamOwnedPage>,
      { elementId }
    );
  }
}

function destroyApp() {
  const app = document.getElementById(elementId);
  if (app) {
    app.remove();
  }
}

chrome.storage.local.get('options', (storage: { options?: { enabled: boolean } }) => {
  if (!storage.options || storage.options.enabled) {
    renderApp();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.options?.newValue) {
    const { enabled } = changes.options.newValue;
    if (enabled) {
      renderApp();
    } else {
      destroyApp();
    }
  }
});

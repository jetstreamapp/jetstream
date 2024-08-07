/* eslint-disable no-restricted-globals */
/// <reference types="chrome"/>
import { initAndRenderReact } from '@jetstream/web-extension-utils';
import Button from './components/Button';
import { AppWrapperNotJetstreamOwnedPage } from './core/AppWrapperNotJetstreamOwnedPage';

/**
 * This will change `publicPath` to `chrome-extension://<extension_id>/`.
 * It for runtime to get script chunks from the output folder
 * and for asset modules like file-loader to work.
 */
// @ts-expect-error - see above comment
__webpack_public_path__ = chrome.runtime.getURL('');

// @ts-expect-error - see above comment
console.log('Content script loaded.', __webpack_public_path__);

const elementId = 'jetstream-app-container';

function renderApp() {
  // TODO: check storage to see if app is disabled before mounting
  if (!document.getElementById(elementId)) {
    const app = document.createElement('div');
    app.id = elementId;
    document.body.appendChild(app);
    initAndRenderReact(
      <AppWrapperNotJetstreamOwnedPage>
        <Button />
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

renderApp();

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

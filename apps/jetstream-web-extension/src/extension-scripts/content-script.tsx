import { PortalProvider } from '@jetstream/ui';
import browser from 'webextension-polyfill';
import { SfdcPageButton } from '../components/SfdcPageButton';
import { AppWrapperNotJetstreamOwnedPage } from '../core/AppWrapperNotJetstreamOwnedPage';
import { applyExtensionThemeBeforeMount, ExtensionThemeApplier } from '../core/ExtensionThemeApplier';
import { initAndRenderReact } from '../utils/web-extension.utils';

const elementId = 'jetstream-app-container';

function renderApp() {
  if (!document.getElementById(elementId)) {
    const app = document.createElement('div');
    app.id = elementId;
    document.body.appendChild(app);
    applyExtensionThemeBeforeMount({ targetId: elementId }).finally(() => {
      initAndRenderReact(
        <AppWrapperNotJetstreamOwnedPage>
          <ExtensionThemeApplier targetId={elementId} />
          {/* Route popover/tooltip portals into the Jetstream container so they pick up
              the slds-color-scheme--* class instead of the bare host page body. */}
          <PortalProvider portalRoot={app}>
            <SfdcPageButton />
          </PortalProvider>
        </AppWrapperNotJetstreamOwnedPage>,
        { elementId },
      );
    });
  }
}

function destroyApp() {
  const app = document.getElementById(elementId);
  if (app) {
    app.remove();
  }
}

browser.storage.local.get('options').then((storage: { options?: { enabled: boolean; recordSyncEnabled: boolean } }) => {
  if (!storage.options || storage.options.enabled) {
    renderApp();
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.options?.newValue) {
    const { enabled } = changes.options.newValue as { enabled?: boolean };
    if (enabled) {
      renderApp();
    } else {
      destroyApp();
    }
  }
});

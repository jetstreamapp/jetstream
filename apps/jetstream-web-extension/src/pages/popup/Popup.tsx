import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { CheckboxToggle } from '@jetstream/ui';
import { JetstreamLogo } from '@jetstream/ui-core';
import { initAndRenderReact } from '@jetstream/web-extension-utils';
import { useEffect, useState } from 'react';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';

initAndRenderReact(<Component />);

export function Component() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const storage = (await chrome.storage.local.get('options')) || {};
      storage.options = storage.options || { enabled: true };
      setEnabled(storage.options.enabled);
    })();
  }, []);

  useNonInitialEffect(() => {
    (async () => {
      chrome.storage.local.set({ options: { enabled } });
    })();
  }, [enabled]);

  return (
    <AppWrapperNotJetstreamOwnedPage>
      <header className="slds-m-bottom_medium">
        <JetstreamLogo />
      </header>
      <div>
        <CheckboxToggle
          id="enable-extension-button"
          checked={enabled}
          label="Enable Page Extension"
          labelHelp="If you want to disabled Jetstream, uncheck this box."
          onChange={(value) => setEnabled(value)}
        />
      </div>
    </AppWrapperNotJetstreamOwnedPage>
  );
}

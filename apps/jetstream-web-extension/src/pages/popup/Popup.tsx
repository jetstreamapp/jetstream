import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { CheckboxToggle, FeedbackLink, ScopedNotification } from '@jetstream/ui';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import JetstreamLogo from '../../components/icons/JetstreamLogo';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';
import { environment } from '../../environments/environment';
import { chromeStorageOptions, chromeSyncStorage } from '../../utils/extension.store';
import { initAndRenderReact, sendMessage } from '../../utils/web-extension.utils';

initAndRenderReact(
  <AppWrapperNotJetstreamOwnedPage>
    <Component />
  </AppWrapperNotJetstreamOwnedPage>
);

export function Component() {
  const options = useRecoilValue(chromeStorageOptions);
  const [enabled, setEnabled] = useState(options.enabled);
  const [authError, setAuthError] = useState<string | null>(null);
  const { authTokens } = useRecoilValue(chromeSyncStorage);

  const loggedIn = !!authTokens?.loggedIn;

  useEffect(() => {
    sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
      setAuthError('There was a problem verifying your authentication. Please log in again.');
    });
  }, [authTokens]);

  useNonInitialEffect(() => {
    (async () => {
      chrome.storage.local.set({ options: { enabled } });
    })();
  }, [enabled]);

  function handleLogout() {
    sendMessage({ message: 'LOGOUT' })
      .then(() => {
        setAuthError(null);
      })
      .catch((err) => {
        setAuthError('There was a problem verifying your authentication. Please log in again.');
      });
  }

  return (
    <>
      <header className="slds-m-bottom_medium">
        <JetstreamLogo />
      </header>
      <div>
        {authError && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small">
            {authError}
          </ScopedNotification>
        )}
        {loggedIn && authTokens && (
          <>
            <p>Logged in as {authTokens.name}</p>
            <button className="slds-button slds-m-top_x-small" onClick={() => handleLogout()}>
              Log Out
            </button>
            <hr className="slds-m-vertical_small" />
            <CheckboxToggle
              id="enable-extension-button"
              checked={enabled}
              label="Jetstream Page Button"
              labelHelp="If disabled, the Jetstream floating button will not be visible when you are on a Salesforce page."
              onChange={(value) => setEnabled(value)}
            />
            <hr className="slds-m-vertical_small" />
            <p>Visit any Salesforce page to see the floating Jetstream button icon on the right side of the page.</p>
            <hr className="slds-m-vertical_small" />
            <p className="slds-m-bottom_x-small">Feedback or Suggestions?</p>
            <div>
              <FeedbackLink type="GH_ISSUE" label="Report a bug or feature request" />
            </div>
            <div>
              <FeedbackLink type="EMAIL" label="Send us an email" />
            </div>
          </>
        )}
        {(!loggedIn || !authTokens) && (
          <>
            <p>To get started with Jetstream, login to your account.</p>
            <a
              href={`${environment.serverUrl}/web-extension/init`}
              target="_blank"
              className="slds-button slds-button_brand slds-button_stretch slds-m-top_small"
              rel="noreferrer"
            >
              Login
            </a>
          </>
        )}
      </div>
    </>
  );
}

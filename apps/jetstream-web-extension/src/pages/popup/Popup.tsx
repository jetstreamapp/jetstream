import { css } from '@emotion/react';
import { CheckboxToggle, FeedbackLink, Grid, ScopedNotification } from '@jetstream/ui';
import JetstreamIcon from '../../components/icons/JetstreamIcon';
import JetstreamLogo from '../../components/icons/JetstreamLogo';
import { PopupButtonOptions } from '../../components/PopupButtonOptions';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';
import { environment } from '../../environments/environment';
import { useExtensionSettings } from '../../hooks/useExtensionSettings';
import { initAndRenderReact } from '../../utils/web-extension.utils';

initAndRenderReact(
  <AppWrapperNotJetstreamOwnedPage>
    <Component />
  </AppWrapperNotJetstreamOwnedPage>
);

export function Component() {
  const { authTokens, loggedIn, enabled, setEnabled, recordSyncEnabled, setRecordSyncEnabled, authError, handleLogout } =
    useExtensionSettings();

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
            <p>Logged in as {authTokens.userProfile?.name}</p>
            <button className="slds-button slds-m-top_x-small" onClick={() => handleLogout()}>
              Log Out
            </button>
            <hr className="slds-m-vertical_small" />
            <Grid className="slds-m-bottom_x-small" align="spread">
              <p>Visit any Salesforce page and click the floating Jetstream icon on the right side of the page.</p>
              <div
                css={css`
                  width: 45px;
                `}
              >
                <JetstreamIcon />
              </div>
            </Grid>
            <CheckboxToggle
              id="enable-extension-button"
              checked={enabled}
              label="Jetstream Page Button"
              labelHelp="If disabled, the Jetstream floating button will not be visible when you are on a Salesforce page."
              labelPosition="right"
              onChange={(value) => setEnabled(value)}
            />
            <CheckboxToggle
              id="enable-record-sync-button"
              containerClassname="slds-m-top_x-small"
              checked={recordSyncEnabled}
              label="Data Sync"
              labelHelp="Enable to sync Query History with the Jetstream server."
              labelPosition="right"
              onChange={(value) => setRecordSyncEnabled(value)}
            />
            <hr className="slds-m-vertical_small" />
            <p className="slds-m-bottom_x-small">Feedback or Suggestions?</p>
            <div>
              <FeedbackLink type="GH_ISSUE" label="Report a bug or feature request" />
            </div>
            <div>
              <FeedbackLink type="EMAIL" label="Send us an email" />
            </div>
            <hr className="slds-m-vertical_small" />
            <PopupButtonOptions />
            <hr className="slds-m-vertical_small" />
            <a href={`${chrome.runtime.getURL('additional-settings.html')}`} className="slds-button" target="_blank" rel="noreferrer">
              Additional Settings
            </a>
          </>
        )}
        {(!loggedIn || !authTokens) && (
          <>
            <p>To get started with Jetstream, sign in to your account.</p>
            <a
              href={`${environment.serverUrl}/web-extension/init`}
              target="_blank"
              className="slds-button slds-button_brand slds-button_stretch slds-m-top_small"
              rel="noreferrer"
            >
              Sign In
            </a>
          </>
        )}
      </div>
    </>
  );
}

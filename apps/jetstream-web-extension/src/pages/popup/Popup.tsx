import { css } from '@emotion/react';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { CheckboxToggle, FeedbackLink, RadioButton, RadioGroup, ScopedNotification, Slider } from '@jetstream/ui';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import JetstreamIcon from '../../components/icons/JetstreamIcon';
import JetstreamLogo from '../../components/icons/JetstreamLogo';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';
import { environment } from '../../environments/environment';
import { chromeStorageOptions, chromeSyncStorage } from '../../utils/extension.store';
import { ButtonPosition, DEFAULT_BUTTON_POSITION } from '../../utils/extension.types';
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
  const { authTokens, buttonPosition: _buttonPosition } = useRecoilValue(chromeSyncStorage);

  const [buttonOptionsVisible, setButtonOptionsVisible] = useState(false);

  const [buttonLocation, setButtonLocation] = useState(_buttonPosition.location);
  const [buttonPosition, setButtonPosition] = useState(_buttonPosition.position);
  const [buttonOpacity, setButtonOpacity] = useState(_buttonPosition.opacity);
  const [buttonInactiveSize, setButtonInactiveSize] = useState(_buttonPosition.inactiveSize);
  const [buttonActiveScale, setButtonActiveScale] = useState(_buttonPosition.activeScale);

  const currentButtonPosition = useMemo(
    (): ButtonPosition => ({
      location: buttonLocation,
      position: buttonPosition,
      opacity: buttonOpacity,
      inactiveSize: buttonInactiveSize,
      activeScale: buttonActiveScale,
    }),
    [buttonActiveScale, buttonInactiveSize, buttonLocation, buttonOpacity, buttonPosition]
  );

  const currentButtonPositionDebounced = useDebounce(currentButtonPosition, 500);

  const loggedIn = !!authTokens?.loggedIn;

  useNonInitialEffect(() => {
    chrome.storage.sync.set({ buttonPosition: currentButtonPositionDebounced }).catch((ex) => {
      console.warn('Error setting button position', ex);
    });
  }, [currentButtonPositionDebounced]);

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

  function handleResetButtonOptions() {
    setButtonLocation(DEFAULT_BUTTON_POSITION.location);
    setButtonPosition(DEFAULT_BUTTON_POSITION.position);
    setButtonOpacity(DEFAULT_BUTTON_POSITION.opacity);
    setButtonInactiveSize(DEFAULT_BUTTON_POSITION.inactiveSize);
    setButtonActiveScale(DEFAULT_BUTTON_POSITION.activeScale);
    setButtonOptionsVisible(false);
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
            <div
              css={css`
                width: 25px;
              `}
            >
              <JetstreamIcon />
            </div>
            <hr className="slds-m-vertical_small" />
            <p className="slds-m-bottom_x-small">Feedback or Suggestions?</p>
            <div>
              <FeedbackLink type="GH_ISSUE" label="Report a bug or feature request" />
            </div>
            <div>
              <FeedbackLink type="EMAIL" label="Send us an email" />
            </div>
            <hr className="slds-m-vertical_small" />
            <p>Salesforce Button Location</p>
            {!buttonOptionsVisible && (
              <button className="slds-button slds-m-top_x-small" onClick={() => setButtonOptionsVisible(true)}>
                Show Configuration Options
              </button>
            )}
            {buttonOptionsVisible && (
              <>
                <button className="slds-button slds-m-top_x-small slds-m-bottom_small" onClick={() => handleResetButtonOptions()}>
                  Reset to Default
                </button>
                <RadioGroup label="Name Type" isButtonGroup className="slds-m-bottom_small">
                  <RadioButton
                    id="sfdc-button-slider-location-left"
                    name="sfdc-button-slider-location"
                    label="Left"
                    value="left"
                    checked={buttonLocation === 'left'}
                    onChange={(value) => setButtonLocation(value as 'left')}
                  />
                  <RadioButton
                    id="sfdc-button-slider-location-rigt"
                    name="sfdc-button-slider-location"
                    label="Right"
                    value="right"
                    checked={buttonLocation === 'right'}
                    onChange={(value) => setButtonLocation(value as 'right')}
                  />
                </RadioGroup>
                <Slider
                  id="sfdc-button-slider-position"
                  value={`${buttonPosition}`}
                  label="Vertical Position"
                  labelHelp="The vertical position of the Jetstream icon on the page."
                  min={1}
                  max={window.screen.height - 50 || 1000}
                  step={10}
                  onChange={(value) => setButtonPosition(parseInt(value, 10))}
                />
                <Slider
                  id="sfdc-button-slider-opacity"
                  value={`${buttonOpacity}`}
                  label="Jetstream Icon Opacity"
                  labelHelp="Opacity of the Jetstream icon when it is not being hovered over."
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={(value) => setButtonOpacity(Number(value))}
                />
                <Slider
                  id="sfdc-button-slider-inactive-size"
                  value={`${buttonInactiveSize}`}
                  label="Jetstream Icon Size"
                  labelHelp="Size of the Jetstream icon when it is not being hovered over."
                  min={20}
                  max={100}
                  step={5}
                  onChange={(value) => setButtonInactiveSize(Number(value))}
                />
                <Slider
                  id="sfdc-button-slider-active-scale"
                  value={`${buttonActiveScale}`}
                  label="Button Hover Scale"
                  labelHelp="The scale of the button when you hover over it. 1 is the same size as the non-hovered button."
                  min={1}
                  max={5}
                  step={0.1}
                  onChange={(value) => setButtonActiveScale(Number(value))}
                />
              </>
            )}
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

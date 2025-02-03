import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Grid, RadioButton, RadioGroup, Slider } from '@jetstream/ui';
import { useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { chromeSyncStorage } from '../utils/extension.store';
import { ButtonPosition, DEFAULT_BUTTON_POSITION } from '../utils/extension.types';

export function PopupButtonOptions() {
  const { buttonPosition: _buttonPosition } = useRecoilValue(chromeSyncStorage);

  const [isVisible, setIsVisible] = useState(false);

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

  useNonInitialEffect(() => {
    chrome.storage.sync.set({ buttonPosition: currentButtonPositionDebounced }).catch((ex) => {
      console.warn('Error setting button position', ex);
    });
  }, [currentButtonPositionDebounced]);

  function handleResetButtonOptions() {
    setButtonLocation(DEFAULT_BUTTON_POSITION.location);
    setButtonPosition(DEFAULT_BUTTON_POSITION.position);
    setButtonOpacity(DEFAULT_BUTTON_POSITION.opacity);
    setButtonInactiveSize(DEFAULT_BUTTON_POSITION.inactiveSize);
    setButtonActiveScale(DEFAULT_BUTTON_POSITION.activeScale);
    setIsVisible(false);
  }

  return (
    <>
      <p>Salesforce Button Location</p>
      {!isVisible ? (
        <button className="slds-button slds-m-top_x-small" onClick={() => setIsVisible(true)}>
          Show Configuration Options
        </button>
      ) : (
        <Grid className="slds-m-top_x-small slds-m-bottom_small" align="spread">
          <button className="slds-button" onClick={() => setIsVisible(false)}>
            Hide Configuration Options
          </button>
          <button className="slds-button" onClick={() => handleResetButtonOptions()}>
            Reset to Default
          </button>
        </Grid>
      )}
      {isVisible && (
        <>
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
  );
}

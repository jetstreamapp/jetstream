import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { useState } from 'react';
import Grid from '../../grid/Grid';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import { UpgradeToProButton, UpgradeToProButtonProps } from '../button/UpgradeToProButton';

export interface GoogleSelectedProUpgradeButtonProps {
  id?: string;
  className?: string;
  label?: string;
  helpText?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  source: UpgradeToProButtonProps['source'];
  trackEvent: UpgradeToProButtonProps['trackEvent'];
}

export const GoogleSelectedProUpgradeButton = ({
  id = uniqueId('google-folder-input-upgrade'),
  className,
  label = 'Google Drive',
  hideLabel,
  labelHelp,
  source,
  trackEvent,
}: GoogleSelectedProUpgradeButtonProps) => {
  const [labelId] = useState(() => `${id}-label`);

  return (
    <div className="slds-p-horizontal_medium slds-p-bottom_medium">
      <div className={classNames('slds-form-element', className)}>
        <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel || !label })} id={labelId}>
          {label}
        </span>
        {labelHelp && label && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        <div className="slds-form-element__control">
          <label className="slds-file-selector__body" htmlFor={id}>
            <Grid>
              <span>
                <button
                  className="slds-is-relative slds-button slds-button_neutral"
                  disabled
                  aria-labelledby={`${labelId}`}
                  aria-describedby="folder-input-help"
                >
                  <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Google Drive
                </button>
              </span>
              <div className=" slds-m-left_xx-small">
                <UpgradeToProButton showOpenInNewTabIcon trackEvent={trackEvent} source={source} />
              </div>
            </Grid>
          </label>
        </div>
      </div>
    </div>
  );
};

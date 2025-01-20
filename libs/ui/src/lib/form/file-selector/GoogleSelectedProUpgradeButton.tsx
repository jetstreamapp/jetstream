import { APP_ROUTES } from '@jetstream/shared/ui-router';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';

export interface GoogleSelectedProUpgradeButtonProps {
  id?: string;
  className?: string;
  label?: string;
  helpText?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
}

export const GoogleSelectedProUpgradeButton = ({
  id = uniqueId('google-folder-input-upgrade'),
  className,
  label = 'Google Drive',
  hideLabel,
  labelHelp,
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
            <button
              className="slds-is-relative slds-button slds-button_neutral"
              disabled
              aria-labelledby={`${labelId}`}
              aria-describedby="folder-input-help"
            >
              <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
              Google Drive
            </button>
            <div className=" slds-m-left_xx-small slds-m-top_xx-small">
              <Link
                to={APP_ROUTES.BILLING.ROUTE}
                target="_blank"
                className="slds-is-relative"
                aria-labelledby={`${labelId}`}
                aria-describedby="folder-input-help"
              >
                <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
                Upgrade to enable Google Drive
              </Link>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

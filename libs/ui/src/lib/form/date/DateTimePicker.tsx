// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import { IconType } from '@jetstream/icon-factory';

export interface InputProps {
  id?: string;
  className?: string;
  label?: string;
  labelHelp?: string | null;
  helpText?: JSX.Element | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: JSX.Element | string;
  iconLeft?: string;
  iconLeftType?: IconType;
  iconRight?: string;
  iconRightType?: IconType;
  leftAddon?: JSX.Element | string;
  rightAddon?: JSX.Element | string;
  clearButton?: boolean;
  onClear?: () => void;
  children?: React.ReactNode;
}

export const Input: FunctionComponent<InputProps> = ({
  id,
  className,
  label,
  labelHelp,
  helpText,
  isRequired = false,
  hasError = false,
  errorMessageId,
  errorMessage,
  iconLeft,
  iconLeftType,
  iconRight,
  iconRightType,
  clearButton = false,
  onClear,
  // Addons - these cannot be used with icon in same location
  leftAddon,
  rightAddon,
  children,
}) => {
  if (hasError && !iconLeft && !iconRight) {
    iconLeft = 'error';
    iconLeftType = 'utility';
  }

  return (
    <div className={classNames('slds-form-element slds-grid_vertical-align-end', className, { 'slds-has-error': hasError })}>
      {label && (
        <Fragment>
          <label className="slds-form-element__label" htmlFor={id}>
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </label>
          {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        </Fragment>
      )}
      <div
        className={classNames('slds-form-element__control', {
          'slds-input-has-icon': iconLeft || iconRight || clearButton,
          'slds-input-has-icon_left': !leftAddon && iconLeft && !iconRight && !clearButton,
          'slds-input-has-icon_right': !leftAddon && !iconLeft && (iconRight || clearButton),
          'slds-input-has-icon_left-right': (!leftAddon && !rightAddon && iconLeft && iconRight) || (iconLeft && clearButton),
          'slds-input-has-fixed-addon': leftAddon || rightAddon,
        })}
      >
        {!leftAddon && iconLeft && iconLeftType && (
          <Icon
            omitContainer
            type={iconLeftType}
            icon={iconLeft as any}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_left"
          />
        )}
        {!rightAddon && iconRight && iconRightType && (
          <Icon
            omitContainer
            type={iconRightType}
            icon={iconLeft as any}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_right"
          />
        )}
        {leftAddon && (
          <span className="slds-form-element__addon" id="fixed-text-addon-pre">
            {leftAddon}
          </span>
        )}
        {/* Input field must be passed through */}
        {children}
        {rightAddon && (
          <span className="slds-form-element__addon" id="fixed-text-addon-post">
            {rightAddon}
          </span>
        )}
        {!rightAddon && clearButton && (
          <button className="slds-button slds-button_icon slds-input__icon slds-input__icon_right" title="Clear" onClick={onClear}>
            <Icon type="utility" icon="clear" omitContainer className="slds-button__icon slds-icon-text-light" />
          </button>
        )}
      </div>
      {helpText && <div className="slds-form-element__help">{helpText}</div>}
      {hasError && errorMessage && (
        <div className="slds-form-element__help" id={errorMessageId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Input;

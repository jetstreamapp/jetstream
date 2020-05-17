/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import HelpText from './HelpText';
import Icon from './Icon';
import { IconType } from '../../types/types';

export interface InputProps {
  id?: string;
  label?: string;
  labelHelp?: string;
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
}

export const Input: FunctionComponent<InputProps> = ({
  id,
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
  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': hasError })}>
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
          {labelHelp && <HelpText id={`${id}-label-help-text`} />}
        </Fragment>
      )}
      <div
        className={classNames('slds-form-element__control', {
          'slds-input-has-icon': iconLeft || iconRight || clearButton,
          'slds-input-has-icon_left': iconLeft && !iconRight && !clearButton,
          'slds-input-has-icon_right': !iconLeft && (iconRight || clearButton),
          'slds-input-has-icon_left-right': (iconLeft && iconRight) || (iconLeft && clearButton),
          'slds-input-has-fixed-addon': leftAddon || rightAddon,
        })}
      >
        {iconLeft && iconLeftType && (
          <Icon
            omitContainer={true}
            type={iconLeftType}
            icon={iconLeft}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_left"
          />
        )}
        {iconRight && iconRightType && (
          <Icon
            omitContainer={true}
            type={iconRightType}
            icon={iconLeft}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_right"
          />
        )}
        {leftAddon && (
          <span className="slds-form-element__addon" id="fixed-text-addon-pre">
            leftAddon
          </span>
        )}
        {/* Input field must be passed through */}
        {children}
        {rightAddon && (
          <span className="slds-form-element__addon" id="fixed-text-addon-post">
            rightAddon
          </span>
        )}
        {clearButton && (
          <button className="slds-button slds-button_icon slds-input__icon slds-input__icon_right" title="Clear" onClick={onClear}>
            <Icon type="utility" icon="clear" omitContainer={true} className="slds-button__icon slds-icon-text-light" />
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

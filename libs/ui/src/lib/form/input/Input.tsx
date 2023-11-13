// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import { IconName, IconType } from '@jetstream/icon-factory';
import classNames from 'classnames';
import { Fragment, FunctionComponent, MouseEvent } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';

export interface InputProps {
  id?: string;
  className?: string;
  formControlClassName?: string;
  label?: string;
  hideLabel?: boolean;
  labelHelp?: string | JSX.Element | null;
  helpText?: React.ReactNode | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  iconLeft?: IconName;
  iconLeftType?: IconType;
  iconRight?: IconName;
  iconRightType?: IconType;
  leftAddon?: React.ReactNode | string;
  rightAddon?: React.ReactNode | string;
  clearButton?: boolean;
  onClear?: (ev?: MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
}

export const Input: FunctionComponent<InputProps> = ({
  id,
  className,
  formControlClassName,
  label,
  hideLabel = false,
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
    <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
      {label && (
        <Fragment>
          <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={id}>
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </label>
          {labelHelp && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        </Fragment>
      )}
      <div
        className={classNames(
          'slds-form-element__control',
          {
            'slds-input-has-icon': iconLeft || iconRight || clearButton,
            'slds-input-has-icon_left': !leftAddon && iconLeft && !iconRight && !clearButton,
            'slds-input-has-icon_right': !leftAddon && !iconLeft && (iconRight || clearButton),
            'slds-input-has-icon_left-right': (!leftAddon && !rightAddon && iconLeft && iconRight) || (iconLeft && clearButton),
            'slds-input-has-fixed-addon': leftAddon || rightAddon,
          },
          formControlClassName
        )}
      >
        {!leftAddon && iconLeft && iconLeftType && (
          <Icon
            omitContainer
            type={iconLeftType}
            icon={iconLeft}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_left"
          />
        )}
        {!rightAddon && iconRight && iconRightType && (
          <Icon
            omitContainer
            type={iconRightType}
            icon={iconRight}
            className="slds-icon slds-input__icon slds-icon-text-default slds-input__icon_right"
          />
        )}
        {leftAddon && <span className="slds-form-element__addon">{leftAddon}</span>}
        {/* Input field must be passed through */}
        {children}
        {rightAddon && <span className="slds-form-element__addon">{rightAddon}</span>}
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

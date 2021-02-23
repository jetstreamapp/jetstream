import { IconName } from '@jetstream/icon-factory';
import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';

export interface CheckboxButtonProps {
  id: string;
  className?: string;
  checkboxClassName?: string;
  checked: boolean;
  label: string;
  checkedLabel?: string;
  disabled?: boolean;
  icon: IconName;
  iconChecked?: IconName;
  onChange?: (value: boolean) => void;
}

export const CheckboxButton: FunctionComponent<CheckboxButtonProps> = ({
  id,
  className,
  checkboxClassName,
  checked,
  label,
  checkedLabel = label,
  icon,
  iconChecked = icon,
  disabled = false,
  onChange,
}) => {
  const currLabel = checked ? checkedLabel : label;
  const currIcon = checked ? iconChecked : icon;
  return (
    <label
      className={classNames(
        'slds-checkbox-button',
        {
          'slds-checkbox-button_is-checked': checked,
          'slds-checkbox-button_is-disabled': disabled,
        },
        className
      )}
      htmlFor={id}
    >
      <input
        type="checkbox"
        className={classNames('slds-assistive-text', checkboxClassName)}
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(!checked)}
      />
      <Icon
        type="utility"
        icon={currIcon}
        title={currLabel}
        containerClassname={`slds-icon_container slds-icon-utility-${currIcon} slds-current-color`}
        className="slds-icon slds-icon_x-small"
      />
    </label>
  );
};

export default CheckboxButton;

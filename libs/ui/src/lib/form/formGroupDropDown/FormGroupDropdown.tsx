import { IconName, UtilityIcon } from '@jetstream/icon-factory';
import { FormGroupDropdownItem } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import Icon from '../../widgets/Icon';

export interface FormGroupDropdownProps {
  className?: string;
  comboboxId: string;
  label: string;
  initialSelectedItemId?: string;
  items: FormGroupDropdownItem[];
  headingLabel?: string;
  variant?: 'start' | 'end';
  /**
   * Show icon instead of text for selected item
   */
  iconOnly?: boolean;
  onSelected?: (item: FormGroupDropdownItem) => void;
}

export const FormGroupDropdown: FunctionComponent<FormGroupDropdownProps> = ({
  className,
  comboboxId,
  label,
  initialSelectedItemId,
  items,
  headingLabel,
  variant = 'start',
  iconOnly,
  onSelected,
}) => {
  const [id] = useState(uniqueId('object-switcher'));
  const [inputId] = useState(uniqueId('object-switcher-input'));
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(
    () => (initialSelectedItemId && items.find((item) => item.id === initialSelectedItemId)) || items[0],
  );
  const selectedItemIcon = selectedItem.icon as UtilityIcon | undefined;

  function selectItem(item: FormGroupDropdownItem) {
    setSelectedItem(item);
    setIsOpen(false);
    if (onSelected) {
      onSelected(item);
    }
  }

  return (
    <OutsideClickHandler
      className={classNames(`slds-combobox_object-switcher slds-combobox-addon_${variant}`, className)}
      onOutsideClick={() => setIsOpen(false)}
    >
      <div className="slds-form-element">
        <label id={`${inputId}-label`} className="slds-form-element__label slds-assistive-text" htmlFor={inputId}>
          {label}
        </label>
        <div className="slds-form-element__control">
          <div className={classNames('slds-combobox_container', { 'slds-has-icon-only': !!iconOnly })}>
            <div
              className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
              aria-controls={comboboxId}
              onClick={() => setIsOpen(true)}
            >
              <div
                className={classNames('slds-combobox__form-element slds-input-has-icon', {
                  'slds-input-has-icon_right': !iconOnly,
                  'slds-input-has-icon_left-right': !!iconOnly,
                })}
                role="none"
              >
                {iconOnly && !!selectedItemIcon && (
                  <Icon
                    type="utility"
                    icon={selectedItemIcon}
                    containerClassname={`slds-icon_container slds-icon-utility-${selectedItemIcon} slds-input__icon slds-input__icon_left`}
                    className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                  />
                )}
                <div
                  role="combobox"
                  tabIndex={0}
                  className={classNames('slds-input_faux slds-combobox__input slds-combobox__input-value', { 'slds-has-focus': isOpen })}
                  aria-labelledby={`${inputId}-label`}
                  id={`${inputId}-selected-value`}
                  aria-controls={id}
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
                >
                  {selectedItem && <span className="slds-truncate">{selectedItem.label}</span>}
                </div>
                <Icon
                  type="utility"
                  icon="down"
                  containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
                  className="slds-icon slds-icon slds-icon_xx-small slds-icon-text-default"
                />
              </div>
              <div
                id={id}
                className={`slds-dropdown slds-dropdown_length-7 slds-dropdown_x-small slds-dropdown_${variant === 'end' ? 'right' : 'left'}`}
                role="listbox"
              >
                <ul className="slds-listbox slds-listbox_vertical" role="group">
                  {headingLabel && (
                    <li role="presentation" className="slds-listbox__item">
                      <div
                        id="option716"
                        className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small"
                        role="presentation"
                      >
                        <h3 className="slds-listbox__option-header" role="presentation">
                          {headingLabel}
                        </h3>
                      </div>
                    </li>
                  )}
                  {items.map((item) => (
                    <li
                      role="presentation"
                      className="slds-listbox__item slds-item"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectItem(item);
                      }}
                    >
                      <div
                        className={classNames('slds-media slds-listbox__option slds-listbox__option_plain slds-media_small', {
                          'slds-is-selected': item.id === selectedItem.id,
                        })}
                        aria-selected={item.id === selectedItem.id}
                        role="option"
                      >
                        <span className="slds-media__figure slds-listbox__option-icon">
                          {item.icon && (
                            <Icon
                              type="utility"
                              icon={item.icon as IconName}
                              containerClassname={classNames(`slds-icon_container slds-icon-utility-${item.icon} slds-current-color`)}
                              className="slds-icon slds-icon_x-small"
                            />
                          )}
                          {!item.icon && item.id === selectedItem.id && (
                            <Icon
                              type="utility"
                              icon="check"
                              containerClassname="slds-icon_container slds-icon-utility-check slds-current-color"
                              className="slds-icon slds-icon_x-small"
                            />
                          )}
                        </span>
                        <span className="slds-media__body">
                          <span className="slds-truncate" title={item.label}>
                            {item.label}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

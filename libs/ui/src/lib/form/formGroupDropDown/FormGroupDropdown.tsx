import { FormGroupDropdownItem } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, useState } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import Icon from '../../widgets/Icon';

export interface FormGroupDropdownProps {
  comboboxId: string;
  label: string;
  initialSelectedItemId?: string;
  items: FormGroupDropdownItem[];
  onSelected?: (item: FormGroupDropdownItem) => void;
}

export const FormGroupDropdown: FunctionComponent<FormGroupDropdownProps> = ({
  comboboxId,
  label,
  initialSelectedItemId,
  items,
  onSelected,
}) => {
  const [id] = useState(uniqueId('object-switcher'));
  const [inputId] = useState(uniqueId('object-switcher-input'));
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(
    () => (initialSelectedItemId && items.find((item) => item.id === initialSelectedItemId)) || items[0]
  );

  function selectItem(item: FormGroupDropdownItem) {
    setSelectedItem(item);
    setIsOpen(false);
    if (onSelected) {
      onSelected(item);
    }
  }

  return (
    <OutsideClickHandler className="slds-combobox_object-switcher slds-combobox-addon_start" onOutsideClick={() => setIsOpen(false)}>
      <div className="slds-form-element">
        <label className="slds-form-element__label slds-assistive-text" htmlFor={inputId}>
          {label}
        </label>
        <div className="slds-form-element__control">
          <div className="slds-combobox_container">
            <div
              className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
              aria-controls={comboboxId}
              onClick={() => setIsOpen(true)}
            >
              <div className="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
                <button
                  type="button"
                  className="slds-input_faux slds-combobox__input slds-combobox__input-value"
                  aria-labelledby={`${inputId} ${inputId}-button`}
                  id={`${inputId}-button`}
                  aria-controls={id}
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
                >
                  {selectedItem && <span className="slds-truncate">{selectedItem.label}</span>}
                </button>
                <Icon
                  type="utility"
                  icon="down"
                  containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
                  className="slds-icon slds-icon slds-icon_xx-small slds-icon-text-default"
                />
              </div>
              <div id={id} className="slds-dropdown slds-dropdown_length-7 slds-dropdown_x-small slds-dropdown_left" role="listbox">
                <ul className="slds-listbox slds-listbox_vertical" role="group">
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
                          {item.id === selectedItem.id && (
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

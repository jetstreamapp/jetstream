/* eslint-disable jsx-a11y/anchor-is-valid */
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, useMemo, useState, useEffect } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import Icon from '../../widgets/Icon';
import { ListItem } from '@jetstream/types';
import PicklistItem from './PicklistItem';
import Pill from '../../widgets/Pill';

export interface PicklistProps {
  containerClassName?: string; // e.x. slds-combobox_container slds-size_small
  label: string;
  placeholder?: string;
  items: ListItem[];
  selectedItems?: ListItem[]; // This only applies on initialization, then the component will manage ongoing state
  multiSelection?: boolean;
  allowDeselection?: boolean;
  scrollLength?: 5 | 7 | 10;
  onChange: (selectedItems: ListItem[]) => void;
}

export const Picklist: FunctionComponent<PicklistProps> = ({
  containerClassName,
  label,
  placeholder,
  items = [],
  selectedItems = [],
  multiSelection = false,
  allowDeselection = true,
  scrollLength,
  onChange,
}) => {
  const [comboboxId] = useState<string>(uniqueId('picklist'));
  const [listboxId] = useState<string>(uniqueId('listbox'));
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedItemText, setSelectedItemText] = useState<string>();
  const [selectedItemsSet, setSelectedItemsSet] = useState<Set<ListItem>>(new Set(selectedItems));
  const scrollLengthClass = useMemo<string | undefined>(() => (scrollLength ? `slds-dropdown_length-${scrollLength}` : undefined), [
    scrollLength,
  ]);

  useEffect(() => {
    if (selectedItemsSet.size > 1) {
      setSelectedItemText(`${selectedItemsSet.size} Options Selected`);
    } else if (selectedItemsSet.size === 1) {
      setSelectedItemText(Array.from(selectedItemsSet)[0].label);
    } else {
      setSelectedItemText('');
    }
  }, [selectedItemsSet]);

  function handleSelection(item: ListItem) {
    const hasItem = selectedItemsSet.has(item);
    if (hasItem && (selectedItemsSet.size > 1 || allowDeselection)) {
      selectedItemsSet.delete(item);
    } else {
      if (!multiSelection) {
        selectedItemsSet.clear();
        // if user clicked on new item in list, close
        if (!hasItem) {
          setIsOpen(false);
        }
      }
      selectedItemsSet.add(item);
    }

    setSelectedItemsSet(new Set(selectedItemsSet));
    onChange(Array.from(selectedItemsSet));
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)}>
      <div className="slds-form-element">
        <label className="slds-form-element__label" htmlFor={comboboxId}>
          {label}
        </label>
        <div className="slds-form-element__control">
          <div className={containerClassName || 'slds-combobox_container'}>
            <div
              className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
              aria-expanded={isOpen}
              aria-controls={comboboxId}
              aria-haspopup="listbox"
              role="combobox"
              onClick={() => setIsOpen(true)}
            >
              <div className="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
                <input
                  type="text"
                  className={classNames('slds-input slds-combobox__input slds-combobox__input-value', { 'slds-has-focus': isOpen })}
                  id={comboboxId}
                  aria-controls={listboxId}
                  autoComplete="off"
                  placeholder={placeholder}
                  readOnly
                  value={selectedItemText || ''}
                  title={selectedItemText}
                />
                <span className="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right">
                  <Icon
                    type="utility"
                    icon="down"
                    className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                    omitContainer={true}
                  />
                </span>
              </div>
              <div id={listboxId} className={classNames('slds-dropdown slds-dropdown_fluid', scrollLengthClass)} role="listbox">
                <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                  {items.map((item) => (
                    <PicklistItem
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      value={item.value}
                      isSelected={selectedItemsSet.has(item)}
                      onClick={() => handleSelection(item)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          </div>
          {multiSelection && selectedItemsSet.size > 0 && (
            <div className="slds-listbox_selection-group">
              <ul
                className="slds-listbox slds-listbox_horizontal"
                role="listbox"
                aria-label="Selected Options:"
                aria-orientation="horizontal"
              >
                <li className="slds-listbox-item" role="presentation">
                  {Array.from(selectedItemsSet).map((item) => (
                    <Pill label={item.label} onRemove={() => handleSelection(item)} />
                  ))}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Picklist;

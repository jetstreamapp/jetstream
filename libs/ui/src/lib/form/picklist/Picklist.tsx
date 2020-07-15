/* eslint-disable jsx-a11y/anchor-is-valid */
import { ListItem, ListItemGroup } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import Icon from '../../widgets/Icon';
import Pill from '../../widgets/Pill';
import PicklistItem from './PicklistItem';
import HelpText from '../../widgets/HelpText';

export interface PicklistProps {
  containerClassName?: string; // e.x. slds-combobox_container slds-size_small
  label: string;
  helpText?: string;
  placeholder?: string;
  items: ListItem[];
  groups?: ListItemGroup[];
  selectedItems?: ListItem[]; // This only applies on initialization, then the component will manage ongoing state
  selectedItemIds?: string[]; // This only applies on initialization, will be ignored if selectedItems is provided
  multiSelection?: boolean;
  allowDeselection?: boolean;
  scrollLength?: 5 | 7 | 10;
  disabled?: boolean;
  onChange: (selectedItems: ListItem[]) => void;
}

export const Picklist: FunctionComponent<PicklistProps> = ({
  containerClassName,
  label,
  helpText,
  placeholder,
  items,
  groups,
  selectedItems = [],
  selectedItemIds = [],
  multiSelection = false,
  allowDeselection = true,
  scrollLength,
  disabled,
  onChange,
}) => {
  const [comboboxId] = useState<string>(uniqueId('picklist'));
  const [listboxId] = useState<string>(uniqueId('listbox'));
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedItemText, setSelectedItemText] = useState<string>();
  const [selectedItemsIdsSet, setSelectedItemsIdsSet] = useState<Set<unknown>>(() => {
    let selectedItemIdsSet = new Set();
    if (selectedItems && selectedItems.length > 0) {
      selectedItemIdsSet = new Set(selectedItems.map((item) => item.id));
    } else if (selectedItemIds && selectedItemIds.length > 0) {
      selectedItemIdsSet = new Set(selectedItemIds);
    }
    return selectedItemIdsSet;
  });
  const scrollLengthClass = useMemo<string | undefined>(() => (scrollLength ? `slds-dropdown_length-${scrollLength}` : undefined), [
    scrollLength,
  ]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  useEffect(() => {
    if (selectedItemsIdsSet.size > 1) {
      setSelectedItemText(`${selectedItemsIdsSet.size} Options Selected`);
    } else if (selectedItemsIdsSet.size === 1) {
      const foundItem = items.find((item) => selectedItemsIdsSet.has(item.id));
      if (foundItem) {
        setSelectedItemText(foundItem.label);
      } else {
        setSelectedItemText('');
      }
    } else {
      setSelectedItemText('');
    }
  }, [selectedItemsIdsSet, items]);

  function handleSelection(item: ListItem) {
    const hasItem = selectedItemsIdsSet.has(item.id);
    if (hasItem && (selectedItemsIdsSet.size > 1 || allowDeselection)) {
      selectedItemsIdsSet.delete(item.id);
    } else {
      if (!multiSelection) {
        selectedItemsIdsSet.clear();
        // if user clicked on new item in list, close
        if (!hasItem) {
          setIsOpen(false);
        }
      }
      selectedItemsIdsSet.add(item.id);
    }

    setSelectedItemsIdsSet(new Set(selectedItemsIdsSet));
    onChange(items.filter((item) => selectedItemsIdsSet.has(item.id)));
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)}>
      <div className="slds-form-element">
        <label className="slds-form-element__label" htmlFor={comboboxId}>
          {label}
        </label>
        {helpText && <HelpText id={`${comboboxId}-label-help-text`} content={helpText} />}
        <div className="slds-form-element__control">
          <div className={containerClassName || 'slds-combobox_container'}>
            <div
              className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
              aria-expanded={isOpen}
              aria-controls={comboboxId}
              aria-haspopup="listbox"
              role="combobox"
              onClick={() => !disabled && setIsOpen(true)}
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
                  disabled={disabled}
                />
                <span className="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right">
                  <Icon type="utility" icon="down" className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default" omitContainer />
                </span>
              </div>
              <div
                id={listboxId}
                className={classNames('slds-dropdown slds-dropdown_fluid slds-dropdown_length-7', scrollLengthClass)}
                role="listbox"
              >
                {Array.isArray(items) && (
                  <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                    {items.map((item) => (
                      <PicklistItem
                        key={item.id}
                        id={item.id}
                        label={item.label}
                        secondaryLabel={item.secondaryLabel}
                        value={item.value}
                        isSelected={selectedItemsIdsSet.has(item.id)}
                        onClick={() => handleSelection(item)}
                      />
                    ))}
                  </ul>
                )}
                {Array.isArray(groups) &&
                  groups.map((group) => (
                    <ul key={group.id} className="slds-listbox slds-listbox_vertical" role="group" aria-label={group.label}>
                      <li role="presentation" className="slds-listbox__item">
                        <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="presentation">
                          <h3 className="slds-listbox__option-header" role="presentation">
                            {group.label}
                          </h3>
                        </div>
                      </li>
                      {group.items.map((item) => (
                        <PicklistItem
                          key={item.id}
                          id={item.id}
                          label={item.label}
                          value={item.value}
                          isSelected={selectedItemsIdsSet.has(item.id)}
                          onClick={() => handleSelection(item)}
                        />
                      ))}
                    </ul>
                  ))}
              </div>
            </div>
          </div>
          {multiSelection && selectedItemsIdsSet.size > 0 && (
            <div className="slds-listbox_selection-group">
              <ul
                className="slds-listbox slds-listbox_horizontal"
                role="listbox"
                aria-label="Selected Options:"
                aria-orientation="horizontal"
              >
                <li className="slds-listbox-item" role="presentation">
                  {items
                    .filter((item) => selectedItemsIdsSet.has(item.id))
                    .map((item) => (
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

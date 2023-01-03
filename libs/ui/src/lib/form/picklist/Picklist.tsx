/* eslint-disable jsx-a11y/anchor-is-valid */
import { IconName } from '@jetstream/icon-factory';
import {
  hasCtrlModifierKey,
  hasShiftModifierKey,
  isAKey,
  isArrowDownKey,
  isArrowUpKey,
  isControlKey,
  isEnterKey,
  isEscapeKey,
  isShiftKey,
  isTabKey,
  KeyBuffer,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
  trapEventImmediate,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { DropDownItemLength, ListItem, ListItemGroup } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import uniqueId from 'lodash/uniqueId';
import React, { createRef, forwardRef, KeyboardEvent, RefObject, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Pill from '../../widgets/Pill';
import PicklistItem from './PicklistItem';

export interface PicklistRef {
  selectItem: (id: string) => void;
}

export interface PicklistProps {
  id?: string;
  className?: string; // form-control classname
  containerClassName?: string; // e.x. slds-combobox_container slds-size_small
  dropdownIcon?: IconName;
  // choose contents to ensure full width display
  containerDisplay?: 'block' | 'flex' | 'inline' | 'inline-block' | 'contents';
  label: string;
  hideLabel?: boolean;
  labelHelp?: string;
  helpText?: React.ReactNode | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  placeholder?: string;
  items?: ListItem[];
  groups?: ListItemGroup[];
  selectedItems?: ListItem[]; // This only applies on initialization, then the component will manage ongoing state
  selectedItemIds?: string[]; // This only applies on initialization, will be ignored if selectedItems is provided
  multiSelection?: boolean;
  omitMultiSelectPills?: boolean;
  allowDeselection?: boolean;
  scrollLength?: DropDownItemLength;
  disabled?: boolean;
  onChange: (selectedItems: ListItem[]) => void;
  onBlur?: () => void;
}

export const Picklist = forwardRef<any, PicklistProps>(
  (
    {
      id,
      className,
      containerClassName,
      dropdownIcon = 'down',
      containerDisplay,
      label,
      hideLabel,
      labelHelp,
      helpText,
      hasError,
      isRequired,
      errorMessageId,
      errorMessage,
      placeholder,
      items,
      groups,
      selectedItems = [],
      selectedItemIds = [],
      multiSelection = false,
      omitMultiSelectPills = false,
      allowDeselection = true,
      scrollLength,
      disabled,
      onChange,
      onBlur,
    },
    ref
  ) => {
    const keyBuffer = useRef(new KeyBuffer());
    const [comboboxId] = useState<string>(() => uniqueId(id || 'picklist'));
    const [listboxId] = useState<string>(() => uniqueId('listbox'));
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
    const scrollLengthClass = useMemo(() => `slds-dropdown_length-${scrollLength || 5}`, [scrollLength]);
    const [focusedItem, setFocusedItem] = useState<number>(null);
    const divContainerEl = useRef<HTMLDivElement>(null);
    const elRefs = useRef<RefObject<HTMLLIElement>[]>([]);

    // populate array of refs of child items for keyboard navigation
    if (elRefs.current.length !== items.length) {
      const refs: RefObject<HTMLLIElement>[] = [];
      items.forEach((item, i) => {
        refs[i] = elRefs[i] || createRef();
      });
      // add or remove refs
      elRefs.current = refs;
    }

    useEffect(() => {
      setFocusedItem(null);
    }, [items]);

    useNonInitialEffect(() => {
      if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
        try {
          elRefs.current[focusedItem].current.focus();

          menuItemSelectScroll({
            container: divContainerEl.current,
            focusedIndex: focusedItem,
          });
        } catch (ex) {
          // silent failure
        }
      }
    }, [focusedItem]);

    useEffect(() => {
      if (disabled && isOpen) {
        setIsOpen(false);
      }
    }, [disabled, isOpen]);

    useNonInitialEffect(() => {
      onChange(items.filter((item) => selectedItemsIdsSet.has(item.id)));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItemsIdsSet]);

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

    useImperativeHandle(ref, () => {
      const filterComp: PicklistRef = {
        selectItem: (id: string) => {
          if (!selectedItemsIdsSet.has(id)) {
            handleSelectionById(id);
          }
        },
      };
      return filterComp;
    });

    function handleSelection({ id }: ListItem) {
      handleSelectionById(id);
    }

    function handleSelectionById(id: string) {
      const hasItem = selectedItemsIdsSet.has(id);
      if (hasItem && (selectedItemsIdsSet.size > 1 || allowDeselection)) {
        selectedItemsIdsSet.delete(id);
      } else {
        if (multiSelection) {
          // Handle empty item (e.x. --None--) - should not be selected with other items
          if (id === '') {
            selectedItemsIdsSet.clear();
          } else if (selectedItemsIdsSet.has('')) {
            selectedItemsIdsSet.delete('');
          }
        } else {
          selectedItemsIdsSet.clear();
          // if user clicked on new item in list, close
          if (!hasItem) {
            setIsOpen(false);
          }
        }
        selectedItemsIdsSet.add(id);
      }

      setSelectedItemsIdsSet(new Set(selectedItemsIdsSet));
    }

    function handleKeyboardSelection(
      item: ListItem,
      options: {
        ctrlModifier?: boolean;
        shiftModifier?: boolean;
        isAKey?: boolean;
      }
    ) {
      const { ctrlModifier, shiftModifier, isAKey } = options;

      if (multiSelection) {
        if (ctrlModifier && isAKey) {
          // toggle select/de-select all
          const newSelectedItemIdSet = selectedItemsIdsSet.size === items.length ? new Set() : new Set(items.map((item) => item.id));
          setSelectedItemsIdsSet(newSelectedItemIdSet);
        } else if (shiftModifier) {
          // when shift is pressed, then select or unselect current item and leave all others selected
          if (selectedItemsIdsSet.has(item.id)) {
            selectedItemsIdsSet.delete(item.id);
          } else {
            selectedItemsIdsSet.add(item.id);
          }
          setSelectedItemsIdsSet(new Set(selectedItemsIdsSet));
        } else {
          setSelectedItemsIdsSet(new Set([item.id]));
        }
      } else {
        setSelectedItemsIdsSet(new Set([item.id]));
      }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      let newFocusedItem = focusedItem;
      if (isControlKey(event) || isShiftKey(event)) {
        return;
      } else if (isTabKey(event) || isEscapeKey(event) || isEnterKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        return;
      }

      if (!isOpen) {
        setIsOpen(true);
      }
      if (isArrowDownKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        trapEventImmediate(event);
        if (!isNumber(focusedItem) || focusedItem === items.length - 1) {
          newFocusedItem = 0;
        } else {
          newFocusedItem = newFocusedItem + 1;
        }
      } else if (isArrowUpKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        trapEventImmediate(event);
        if (!isNumber(focusedItem) || focusedItem === 0) {
          newFocusedItem = items.length - 1;
        } else {
          newFocusedItem = newFocusedItem - 1;
        }
      } else {
        let allItems: ListItem[] = [];
        if (Array.isArray(items)) {
          allItems = items;
        } else if (Array.isArray(groups)) {
          groups.forEach((group) => {
            allItems = allItems.concat(group.items);
          });
        }

        // allow user to use keyboard to navigate to a specific item in the list by typing words
        newFocusedItem = selectMenuItemFromKeyboard({
          key: event.key,
          keyCode: event.keyCode,
          keyBuffer: keyBuffer.current,
          items: allItems,
          labelProp: 'label',
        });
      }

      if (isNumber(newFocusedItem)) {
        setFocusedItem(newFocusedItem);
        const item = items[newFocusedItem];

        handleKeyboardSelection(item, {
          ctrlModifier: hasCtrlModifierKey(event),
          shiftModifier: hasShiftModifierKey(event),
          isAKey: isAKey(event),
        });
      }
    }

    function handleInputClick() {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    }

    return (
      <OutsideClickHandler display={containerDisplay} onOutsideClick={() => setIsOpen(false)}>
        <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
          <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={comboboxId}>
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </label>
          {labelHelp && <HelpText id={`${comboboxId}-label-help-text`} content={labelHelp} />}
          <div className="slds-form-element__control" ref={divContainerEl}>
            <div className={containerClassName || 'slds-combobox_container'}>
              <div
                className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
                aria-expanded={isOpen}
                aria-controls={comboboxId}
                aria-haspopup="listbox"
                role="combobox"
                onClick={handleInputClick}
              >
                <div className="slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right" role="none">
                  <input
                    type="text"
                    className={classNames('slds-input slds-combobox__input slds-combobox__input-value', { 'slds-has-focus': isOpen })}
                    id={comboboxId}
                    aria-controls={listboxId}
                    aria-describedby={errorMessageId}
                    autoComplete="off"
                    placeholder={placeholder}
                    readOnly
                    value={selectedItemText || ''}
                    title={selectedItemText}
                    disabled={disabled}
                    onKeyUp={handleKeyDown}
                    onBlur={onBlur}
                  />
                  <span className="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right">
                    <Icon
                      type="utility"
                      icon={dropdownIcon}
                      className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                      omitContainer
                    />
                  </span>
                </div>
                {isOpen && (
                  <div
                    id={listboxId}
                    className={classNames('slds-dropdown slds-dropdown_fluid', scrollLengthClass)}
                    role="listbox"
                    onKeyDown={handleKeyDown}
                  >
                    {Array.isArray(items) && (
                      <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                        {items.map((item, i) => (
                          <PicklistItem
                            ref={elRefs.current[i]}
                            key={item.id}
                            id={item.id}
                            label={item.label}
                            secondaryLabel={item.secondaryLabel}
                            title={item.title}
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
                          <li role="presentation" className="slds-listbox__item slds-item">
                            <div
                              className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small"
                              role="presentation"
                            >
                              <h3 className="slds-listbox__option-header" role="presentation">
                                {group.label}
                              </h3>
                            </div>
                          </li>
                          {group.items.map((item, i) => (
                            <PicklistItem
                              ref={elRefs.current[i]}
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
                )}
              </div>
            </div>
            {multiSelection && !omitMultiSelectPills && selectedItemsIdsSet.size > 0 && (
              <div className="slds-listbox_selection-group">
                <ul
                  className="slds-listbox slds-listbox_horizontal"
                  role="listbox"
                  aria-label="Selected Options:"
                  aria-orientation="horizontal"
                >
                  {items
                    .filter((item) => selectedItemsIdsSet.has(item.id))
                    .map((item) => (
                      <li key={item.id} className="slds-listbox-item" role="presentation">
                        <Pill title={item.label} onRemove={() => handleSelection(item)}>
                          {item.label}
                        </Pill>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          {helpText && <div className="slds-form-element__help">{helpText}</div>}
          {hasError && errorMessage && (
            <div className="slds-form-element__help" id={errorMessageId}>
              {errorMessage}
            </div>
          )}
        </div>
      </OutsideClickHandler>
    );
  }
);

export default Picklist;

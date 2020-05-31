import React, { FunctionComponent, useState, useEffect } from 'react';
import uniqueId from 'lodash/uniqueId';
import Icon from '../../widgets/Icon';
import classNames from 'classnames';
import Spinner from '../../widgets/Spinner';
import OutsideClickHandler from '../../utils/OutsideClickHandler';

export interface ComboboxProps {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  hasGroups?: boolean;
  selectedItemLabel?: string; // used for text
  selectedItemTitle?: string; // used for text
  onInputChange?: (value: string) => void;
}

export const Combobox: FunctionComponent<ComboboxProps> = ({
  label,
  disabled,
  loading,
  hasGroups,
  selectedItemLabel,
  selectedItemTitle,
  children,
  onInputChange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [id] = useState<string>(uniqueId('Combobox'));
  const [listId] = useState<string>(uniqueId('Combobox-list'));
  const [value, setValue] = useState<string>('');

  // when closed, set input value in case user modified
  useEffect(() => {
    if (isOpen) {
      setValue('');
    } else {
      setValue(selectedItemLabel || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // close on selection
  useEffect(() => {
    if (selectedItemLabel) {
      setIsOpen(false);
      setValue(selectedItemLabel || '');
    }
  }, [selectedItemLabel]);

  // TODO: down or enter should open after has focus
  // TODO: keyboard navigation, including enter to select
  // TODO: escape OR outside click to close
  // TODO: single and multi-selection (maybe have two components for this because the UI is very different)
  // TODO: auto-complete list (could be another component and have a base component) (ex. filter when user types, could also load more)
  // TODO: possible multi-selection with checkboxes (not recommended)
  // TODO: menu in front of item (e.x. we could use this with query filters)
  // TODO: show text of selected item!!!!!! (e.x. in expression drop-down)

  return (
    <div className="slds-form-element">
      <label className="slds-form-element__label" htmlFor={id}>
        {label}
      </label>
      <div className="slds-form-element__control">
        <OutsideClickHandler className="slds-combobox_container" onOutsideClick={() => setIsOpen(false)}>
          <div
            className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listId}
            role="combobox"
            onClick={() => setIsOpen(true)}
          >
            <div
              className={classNames('slds-combobox__form-element', ' slds-input-has-icon', {
                'slds-input-has-icon_right': !loading,
                'slds-input-has-icon_group-right': loading,
              })}
              role="none"
            >
              <input
                type="text"
                className="slds-input slds-combobox__input"
                id={id}
                aria-controls={listId}
                autoComplete="off"
                placeholder="Select an Option"
                disabled={disabled}
                onKeyUp={(event) => onInputChange && onInputChange(event.currentTarget.value)}
                onChange={(event) => setValue(event.target.value)}
                value={value}
                title={selectedItemTitle || value}
              />

              {loading && (
                <div className="slds-input__icon-group slds-input__icon-group_right">
                  <Spinner className="slds-spinner slds-spinner_brand slds-spinner_x-small slds-input__spinner" size="x-small" />
                  <Icon
                    type="utility"
                    icon="down"
                    className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                    containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
                  />
                </div>
              )}
              {!loading && (
                <Icon
                  type="utility"
                  icon="down"
                  className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
                  containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
                />
              )}
            </div>
            <div id={listId} className="slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid" role="listbox">
              {hasGroups && children}
              {!hasGroups && (
                <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                  {children}
                </ul>
              )}
            </div>
          </div>
        </OutsideClickHandler>
      </div>
    </div>
  );
};

export default Combobox;

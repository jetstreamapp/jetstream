import isString from 'lodash/isString';
import React, { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';
import classNames from 'classnames';

export interface ComboboxListItemProps {
  id: string;
  label?: string; // can pass in children instead to override the complete media body
  title?: string; // fallback to label is label is a string
  selected: boolean;
  disabled?: boolean;
  onSelection: (id: string) => void;
}

export const ComboboxListItem: FunctionComponent<ComboboxListItemProps> = ({
  id,
  label,
  title,
  selected,
  disabled,
  onSelection,
  children,
}) => {
  title = title || (isString(label) ? label : undefined);
  return (
    <li role="presentation" className="slds-listbox__item" onClick={() => onSelection(id)}>
      <div
        id={id}
        aria-disabled={disabled}
        // TODO: ass slds-has-focus when item is focused
        className={classNames('slds-media slds-listbox__option slds-listbox__option_plain slds-media_small', {
          'slds-is-selected': selected,
        })}
        aria-selected={selected}
        role="option"
      >
        <span className="slds-media__figure slds-listbox__option-icon">
          {selected && (
            <Icon
              type="utility"
              icon="check"
              className="slds-icon slds-icon_x-small"
              containerClassname={classNames('slds-icon_container slds-icon-utility-check slds-current-color', {
                'slds-icon_disabled': disabled,
              })}
            />
          )}
        </span>
        <span className="slds-media__body">
          {label && (
            <span className="slds-truncate" title={title}>
              {selected && <span className="slds-assistive-text">Current Selection: </span>}
              {label}
            </span>
          )}
          {children}
        </span>
      </div>
    </li>
  );
};

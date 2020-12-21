import classNames from 'classnames';
import React, { forwardRef } from 'react';
import Icon from '../../widgets/Icon';

export interface ComboboxListItemProps {
  id: string;
  label?: string; // can pass in children instead to override the complete media body
  secondaryLabel?: string;
  title?: string; // fallback to label is label is a string
  selected: boolean;
  disabled?: boolean;
  hasError?: boolean;
  onSelection: (id: string) => void;
  children?: React.ReactNode; // required because forwardRef
}

export const ComboboxListItem = forwardRef<HTMLLIElement, ComboboxListItemProps>(
  ({ id, label, secondaryLabel, title, selected, disabled, hasError, onSelection, children }, ref) => {
    const backupTitle = `${label || ''} ${secondaryLabel || ''}`;
    title = title || backupTitle;
    return (
      <li ref={ref} role="presentation" className="slds-listbox__item slds-item" onClick={() => onSelection(id)} tabIndex={-1}>
        <div
          id={id}
          aria-disabled={disabled}
          className={classNames('slds-media slds-listbox__option slds-listbox__option_plain slds-media_small', {
            'slds-is-selected': selected,
            'slds-text-color_error': hasError,
          })}
          role="option"
          aria-selected={selected}
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
                {label}
                {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
              </span>
            )}
            {children}
          </span>
        </div>
      </li>
    );
  }
);

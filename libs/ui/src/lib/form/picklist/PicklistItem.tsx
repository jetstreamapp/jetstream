/* eslint-disable jsx-a11y/anchor-is-valid */
import classNames from 'classnames';
import React, { forwardRef } from 'react';
import Icon from '../../widgets/Icon';

export interface PicklistItemProps {
  id: string;
  label: string;
  secondaryLabel?: string;
  value: string;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export const PicklistItem = forwardRef<HTMLLIElement, PicklistItemProps>(
  ({ id, label, secondaryLabel, value, isSelected, onClick }, ref) => {
    return (
      <li
        ref={ref}
        role="presentation"
        className="slds-listbox__item"
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick(id);
        }}
      >
        <div
          id={id}
          className={classNames('slds-media slds-listbox__option slds-listbox__option_plain slds-media_small', {
            'slds-is-selected': isSelected,
          })}
          role="option"
          aria-selected={isSelected}
        >
          <span className="slds-media__figure slds-listbox__option-icon">
            {isSelected && (
              <Icon
                type="utility"
                icon="check"
                className="slds-icon slds-icon_x-small"
                containerClassname="slds-icon_container slds-icon-utility-check slds-current-color"
              />
            )}
          </span>
          <span className="slds-media__body">
            <span className="slds-truncate" title={`${label || ''} ${secondaryLabel || ''}`}>
              {label}
              {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
            </span>
          </span>
        </div>
      </li>
    );
  }
);

export default PicklistItem;

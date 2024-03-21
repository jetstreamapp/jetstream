/* eslint-disable jsx-a11y/anchor-is-valid */
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import { Fragment, forwardRef } from 'react';
import Icon from '../../widgets/Icon';

export interface PicklistItemProps {
  id: string;
  label: string;
  secondaryLabel?: Maybe<string>;
  secondaryLabelOnNewLine?: Maybe<boolean>;
  value: string;
  title?: Maybe<string>;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export const PicklistItem = forwardRef<HTMLLIElement, PicklistItemProps>(
  ({ id, label, secondaryLabel, secondaryLabelOnNewLine, value, title, isSelected, onClick }, ref) => {
    return (
      <li
        ref={ref}
        role="presentation"
        className="slds-listbox__item slds-item"
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick(id);
        }}
      >
        <div
          id={id}
          className={classNames('slds-listbox__option slds-media slds-media_center', {
            'slds-is-selected': isSelected,
            'slds-listbox__option_plain': !secondaryLabelOnNewLine,
            'slds-media_center slds-listbox__option_entity': secondaryLabelOnNewLine && secondaryLabel,
            'slds-media_small': !secondaryLabelOnNewLine,
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
            {/* <span className="slds-truncate" title={title || `${label || ''} ${secondaryLabel || ''}`}>
              {label}
              {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
            </span> */}
            {label && (!secondaryLabel || !secondaryLabelOnNewLine) && (
              <span className={classNames('slds-truncate')}>
                <span>{label}</span>
                {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
              </span>
            )}
            {label && secondaryLabel && secondaryLabelOnNewLine && (
              <Fragment>
                <div className="slds-listbox__option-text slds-listbox__option-text_entity">{label}</div>
                <div className="slds-listbox__option-meta slds-listbox__option-meta_entity slds-truncate" title={secondaryLabel}>
                  {secondaryLabel}
                </div>
              </Fragment>
            )}
          </span>
        </div>
      </li>
    );
  }
);

export default PicklistItem;

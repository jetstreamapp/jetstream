import { css } from '@emotion/react';
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
  ({ id, label, secondaryLabel, secondaryLabelOnNewLine, isSelected, onClick }, ref) => {
    return (
      // Keyboard activation (Enter/Space) and arrow navigation are handled once on the listbox
      // container (Picklist.handleKeyDown); oxlint does not recognise interactive ARIA roles here
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <li
        ref={ref}
        // The li receives focus during arrow-key navigation, so it carries the option semantics —
        // with role="presentation" here, screen readers announced nothing (same fix as ComboboxListItem)
        role="option"
        aria-selected={isSelected}
        className="slds-listbox__item slds-item"
        tabIndex={-1}
        css={css`
          /* Inset outline: Safari paints no default focus ring on li, and an outline drawn outside
             the element is clipped by the dropdown's scroll container and rounded corners */
          &:focus-visible {
            outline: 2px solid var(--slds-g-color-brand-base-50, #0176d3);
            outline-offset: -2px;
          }
        `}
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
                <div className="slds-listbox__option-meta">
                  <div title={secondaryLabel} className="slds-truncate">
                    {secondaryLabel}
                  </div>
                </div>
              </Fragment>
            )}
          </span>
        </div>
      </li>
    );
  },
);

export default PicklistItem;

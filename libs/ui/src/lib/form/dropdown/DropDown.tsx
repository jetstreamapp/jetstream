/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { FunctionComponent, useState, useMemo, Fragment } from 'react';
import classNames from 'classnames';
import isString from 'lodash/isString';
import Icon from '../../widgets/Icon';
import { IconObj } from '@jetstream/types';
import OutsideClickHandler from '../../utils/OutsideClickHandler';

export interface DropDownProps {
  position?: 'left' | 'right';
  leadingIcon?: IconObj;
  buttonClassName?: string;
  dropDownClassName?: string;
  actionText?: string;
  scrollLength?: 5 | 7 | 10;
  description?: string; // assistive text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: { id: string; subheader?: string; value: string | JSX.Element; icon?: IconObj; metadata?: any }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelected: (id: string, metadata?: any) => void;
}

export const DropDown: FunctionComponent<DropDownProps> = ({
  position = 'left',
  leadingIcon,
  buttonClassName,
  dropDownClassName,
  actionText = 'action',
  scrollLength,
  items,
  description,
  onSelected,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const scrollLengthClass = useMemo<string | undefined>(() => (scrollLength ? `slds-dropdown_length-${scrollLength}` : undefined), [
    scrollLength,
  ]);

  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)}>
      <div className={classNames('slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}>
        <button
          className={buttonClassName || 'slds-button slds-button_icon slds-button_icon-border-filled'}
          aria-haspopup="true"
          title={actionText}
          onClick={() => setIsOpen(!isOpen)}
        >
          {leadingIcon && <Icon type={leadingIcon.type} icon={leadingIcon.icon} className="slds-button__icon" omitContainer />}
          <Icon
            type="utility"
            icon="down"
            className={classNames('slds-button__icon', {
              'slds-button__icon_hint slds-button__icon_small': !leadingIcon,
              'slds-button__icon_x-small': !!leadingIcon,
            })}
            omitContainer={!!leadingIcon}
            description={actionText}
          />
          {description && <span className="slds-assistive-text">{description}</span>}
        </button>
        <div
          className={classNames(
            'slds-dropdown',
            {
              'slds-dropdown_left': position === 'left',
              'slds-dropdown_right': position === 'right',
            },
            scrollLengthClass,
            dropDownClassName
          )}
        >
          <ul className="slds-dropdown__list" role="menu" aria-label={actionText}>
            {items.map(({ id, subheader, value, icon, metadata }) => (
              <Fragment key={id}>
                {subheader && (
                  <li className="slds-dropdown__header slds-truncate" title={subheader} role="separator">
                    <span>{subheader}</span>
                  </li>
                )}
                <li className="slds-dropdown__item" role="presentation">
                  <a
                    role="menuitem"
                    tabIndex={0}
                    onClick={(event) => {
                      event.preventDefault();
                      onSelected(id, metadata);
                    }}
                  >
                    {isString(value) ? (
                      <span className="slds-truncate" title={value}>
                        {icon && (
                          <Icon
                            type={icon.type}
                            icon={icon.icon}
                            description={icon.description}
                            omitContainer
                            className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                          />
                        )}
                        {value}
                      </span>
                    ) : (
                      value
                    )}
                  </a>
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default DropDown;

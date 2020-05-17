/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import Icon from './Icon';
import { Link } from 'react-router-dom';

export interface NavBarMenuItemProps {
  items: { id: string; label: string | JSX.Element; title: string; path: string }[];
}

export const NavBarMenuItem: FunctionComponent<NavBarMenuItemProps> = ({ items }) => {
  return (
    <li className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click">
      {/* eslint-disable-next-line */}
      <a href="javascript:void(0);" className="slds-context-bar__label-action" title="Menu Item">
        <span className="slds-truncate" title="Menu Item">
          Menu Item
        </span>
      </a>
      <div className="slds-context-bar__icon-action slds-p-left_none">
        <button
          className="slds-button slds-button_icon slds-button_icon slds-context-bar__button"
          aria-haspopup="true"
          title="Open menu item submenu"
        >
          <Icon
            type="utility"
            icon="add"
            className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
            omitContainer={true}
          />
          <span className="slds-assistive-text">Open menu item</span>
        </button>
      </div>
      <div className="slds-dropdown slds-dropdown_right">
        <ul className="slds-dropdown__list" role="menu">
          {items.map((item) => (
            <li className="slds-dropdown__item" role="presentation">
              <Link tabIndex={-1} role="menuitem" className="slds-button slds-button_brand" to={{ pathname: item.path }}>
                <span className="slds-truncate" title={item.title}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
};

export default NavBarMenuItem;

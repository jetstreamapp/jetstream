/** @jsx jsx */
import { jsx } from '@emotion/react';
import { FunctionComponent, useState, Fragment } from 'react';
import Icon from '../widgets/Icon';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import OutsideClickHandler from '../utils/OutsideClickHandler';

export type NabarMenuItem = NabarMenuItemLink | NabarMenuItemAction;

interface NabarMenuItemBase {
  id: string;
  heading?: string;
  label: string | JSX.Element;
  title: string;
}

export interface NabarMenuItemLink extends NabarMenuItemBase {
  path: string;
}

export interface NabarMenuItemAction extends NabarMenuItemBase {
  action: (id: string) => void;
}

// TODO: allow actions, headers and dividers

export interface NavbarMenuItemsProps {
  label: string;
  // Optional path for parent item
  path?: string;
  items: NabarMenuItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLink(item: any): item is NabarMenuItemLink {
  return !!item.path;
}

// slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open

export const NavbarMenuItems: FunctionComponent<NavbarMenuItemsProps> = ({ label, path, items }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  return (
    <li
      className={classNames('slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click', {
        'slds-is-open': isOpen,
      })}
    >
      <OutsideClickHandler onOutsideClick={() => setIsOpen(false)} display="contents">
        {path && (
          <Link className="slds-context-bar__label-action" title={label} to={{ pathname: path }}>
            <span className="slds-truncate" title={label}>
              {label}
            </span>
          </Link>
        )}
        {!path && (
          <button className="slds-button slds-context-bar__label-action" title={label} onClick={() => setIsOpen(!isOpen)}>
            <span className="slds-truncate" title={label}>
              {label}
            </span>
          </button>
        )}

        <div className="slds-context-bar__icon-action slds-p-left_none">
          <button
            className="slds-button slds-button_icon slds-button_icon slds-context-bar__button"
            aria-haspopup="true"
            title="Open menu item submenu"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Icon
              type="utility"
              icon="chevrondown"
              className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
              omitContainer
            />
            <span className="slds-assistive-text">Open menu item</span>
          </button>
        </div>
        <div className="slds-dropdown slds-dropdown_right">
          <ul className="slds-dropdown__list" role="menu">
            {items.map((item) => (
              <Fragment key={item.id}>
                {item.heading && (
                  <li className="slds-dropdown__header slds-has-divider_top-space" role="separator">
                    {item.heading}
                  </li>
                )}
                <li className="slds-dropdown__item" role="presentation">
                  {isLink(item) && (
                    <Link tabIndex={-1} role="menuitem" to={{ pathname: item.path }}>
                      <span className="slds-truncate" title={item.title}>
                        {item.label}
                      </span>
                    </Link>
                  )}
                  {!isLink(item) && (
                    // eslint-disable-next-line jsx-a11y/anchor-is-valid
                    <a tabIndex={-1} role="menuitem" onClick={() => item.action(item.id)}>
                      <span className="slds-truncate" title={item.title}>
                        {item.label}
                      </span>
                    </a>
                  )}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      </OutsideClickHandler>
    </li>
  );
};

export default NavbarMenuItems;

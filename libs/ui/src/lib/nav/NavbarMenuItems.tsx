import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import OutsideClickHandler from '../utils/OutsideClickHandler';
import Icon from '../widgets/Icon';

export type NabarMenuItem = NabarMenuItemLink | NabarMenuItemAction;

interface NabarMenuItemBase {
  id: string;
  heading?: string;
  label: string | JSX.Element;
  title: string;
}

export interface NabarMenuItemLink extends NabarMenuItemBase {
  path: string;
  isExternal?: boolean;
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

export const NavbarMenuItems: FunctionComponent<NavbarMenuItemsProps> = ({ label, path, items }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const location = useLocation();
  const [isParentActive, setIsParentActive] = useState(false);

  // Set parent item as active if it is active or if a child item is active
  useNonInitialEffect(() => {
    if (path && (location.pathname === path || location.pathname.startsWith(`${path}/`))) {
      setIsParentActive(true);
    } else {
      const childPaths = items
        .filter((item) => isLink(item))
        .map((item: NabarMenuItemLink) => item.path)
        .some((childPath) => location.pathname === childPath || location.pathname.startsWith(`${childPath}/`));
      setIsParentActive(childPaths);
    }
  }, [path, items, location.pathname]);

  return (
    <li
      className={classNames('slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click', {
        'slds-is-active': isParentActive,
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
            title="Open menu"
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
        <div className="slds-dropdown slds-dropdown_right slds-dropdown_small">
          <ul className="slds-dropdown__list" role="menu">
            {items.map((item, i) => (
              <Fragment key={item.id}>
                {item.heading && (
                  <li className="slds-dropdown__header slds-has-divider_top-space" role="separator">
                    {item.heading}
                  </li>
                )}
                <li
                  className={classNames('slds-dropdown__item', {
                    'slds-is-selected': isLink(item) && (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
                  })}
                  role="presentation"
                >
                  {isLink(item) &&
                    (item.isExternal ? (
                      <a href={item.path} target="_blank" rel="noreferrer">
                        <span className="slds-truncate" title={item.title}>
                          <Icon
                            type="utility"
                            icon="new_window"
                            className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                            omitContainer
                          />
                          {item.label}
                        </span>
                      </a>
                    ) : (
                      <Link
                        tabIndex={i === 0 ? 0 : -1}
                        role="menuitemcheckbox"
                        to={{ pathname: item.path }}
                        onClick={() => setIsOpen(false)}
                      >
                        <span className="slds-truncate" title={item.title}>
                          <Icon
                            type="utility"
                            icon="check"
                            className="slds-icon slds-icon_selected slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                            omitContainer
                          />
                          {item.label}
                        </span>
                      </Link>
                    ))}
                  {!isLink(item) && (
                    // eslint-disable-next-line jsx-a11y/anchor-is-valid
                    <a
                      tabIndex={i === 0 ? 0 : -1}
                      role="menuitem"
                      onClick={(event) => {
                        event.preventDefault();
                        item.action(item.id);
                      }}
                    >
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

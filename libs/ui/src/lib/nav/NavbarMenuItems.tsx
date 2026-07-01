import {
  KeyBuffer,
  isArrowDownKey,
  isArrowUpKey,
  isEndKey,
  isEnterOrSpace,
  isEscapeKey,
  isHomeKey,
  isTabKey,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import { Fragment, FunctionComponent, KeyboardEvent, RefObject, createRef, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import OutsideClickHandler from '../utils/OutsideClickHandler';
import Icon from '../widgets/Icon';

export type NavbarMenuItem = NavbarMenuItemLink | NavbarMenuItemAction;

interface NavbarMenuItemBase {
  id: string;
  heading?: string;
  label: string | React.ReactNode;
  title: string;
}

export interface NavbarMenuItemLink extends NavbarMenuItemBase {
  path: string;
  search?: string;
  isExternal?: boolean;
}

export interface NavbarMenuItemAction extends NavbarMenuItemBase {
  action: (id: string) => void;
}

// TODO: allow actions, headers and dividers

export interface NavbarMenuItemsProps {
  label: string;
  // Optional path for parent item
  path?: string;
  search?: string;
  items: NavbarMenuItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLink(item: any): item is NavbarMenuItemLink {
  return !!item.path;
}

export const NavbarMenuItems: FunctionComponent<NavbarMenuItemsProps> = ({ label, path, search, items }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const location = useLocation();
  const [isParentActive, setIsParentActive] = useState(false);
  const [focusedItem, setFocusedItem] = useState<number | null>(null);

  const keyBuffer = useRef(new KeyBuffer());
  // The element focus returns to when the menu is closed via the keyboard (the label or caret trigger)
  const triggerRef = useRef<HTMLElement | null>(null);
  const ulContainerEl = useRef<HTMLUListElement>(null);
  const elRefs = useRef<RefObject<HTMLAnchorElement>[]>([]);

  // init array to hold element refs for each item in list
  if (elRefs.current.length !== items.length) {
    const refs: RefObject<HTMLAnchorElement>[] = [];
    items.forEach((_, i) => {
      refs[i] = elRefs.current[i] || createRef();
    });
    elRefs.current = refs;
  }

  // Set parent item as active if it is active or if a child item is active
  useNonInitialEffect(() => {
    if (path && (location.pathname === path || location.pathname.startsWith(`${path}/`))) {
      setIsParentActive(true);
    } else {
      const childPaths = items
        .filter((item) => isLink(item))
        .map((item: NavbarMenuItemLink) => item.path)
        .some((childPath) => location.pathname === childPath || location.pathname.startsWith(`${childPath}/`));
      setIsParentActive(childPaths);
    }
  }, [path, items, location.pathname]);

  // Move focus to (and scroll to) the active menu item whenever it changes
  useEffect(() => {
    if (!isNumber(focusedItem)) {
      return;
    }
    const focusedAnchor = elRefs.current[focusedItem]?.current;
    if (focusedAnchor) {
      try {
        focusedAnchor.focus();
        if (ulContainerEl.current) {
          // Derive the scroll index from the DOM rather than the item index: heading rows render an
          // extra <li role="separator">, so the focused anchor's <li> may not be the nth-child that
          // matches focusedItem. Falls back to focusedItem when the <li> can't be located.
          const focusedLi = focusedAnchor.closest('li');
          const domIndex = focusedLi ? Array.from(ulContainerEl.current.children).indexOf(focusedLi) : -1;
          menuItemSelectScroll({ container: ulContainerEl.current, focusedIndex: domIndex >= 0 ? domIndex : focusedItem });
        }
      } catch {
        // silent error on keyboard navigation
      }
    }
  }, [focusedItem]);

  // When the menu opens move focus into the list (to the active route, otherwise the first item); reset when closed
  useEffect(() => {
    if (isOpen && !isNumber(focusedItem)) {
      const selectedIdx = items.findIndex(
        (item) => isLink(item) && (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
      );
      setFocusedItem(selectedIdx >= 0 ? selectedIdx : 0);
    } else if (!isOpen) {
      setFocusedItem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function closeMenu(returnFocusToTrigger = false) {
    setIsOpen(false);
    if (returnFocusToTrigger) {
      triggerRef.current?.focus();
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Handle keys here (rather than relying on a native button click) so the label span and the caret
    // button behave identically and so focus can be moved into the menu by the open effect.
    if (isEnterOrSpace(event)) {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (isArrowDownKey(event)) {
      event.preventDefault();
      setIsOpen(true);
    } else if (isEscapeKey(event)) {
      setIsOpen(false);
    }
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLAnchorElement>, item: NavbarMenuItem, index: number) {
    if (isEscapeKey(event)) {
      event.preventDefault();
      closeMenu(true);
    } else if (isArrowUpKey(event)) {
      event.preventDefault();
      setFocusedItem(index <= 0 ? items.length - 1 : index - 1);
    } else if (isArrowDownKey(event)) {
      event.preventDefault();
      setFocusedItem(index >= items.length - 1 ? 0 : index + 1);
    } else if (isHomeKey(event)) {
      event.preventDefault();
      setFocusedItem(0);
    } else if (isEndKey(event)) {
      event.preventDefault();
      setFocusedItem(items.length - 1);
    } else if (isTabKey(event)) {
      // Allow focus to leave the menu naturally, but close it behind the user
      setIsOpen(false);
    } else if (isEnterOrSpace(event)) {
      event.preventDefault();
      if (isLink(item)) {
        // Trigger the anchor so links (internal and external) navigate consistently for Enter and Space
        elRefs.current[index]?.current?.click();
      } else {
        item.action(item.id);
        closeMenu(true);
      }
    } else if (event.key && event.key.length === 1) {
      // Type-ahead: jump to the item whose title starts with the typed characters
      event.preventDefault();
      setFocusedItem(
        selectMenuItemFromKeyboard({ key: event.key, keyCode: event.keyCode, keyBuffer: keyBuffer.current, items, labelProp: 'title' }),
      );
    }
  }

  return (
    <li
      className={classNames('slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click', {
        'slds-is-active': isParentActive,
        'slds-is-open': isOpen,
      })}
    >
      <OutsideClickHandler onOutsideClick={() => setIsOpen(false)} display="contents">
        {path && (
          <Link className="slds-context-bar__label-action" title={label} to={{ pathname: path, search }}>
            <span className="slds-truncate" title={label}>
              {label}
            </span>
          </Link>
        )}
        {!path && (
          // A role="button" span (rather than a slds-button) keeps the hover/active highlight the same size
          // as the plain navbar items, matching the Salesforce context bar blueprint.
          <span
            ref={(el) => {
              triggerRef.current = el;
            }}
            className="slds-context-bar__label-action"
            role="button"
            tabIndex={0}
            title={label}
            aria-haspopup="true"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleTriggerKeyDown}
          >
            <span className="slds-truncate" title={label}>
              {label}
            </span>
          </span>
        )}

        <div className="slds-context-bar__icon-action slds-p-left_none">
          <button
            ref={(el) => {
              if (path) {
                triggerRef.current = el;
              }
            }}
            className="slds-button slds-button_icon slds-button_icon slds-context-bar__button"
            aria-haspopup="true"
            aria-expanded={isOpen}
            title="Open menu"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleTriggerKeyDown}
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
          <ul className="slds-dropdown__list" role="menu" ref={ulContainerEl}>
            {items.map((item, i) => {
              const isActive = isLink(item) && (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
              return (
                <Fragment key={item.id}>
                  {item.heading && (
                    // Skip the top divider/spacing on the first row so a leading heading doesn't render a stray border
                    <li className={classNames('slds-dropdown__header', { 'slds-has-divider_top-space': i > 0 })} role="separator">
                      {item.heading}
                    </li>
                  )}
                  <li
                    className={classNames('slds-dropdown__item', {
                      'slds-is-selected': isActive,
                    })}
                    role="presentation"
                  >
                    {isLink(item) &&
                      (item.isExternal ? (
                        <a
                          ref={elRefs.current[i]}
                          href={item.path}
                          target="_blank"
                          rel="noreferrer"
                          role="menuitem"
                          tabIndex={focusedItem === i ? 0 : -1}
                          onKeyDown={(event) => handleItemKeyDown(event, item, i)}
                          onClick={() => setIsOpen(false)}
                        >
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
                          ref={elRefs.current[i]}
                          tabIndex={focusedItem === i ? 0 : -1}
                          role="menuitemcheckbox"
                          aria-checked={isActive}
                          to={{ pathname: item.path, search: item.search }}
                          onKeyDown={(event) => handleItemKeyDown(event, item, i)}
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
                        ref={elRefs.current[i]}
                        tabIndex={focusedItem === i ? 0 : -1}
                        role="menuitem"
                        onKeyDown={(event) => handleItemKeyDown(event, item, i)}
                        onClick={(event) => {
                          event.preventDefault();
                          item.action(item.id);
                          setIsOpen(false);
                        }}
                      >
                        <span className="slds-truncate" title={item.title}>
                          {item.label}
                        </span>
                      </a>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      </OutsideClickHandler>
    </li>
  );
};

export default NavbarMenuItems;

/* eslint-disable jsx-a11y/anchor-is-valid */
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { IconName, IconObj, IconType } from '@jetstream/icon-factory';
import {
  KeyBuffer,
  isArrowDownKey,
  isArrowUpKey,
  isEndKey,
  isEnterKey,
  isHomeKey,
  isTabKey,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
} from '@jetstream/shared/ui-utils';
import { DropDownItem, DropDownItemLength } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import React, {
  Fragment,
  FunctionComponent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useEscapeToCloseLayer } from '../../hooks/useEscapeToCloseLayer';
import { usePortalContext } from '../../modal/PortalContext';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import { ConditionalPortal } from '../../widgets/ConditionalPortal';
import Icon from '../../widgets/Icon';

export interface DropDownProps {
  className?: string;
  testId?: string;
  disabled?: boolean;
  position?: 'left' | 'right';
  leadingIcon?: IconObj; // ignored if buttonContent is provided
  buttonClassName?: string;
  buttonContent?: ReactNode; // if omitted, then a regular dropdown icon will be shown
  dropDownClassName?: string;
  actionText?: string;
  scrollLength?: DropDownItemLength;
  description?: string; // assistive text, ignored if buttonContent is provided
  initialSelectedId?: string;
  items: DropDownItem[];
  usePortal?: boolean;
  /** Portal target when `usePortal` is set; defaults to the app's portal root (document.body) */
  portalRef?: HTMLElement | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelected: (id: string, metadata?: any) => void;
}

export const DropDown: FunctionComponent<DropDownProps> = ({
  className,
  testId,
  disabled,
  position = 'left',
  leadingIcon,
  buttonClassName,
  buttonContent,
  dropDownClassName,
  actionText = 'action',
  scrollLength,
  initialSelectedId,
  items,
  description,
  usePortal = false,
  portalRef,
  onSelected,
}) => {
  const keyBuffer = useRef(new KeyBuffer());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { portalRoot } = usePortalContext();
  // The portaled menu element lives outside the trigger's DOM tree, so outside-click detection
  // must be told about it or clicking a menu item would close the menu before selection lands
  const [menuElement, setMenuElement] = useState<HTMLDivElement | null>(null);
  /**
   * Positions the portaled menu against its trigger — the same floating-ui setup Popover uses, so
   * the app has one positioning behavior rather than two. `autoUpdate` keeps the menu attached while
   * the page or an ancestor scrolls (a portaled menu is no longer laid out next to its trigger, so
   * without it the menu would sit at stale coordinates while its row scrolls away), and
   * `flip`/`shift` keep a menu near the viewport edge on screen.
   */
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: position === 'right' ? 'bottom-end' : 'bottom-start',
    middleware: [offset(1.75), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const setTriggerElement = refs.setReference;
  const setMenuRef = useCallback(
    (element: HTMLDivElement | null) => {
      refs.setFloating(element);
      setMenuElement(element);
    },
    [refs],
  );
  const scrollLengthClass = useMemo<string | undefined>(
    () => (scrollLength ? `slds-dropdown_length-${scrollLength}` : undefined),
    [scrollLength],
  );
  const [focusedItem, setFocusedItem] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | undefined>(initialSelectedId);
  const ulContainerEl = useRef<HTMLUListElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Selecting an item (or pressing Escape) unmounts the portaled menu while focus is inside it,
   * which would drop focus to <body>. Focus the trigger SYNCHRONOUSLY, before the selection
   * callback runs: if the selection opens a modal, the modal then records the trigger as its
   * return-focus target (the menu item it would otherwise record unmounts with the menu), and the
   * modal immediately takes focus from there. Outside clicks intentionally never return focus,
   * since the user is focusing something else.
   */
  function focusTrigger() {
    triggerButtonRef.current?.focus();
  }
  const elRefs = useRef<RefObject<HTMLAnchorElement>[]>([]);

  // init array to hold element refs for each item in list
  if (elRefs.current.length !== items.length) {
    const refs: RefObject<HTMLAnchorElement>[] = [];
    items.forEach((item, i) => {
      refs[i] = elRefs.current[i] || createRef();
    });
    // add or remove refs
    elRefs.current = refs;
  }

  useEffect(() => {
    if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
      try {
        elRefs.current?.[focusedItem]?.current?.focus();

        if (ulContainerEl.current) {
          menuItemSelectScroll({
            container: ulContainerEl.current,
            focusedIndex: focusedItem,
          });
        }
      } catch {
        // silent error on keyboard navigation
      }
    }
  }, [focusedItem]);

  useEffect(() => {
    if (isOpen && !isNumber(focusedItem)) {
      if (selectedItem) {
        let idx = items.findIndex((item) => item.id === selectedItem);
        idx = idx >= 0 ? idx : 0;
        setFocusedItem(idx);
      } else {
        setFocusedItem(0);
      }
    } else if (!isOpen) {
      setFocusedItem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape closes ONLY this menu (and returns focus to the trigger) — consumed at document capture
  // so an ancestor modal/popover cannot also close on the same press
  useEscapeToCloseLayer(isOpen, () => {
    setIsOpen(false);
    focusTrigger();
  });

  // Menu-item keyboard handling. Escape is deliberately absent: the items only have focus while
  // the menu is open, and useEscapeToCloseLayer consumes Escape at document capture for that state.
  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    // Tab leaves the menu (APG menu button): focus the trigger first so the browser's sequential
    // navigation continues from it (the menu is portaled), close, and let the default Tab proceed
    if (isTabKey(event)) {
      focusTrigger();
      setIsOpen(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    let newFocusedItem;

    if (isHomeKey(event)) {
      newFocusedItem = 0;
    } else if (isEndKey(event)) {
      newFocusedItem = items.length - 1;
    } else if (isArrowUpKey(event)) {
      if (!isNumber(focusedItem) || focusedItem === 0) {
        newFocusedItem = items.length - 1;
      } else {
        newFocusedItem = focusedItem - 1;
      }
    } else if (isArrowDownKey(event)) {
      if (!isNumber(focusedItem) || focusedItem === items.length - 1) {
        newFocusedItem = 0;
      } else {
        newFocusedItem = focusedItem + 1;
      }
    } else if (isEnterKey(event) && isNumber(focusedItem)) {
      const item = items[focusedItem];
      if (!item.disabled) {
        setSelectedItem(item.id);
        focusTrigger();
        onSelected(item.id, item.metadata);
        setIsOpen(false);
      }
    } else {
      // allow user to use keyboard to navigate to a specific item in the list by typing words
      newFocusedItem = selectMenuItemFromKeyboard<DropDownItem>({
        key: event.key,
        keyCode: event.keyCode,
        keyBuffer: keyBuffer.current,
        items,
        labelProp: 'value',
      });
    }

    if (isNumber(newFocusedItem)) {
      setFocusedItem(newFocusedItem);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelection(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, id: string, metadata?: any) {
    event.preventDefault();
    focusTrigger();
    setIsOpen(false);
    onSelected(id, metadata);
    setSelectedItem(id);
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)} additionalParentRef={menuElement}>
      <div
        ref={setTriggerElement}
        className={classNames('slds-dropdown-trigger slds-dropdown-trigger_click', className, { 'slds-is-open': isOpen })}
      >
        <button
          ref={triggerButtonRef}
          data-testid={testId}
          className={buttonClassName || 'slds-button slds-button_icon slds-button_icon-border-filled'}
          aria-haspopup="true"
          aria-expanded={isOpen}
          // `description` (assistive text below) is the trigger's whole accessible name when given;
          // otherwise the icon's actionText names it
          title={description || actionText}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          {buttonContent ? (
            buttonContent
          ) : (
            <Fragment>
              {leadingIcon && <Icon type={leadingIcon.type} icon={leadingIcon.icon} className="slds-button__icon" omitContainer />}
              <Icon
                type="utility"
                icon="down"
                className={classNames('slds-button__icon', {
                  'slds-button__icon_hint slds-button__icon_small': !leadingIcon,
                  'slds-button__icon_x-small': !!leadingIcon,
                })}
                omitContainer={!!leadingIcon}
                description={description ? undefined : actionText}
              />
              {description && <span className="slds-assistive-text">{description}</span>}
            </Fragment>
          )}
        </button>
        {isOpen && (
          // Portals to the app's portal root (document.body by default) so clipping ancestors —
          // virtualized grid cells, overflow containers — cannot truncate the menu. Positioning then
          // comes from floating-ui rather than the SLDS left/right classes, which only work when the
          // menu is a child of its trigger.
          <ConditionalPortal usePortal={usePortal} portalRef={portalRef ?? portalRoot}>
            <div
              ref={setMenuRef}
              className={classNames(
                'slds-dropdown',
                {
                  'slds-dropdown_left': position === 'left' && !usePortal,
                  'slds-dropdown_right': position === 'right' && !usePortal,
                },
                scrollLengthClass,
                dropDownClassName,
              )}
              style={usePortal ? floatingStyles : undefined}
            >
              {/* The menu shares the trigger's name so "Actions for X" menu is distinguishable from its siblings */}
              <ul className="slds-dropdown__list" role="menu" aria-label={description || actionText} ref={ulContainerEl}>
                {items.map(({ id, subheader, value, icon, disabled, title, trailingDivider, metadata }, i) => (
                  <Fragment key={id}>
                    {subheader && (
                      <li className="slds-dropdown__header slds-truncate" title={subheader} role="separator">
                        <span>{subheader}</span>
                      </li>
                    )}
                    <li className="slds-dropdown__item" role="presentation">
                      <a
                        ref={elRefs.current[i]}
                        role="menuitem"
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        onClick={(event) => !disabled && handleSelection(event, id, metadata)}
                        aria-disabled={disabled}
                      >
                        {isString(value) ? (
                          <span className="slds-truncate" title={title || value}>
                            {icon && (
                              // Decorative beside the visible item text — a description doubled the
                              // item's accessible name ("DeleteDelete") once icons stopped being aria-hidden
                              <Icon
                                type={icon.type as IconType}
                                icon={icon.icon as IconName}
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
                    {trailingDivider && <li className="slds-has-divider_top-space" role="separator"></li>}
                  </Fragment>
                ))}
              </ul>
            </div>
          </ConditionalPortal>
        )}
      </div>
    </OutsideClickHandler>
  );
};

export default DropDown;

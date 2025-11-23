/* eslint-disable jsx-a11y/anchor-is-valid */
import { css } from '@emotion/react';
import { FloatingPortal, autoUpdate, flip, offset, shift, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { IconName, IconType } from '@jetstream/icon-factory';
import {
  KeyBuffer,
  isArrowDownKey,
  isArrowUpKey,
  isEnterKey,
  isEscapeKey,
  isSpaceKey,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
} from '@jetstream/shared/ui-utils';
import { ContextMenuItem } from '@jetstream/types';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import React, { Fragment, FunctionComponent, KeyboardEvent, RefObject, createRef, useEffect, useRef, useState } from 'react';
import Grid from '../../grid/Grid';
import Icon from '../../widgets/Icon';
import { KeyboardShortcut, getModifierKey } from '../../widgets/KeyboardShortcut';

export interface ContextMenuProps {
  actionText?: string;
  items: ContextMenuItem[];
  parentElement: HTMLElement;
  onClose: () => void;
  onSelected: (item: ContextMenuItem) => void;
}

/**
 * ContextMenu - this is a dropdown-like menu except it is used for context menus.
 * It is a popover component that is positioned relative to the parentElement.
 */
export const ContextMenu: FunctionComponent<ContextMenuProps> = ({ parentElement, actionText = 'action', items, onClose, onSelected }) => {
  const keyBuffer = useRef(new KeyBuffer());

  const [focusedItem, setFocusedItem] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ContextMenuItem>();
  const ulContainerEl = useRef<HTMLUListElement>(null);
  const elRefs = useRef<RefObject<HTMLAnchorElement>[]>([]);

  const [isOpen] = useState(true);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    placement: 'bottom-start',
    middleware: [offset(0), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: parentElement,
    },
  });

  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
  });
  const role = useRole(context, { role: 'menu' });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  // init array to hold element refs for each item in list
  if (elRefs.current.length !== items.length) {
    const refs: RefObject<HTMLAnchorElement>[] = [];
    items.forEach((item, i) => {
      refs[i] = elRefs[i] || createRef();
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
    if (!isNumber(focusedItem)) {
      if (selectedItem) {
        let idx = items.findIndex((item) => item.value === selectedItem.value);
        idx = idx >= 0 ? idx : 0;
        setFocusedItem(idx);
      } else {
        setFocusedItem(0);
      }
    }
  }, [focusedItem, items, selectedItem]);

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (isEscapeKey(event) || isArrowUpKey(event) || isArrowDownKey(event) || isEnterKey(event) || isSpaceKey(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    let newFocusedItem;

    if (isEscapeKey(event)) {
      onClose();
      return;
    }

    if (isArrowUpKey(event)) {
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
    } else if ((isEnterKey(event) || isSpaceKey(event)) && isNumber(focusedItem)) {
      const item = items[focusedItem];
      if (!item.disabled) {
        setSelectedItem(item);
        onSelected(item);
        onClose();
      }
    } else {
      // allow user to use keyboard to navigate to a specific item in the list by typing words
      newFocusedItem = selectMenuItemFromKeyboard<ContextMenuItem>({
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

  function handleSelection(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, item: ContextMenuItem) {
    event.preventDefault();
    onClose();
    onSelected(item);
    setSelectedItem(item);
  }

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        // Selectively picked from `slds-dropdown slds-dropdown_small`
        css={css`
          z-index: 7000;
          min-width: 15rem;
          max-width: 20rem;
          border: 1px solid #e5e5e5;
          border-radius: 0.25rem;
          padding: 0.25rem 0 0;
          font-size: 0.75rem;
          background: #fff;
          box-shadow: 0 2px 3px 0 rgb(0 0 0 / 16%);
          color: #181818;
        `}
        style={floatingStyles}
        {...getFloatingProps()}
      >
        <ul className="slds-dropdown__list" role="menu" aria-label={actionText} ref={ulContainerEl}>
          {items.map((item, i) => (
            <Fragment key={item.value}>
              {item.subheader && (
                <li className="slds-dropdown__header slds-truncate" title={item.subheader} role="separator">
                  <span>{item.subheader}</span>
                </li>
              )}
              <li className="slds-dropdown__item" role="presentation">
                <a
                  ref={elRefs.current[i]}
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={handleKeyDown}
                  onClick={(event) => !item.disabled && handleSelection(event, item)}
                  aria-disabled={item.disabled}
                >
                  {isString(item.label) ? (
                    <span className="slds-truncate" title={item.title || item.label}>
                      {item.icon && (
                        <Icon
                          type={item.icon.type as IconType}
                          icon={item.icon.icon as IconName}
                          description={item.icon.description}
                          omitContainer
                          className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                        />
                      )}
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </a>
              </li>
              {item.trailingDivider && <li className="slds-has-divider_top-space" role="separator"></li>}
            </Fragment>
          ))}
        </ul>
        <Grid className="slds-popover__footer">
          <KeyboardShortcut className="slds-m-left_x-small" keys={[getModifierKey(), 'right-click']} /> to skip this menu
        </Grid>
      </div>
    </FloatingPortal>
  );
};

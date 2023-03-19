// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import {
  hasCtrlModifierKey,
  hasCtrlOrMeta,
  hasMetaModifierKey,
  hasShiftModifierKey,
  isAKey,
  isAlphaNumericKey,
  isArrowDownKey,
  isArrowLeftKey,
  isArrowRightKey,
  isArrowUpKey,
  isSpaceKey,
  KeyBuffer,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
  trapEvent,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import React, { createRef, forwardRef, KeyboardEvent, RefObject, useImperativeHandle, useRef, useState } from 'react';
import { DuelingPicklistColumnRef, DuelingPicklistItem } from './DuelingPicklistTypes';

export interface DuelingPicklistColumnProps {
  id: string;
  label: string;
  items: DuelingPicklistItem[];
  disabled?: boolean;
  allowMoveDirection: 'LEFT' | 'RIGHT';
  onMove: (items: DuelingPicklistItem[]) => void;
  onSelection: (items: DuelingPicklistItem[]) => void;
  onMoveWithinList?: (items: DuelingPicklistItem[], direction: UpDown) => void;
}

export const DuelingPicklistColumn = forwardRef<any, DuelingPicklistColumnProps>(
  ({ id, label, items, disabled, allowMoveDirection, onMove, onMoveWithinList, onSelection }, ref) => {
    const keyBuffer = useRef(new KeyBuffer());
    const [selectedItems, setSelectedItems] = useState<DuelingPicklistItem[]>([]);
    const [cursor, setCursor] = useState(0);
    const divElRef = useRef<HTMLDivElement>(null);
    const elRefs = useRef<RefObject<HTMLLIElement>[]>([]);

    // if length of items changes, re-calc refs
    if (elRefs.current.length !== items.length) {
      // add or remove refs
      elRefs.current = Array(items.length)
        .fill(null)
        .map((_, i) => elRefs.current[i] || createRef<HTMLLIElement>());
    }

    // ensure the selected item is scrolled into view
    useNonInitialEffect(() => {
      try {
        if (elRefs.current && isNumber(cursor) && elRefs.current[cursor] && elRefs.current[cursor]) {
          elRefs.current[cursor].current?.focus();
        }
        if (divElRef.current) {
          menuItemSelectScroll({
            container: divElRef.current,
            focusedIndex: cursor,
            scrollPadding: 30,
          });
        }
      } catch (ex) {
        logger.log('Error with keyboard navigation', ex);
      }
    }, [cursor]);

    // if items are removed from list, make sure they are not marked as selected
    useNonInitialEffect(() => {
      const currItems = new Set(items);
      const newSelectedItems = selectedItems.filter((item) => currItems.has(item));
      if (newSelectedItems.length !== selectedItems.length) {
        onSelection(selectedItems);
      }
    }, [items]);

    // allow parent to trigger moving items, parent does not know what is selected
    useImperativeHandle<any, DuelingPicklistColumnRef>(ref, () => ({
      clearSelection() {
        if (selectedItems.length) {
          setSelectedItems([]);
        }
      },
      toggleSelection() {
        if (selectedItems.length) {
          onMove(selectedItems);
        }
      },
      moveWithinList(direction: UpDown) {
        if (onMoveWithinList && selectedItems.length) {
          onMoveWithinList(selectedItems, direction);
        }
      },
    }));

    function handleSelection(event: React.MouseEvent<HTMLLIElement>, item: DuelingPicklistItem, idx: number) {
      event.preventDefault();
      let newSelectedItems = [item];
      if (event.shiftKey && selectedItems.length > 0) {
        // select all items from current selection to
        const selectedIdx = items.indexOf(item);
        const existingSelectedItem = items.indexOf(selectedItems[0]);
        if (selectedIdx < existingSelectedItem) {
          newSelectedItems = items.slice(selectedIdx, existingSelectedItem + 1);
        } else {
          newSelectedItems = items.slice(existingSelectedItem, selectedIdx + 1);
        }
      } else if ((event.ctrlKey || event.metaKey) && selectedItems.length > 0) {
        if (selectedItems.includes(item)) {
          // remove selected item
          newSelectedItems = selectedItems.filter((existingItem) => existingItem !== item);
        } else {
          newSelectedItems = selectedItems.concat(item);
        }
      }
      setCursor(idx);
      setSelectedItems(newSelectedItems);
      onSelection(newSelectedItems);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      event.preventDefault();
      if ((hasMetaModifierKey(event) || hasCtrlModifierKey(event)) && isAKey(event)) {
        const newSelectedItems = [...items];
        setSelectedItems(newSelectedItems);
        onSelection(newSelectedItems);
      }
    }

    function handleListNavigation(event: KeyboardEvent<HTMLLIElement>) {
      let newCursor: number | undefined = undefined;
      if (isArrowUpKey(event)) {
        trapEvent(event);
        if (cursor === 0) {
          newCursor = items.length - 1;
        } else {
          newCursor = cursor - 1;
        }
      } else if (isArrowDownKey(event)) {
        trapEvent(event);
        if (cursor === items.length - 1) {
          newCursor = 0;
        } else {
          newCursor = cursor + 1;
        }
      }

      // ctrl/cmd + left/right moves item between lists (focus is supposed to remain on item, but not implemented)
      if (hasCtrlOrMeta(event)) {
        if (isSpaceKey(event)) {
          // toggles selection on the focused option, in addition to previous selections
          const selectedItem = items[cursor];
          if (selectedItems.includes(items[cursor])) {
            setSelectedItems([...selectedItems, selectedItem]);
          } else {
            setSelectedItems(selectedItems.filter((item) => item !== selectedItem));
          }
          return;
        } else if ((isArrowRightKey(event) && allowMoveDirection === 'RIGHT') || (isArrowLeftKey(event) && allowMoveDirection === 'LEFT')) {
          trapEvent(event);
          // FIXME: this does not really work - probably because new elements are created after the focus?
          // find new item to focus - remove moved item and find next closest element
          const remainingItems = elRefs.current.filter((_, i) => i !== cursor);
          if (cursor > remainingItems.length - 1) {
            newCursor = Math.max(0, remainingItems.length - 1);
          } else {
            newCursor = cursor;
          }
          onMove(selectedItems);
          setSelectedItems([]);
          onSelection([]);
          setCursor(newCursor);
          remainingItems[newCursor].current?.focus();
          return;
        }
      }

      // allow user to type out word and select item
      if (!isNumber(newCursor) && isAlphaNumericKey(event)) {
        newCursor = selectMenuItemFromKeyboard({
          key: event.key,
          keyCode: event.keyCode,
          keyBuffer: keyBuffer.current,
          items: items,
          labelProp: 'label',
        });
      }

      if (isNumber(newCursor)) {
        setCursor(newCursor);
        if (hasCtrlModifierKey(event)) {
          // don't change selection, just focus for ctrl key
          return;
        }
        if (hasShiftModifierKey(event)) {
          // if a non-selected item now has focus, then add it to selection
          const selectedItem = items[newCursor];
          if (!selectedItems.includes(items[newCursor])) {
            setSelectedItems([...selectedItems, selectedItem]);
            onSelection([...selectedItems, selectedItem]);
          }
        } else {
          // no modifier key, replace selection with new selection
          setSelectedItems([items[newCursor]]);
          onSelection([items[newCursor]]);
        }
      }
    }

    logger.log({
      items,
      allowMoveDirection,
      selectedItems,
      cursor,
      elRefs,
    });

    return (
      <div className="slds-dueling-list__column" onKeyDown={handleKeyDown}>
        <span className="slds-form-element__label" id={id}>
          {label}
        </span>
        <div ref={divElRef} className={classNames('slds-dueling-list__options', { 'slds-is-disabled': disabled })}>
          <ul
            // aria-describedby="option-drag-label"
            aria-labelledby={id}
            // aria-multiselectable
            aria-disabled={disabled}
            className="slds-listbox slds-listbox_vertical"
            role="listbox"
          >
            {items.map((item, i) => {
              const selected = selectedItems.includes(item);
              return (
                <li
                  ref={elRefs.current[i]}
                  css={css`
                    user-select: none;
                  `}
                  key={item.value}
                  role="presentation"
                  className="slds-listbox__item"
                  onClick={(event) => handleSelection(event, item, i)}
                  onKeyDown={handleListNavigation}
                >
                  {/* TODO: drag/drop */}
                  {/* TODO: aria-selected */}
                  <div
                    className={classNames('slds-listbox__option slds-listbox__option_plain slds-media slds-media_small slds-media_inline', {
                      'slds-is-selected': selected,
                    })}
                    aria-selected={selected}
                    // draggable
                    role="option"
                    tabIndex={cursor === i ? 0 : -1}
                  >
                    <span className="slds-media__body">
                      <span className="slds-truncate" title={item.label}>
                        {item.label}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
);

export default DuelingPicklistColumn;

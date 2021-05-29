/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { css, jsx } from '@emotion/react';
import { isAKey, hasMetaModifierKey, hasCtrlModifierKey, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import classNames from 'classnames';
import React, { forwardRef, KeyboardEvent, useImperativeHandle, useState } from 'react';
import { DuelingPicklistColumnRef, DuelingPicklistItem } from './DuelingPicklistTypes';

export interface DuelingPicklistColumnProps {
  id: string;
  label: string;
  items: DuelingPicklistItem[];
  disabled?: boolean;
  onMove: (items: DuelingPicklistItem[]) => void;
  onSelection: (items: DuelingPicklistItem[]) => void;
  onMoveWithinList?: (items: DuelingPicklistItem[], direction: UpDown) => void;
}

export const DuelingPicklistColumn = forwardRef<any, DuelingPicklistColumnProps>(
  ({ id, label, items, disabled, onMove, onMoveWithinList, onSelection }, ref) => {
    const [selectedItems, setSelectedItems] = useState<DuelingPicklistItem[]>([]);

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

    function handleSelection(event: React.MouseEvent<HTMLLIElement>, item: DuelingPicklistItem) {
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

      setSelectedItems(newSelectedItems);
      onSelection(newSelectedItems);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      event.preventDefault();
      if ((hasMetaModifierKey(event) || hasCtrlModifierKey(event)) && isAKey(event)) {
        let newSelectedItems = [...items];
        setSelectedItems(newSelectedItems);
        onSelection(newSelectedItems);
      }
    }

    return (
      <div className="slds-dueling-list__column" onKeyDown={handleKeyDown}>
        <span className="slds-form-element__label" id={id}>
          {label}
        </span>
        <div className={classNames('slds-dueling-list__options', { 'slds-is-disabled': disabled })}>
          <ul
            // aria-describedby="option-drag-label"
            aria-labelledby={id}
            // aria-multiselectable
            aria-disabled={disabled}
            className="slds-listbox slds-listbox_vertical"
            role="listbox"
          >
            {items.map((item) => {
              const selected = selectedItems.includes(item);
              return (
                <li
                  css={css`
                    user-select: none;
                  `}
                  key={item.value}
                  role="presentation"
                  className="slds-listbox__item"
                  onClick={(event) => handleSelection(event, item)}
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
                    tabIndex={selected ? 0 : -1}
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

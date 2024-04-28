// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { groupByFlat } from '@jetstream/shared/utils';
import { UpDown } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, useRef, useState } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import DuelingPicklistColumn from './DuelingPicklistColumn';
import { DuelingPicklistColumnRef, DuelingPicklistItem } from './DuelingPicklistTypes';

/**
 * TODO:
 * Locked
 * drag-drop
 * keyboard shortcuts
 * - ctrl / shift multi-select
 * - arrow navigation
 */

export interface DuelingPicklistProps {
  id?: string;
  className?: string;
  label?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  labelLeft: string;
  labelRight: string;
  isRequired?: boolean;
  omitReorder?: boolean;
  disabled?: boolean;
  items: DuelingPicklistItem[];
  initialSelectedItems: string[];
  onChange: (items: string[]) => void;
}

export const DuelingPicklist: FunctionComponent<DuelingPicklistProps> = ({
  id,
  className,
  label,
  labelHelp,
  hideLabel = false,
  labelLeft,
  labelRight,
  isRequired = false,
  omitReorder = false,
  disabled = false,
  items,
  initialSelectedItems,
  onChange,
}) => {
  const columnLeftRef = useRef<DuelingPicklistColumnRef>();
  const columnRightRef = useRef<DuelingPicklistColumnRef>();
  const [selectedItems, setSelectedItems] = useState(new Set(initialSelectedItems || []));
  const [itemsByValue, setItemsByValue] = useState<Record<string, DuelingPicklistItem>>(groupByFlat(items, 'value'));
  const [itemsLeft, setListLeft] = useState<DuelingPicklistItem[]>(() => items.filter((item) => !selectedItems.has(item.value)));
  const [itemsRight, setListRight] = useState<DuelingPicklistItem[]>(() => items.filter((item) => selectedItems.has(item.value)));

  // TODO: if items changes - we need to reset everything

  useNonInitialEffect(() => {
    // these retain order
    setListLeft(items.filter((item) => !selectedItems.has(item.value)));
    // these are ordered based on how added
    setListRight(Array.from(selectedItems).map((item) => itemsByValue[item]));
    onChange(Array.from(selectedItems));
  }, [selectedItems]);

  function handleSelectButton() {
    columnLeftRef.current?.toggleSelection();
  }

  function handleDeselectButton() {
    columnRightRef.current?.toggleSelection();
  }

  function handleMoveUp() {
    columnRightRef.current?.moveWithinList('UP');
  }

  function handleMoveDown() {
    columnRightRef.current?.moveWithinList('DOWN');
  }

  function handleSelect(items: DuelingPicklistItem[]) {
    items.forEach((item) => selectedItems.add(item.value));
    setSelectedItems(new Set(selectedItems));
  }

  function handleDeselect(items: DuelingPicklistItem[]) {
    items.forEach((item) => selectedItems.delete(item.value));
    setSelectedItems(new Set(selectedItems));
  }

  function handleReorderSelection(items: DuelingPicklistItem[], direction: UpDown) {
    const itemsToMoveSet = new Set(items.map((item) => item.value));
    const outputSelectedItems = Array.from(selectedItems);

    if (direction === 'UP') {
      // some items may be at edge, in this case they cannot be moved so remove them
      for (let i = 0; i < outputSelectedItems.length; i++) {
        if (itemsToMoveSet.has(outputSelectedItems[i])) {
          itemsToMoveSet.delete(outputSelectedItems[i]);
        } else {
          // break once we find the first item that can actually move
          break;
        }
      }

      const itemsToMoveArray = Array.from(itemsToMoveSet);

      for (let i = 0; i < itemsToMoveArray.length; i++) {
        const currentIdx = outputSelectedItems.indexOf(itemsToMoveArray[i]);
        // if item is all the way left or not in list go to next item
        if (currentIdx <= 0) {
          continue;
        }
        // swap places with current index item and item to left
        const item1 = outputSelectedItems[currentIdx];
        const item2 = outputSelectedItems[currentIdx - 1];
        outputSelectedItems[currentIdx] = item2;
        outputSelectedItems[currentIdx - 1] = item1;
      }
    } else {
      // REVERSE ORDER
      // some items may be at edge, in this case they cannot be moved so remove them
      for (let i = outputSelectedItems.length - 1; i >= 0; i--) {
        if (itemsToMoveSet.has(outputSelectedItems[i])) {
          itemsToMoveSet.delete(outputSelectedItems[i]);
        } else {
          // break once we find the first item that can actually move
          break;
        }
      }

      const itemsToMoveArrayDown = Array.from(itemsToMoveSet);

      for (let k = itemsToMoveArrayDown.length - 1; k >= 0; k--) {
        const currentIdxDown = outputSelectedItems.indexOf(itemsToMoveArrayDown[k]);
        // if item is all the way right or not in list go to next item
        if (currentIdxDown >= outputSelectedItems.length - 1 || currentIdxDown < 0) {
          continue;
        }
        // swap places with current index item and item to right
        const item1 = outputSelectedItems[currentIdxDown];
        const item2 = outputSelectedItems[currentIdxDown + 1];
        outputSelectedItems[currentIdxDown] = item2;
        outputSelectedItems[currentIdxDown + 1] = item1;
      }
    }
    setSelectedItems(new Set(outputSelectedItems));
  }

  function handleSelection(which: 'LEFT' | 'RIGHT', items: DuelingPicklistItem[]) {
    if (which === 'LEFT') {
      columnRightRef.current?.clearSelection();
    } else {
      columnLeftRef.current?.clearSelection();
    }
  }

  return (
    <div className={classNames('slds-form-element', className)} role="group" aria-labelledby="picklist-group-label">
      <label
        className={classNames('slds-form-element__label slds-form-element__legend', { 'slds-assistive-text': hideLabel })}
        htmlFor={id}
      >
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </label>
      {labelHelp && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <div className="slds-dueling-list">
          <div className="slds-assistive-text" id="drag-live-region" aria-live="assertive"></div>
          <div className="slds-assistive-text" id="option-drag-label">
            Press space bar when on an item, to move it within the list. Cmd/Ctrl plus left and right arrow keys, to move items between
            lists.
          </div>
          {/* col 1 */}
          <DuelingPicklistColumn
            ref={columnLeftRef}
            id={`${id}-left`}
            items={itemsLeft}
            label={labelLeft}
            disabled={disabled}
            allowMoveDirection="RIGHT"
            onMove={handleSelect}
            onSelection={(items) => handleSelection('LEFT', items)}
          />
          {/* CENTER */}
          <div className="slds-dueling-list__column">
            <button
              className="slds-button slds-button_icon slds-button_icon-container"
              title="Move Selection to Second Category"
              disabled={disabled}
              onClick={handleSelectButton}
            >
              <Icon
                type="utility"
                icon="right"
                className="slds-button__icon"
                omitContainer
                description="Move Selection to Second Category"
              />
            </button>
            <button
              className="slds-button slds-button_icon slds-button_icon-container"
              title="Move Selection to First Category"
              disabled={disabled}
              onClick={handleDeselectButton}
            >
              <Icon type="utility" icon="left" className="slds-button__icon" omitContainer description="Move Selection to First Category" />
            </button>
          </div>
          {/* col 2 */}
          <DuelingPicklistColumn
            ref={columnRightRef}
            id={`${id}-right`}
            items={itemsRight}
            label={labelRight}
            disabled={disabled}
            allowMoveDirection="LEFT"
            onMove={handleDeselect}
            onSelection={(items) => handleSelection('RIGHT', items)}
            onMoveWithinList={handleReorderSelection}
          />
          {/* END */}
          {!omitReorder && (
            <div className="slds-dueling-list__column">
              <button
                className="slds-button slds-button_icon slds-button_icon-container"
                title="Move Selection Up"
                disabled={disabled}
                onClick={handleMoveUp}
              >
                <Icon type="utility" icon="up" className="slds-button__icon" omitContainer description="Move Selection Up" />
              </button>
              <button
                className="slds-button slds-button_icon slds-button_icon-container"
                title="Move Selection Down"
                disabled={disabled}
                onClick={handleMoveDown}
              >
                <Icon type="utility" icon="down" className="slds-button__icon" omitContainer description="Move Selection Down" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DuelingPicklist;

import { css } from '@emotion/react';
import {
  hasCtrlOrMeta,
  hasShiftModifierKey,
  isAKey,
  isAlphaNumericKey,
  isArrowDownKey,
  isArrowLeftKey,
  isArrowRightKey,
  isArrowUpKey,
  isEnterKey,
  isEscapeKey,
  isSpaceKey,
  KeyBuffer,
  selectMenuItemFromKeyboard,
  trapEvent,
} from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import classNames from 'classnames';
import { FocusEvent, forwardRef, KeyboardEvent, MouseEvent, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { DuelingPicklistColumnRef, DuelingPicklistItem } from './DuelingPicklistTypes';

/**
 * The list scrolls instead of the bordered box: a scrollbar on the box itself cuts off its rounded corners.
 * The filter lives inside the box so that both columns stay the same height and line up.
 */
const OPTIONS_CONTAINER_STYLES = css`
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
`;

const FILTER_STYLES = css`
  flex: 0 0 auto;
  border-width: 0 0 1px 0;
  border-radius: 0;
  /*
   * A ring around the input does not work here: the box clips it and its square corners clash with the rounded box.
   * Focus is shown as a thicker brand colored line under the input instead.
   */
  &:focus,
  &:focus-visible {
    outline: none;
    border-color: var(--slds-g-color-border-brand-2, #0176d3);
    box-shadow: inset 0 -2px 0 0 var(--slds-g-color-border-brand-2, #0176d3);
  }
`;

const LIST_STYLES = css`
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.25rem 0;
  overflow: auto;
`;

const OPTION_STYLES = css`
  user-select: none;
`;

export interface DuelingPicklistColumnProps {
  id: string;
  label: string;
  items: DuelingPicklistItem[];
  disabled?: boolean;
  /** Grow with the available width instead of the fixed SLDS width */
  isResponsive?: boolean;
  /** Show a text filter above the options, useful for long lists */
  allowFilter?: boolean;
  filterPlaceholder?: string;
  /** Shown instead of the options when there is nothing to list */
  emptyMessage?: string;
  allowMoveDirection: 'LEFT' | 'RIGHT';
  /** `viaKeyboard` is set when focus has to follow the items into the other column */
  onMove: (items: DuelingPicklistItem[], viaKeyboard: boolean) => void;
  /** Provided when the order of this column can be changed */
  onMoveWithinList?: (items: DuelingPicklistItem[], direction: UpDown) => void;
}

/**
 * One listbox of a dueling picklist. Keyboard support follows the multi-select listbox model SLDS prescribes:
 * https://www.lightningdesignsystem.com/components/dueling-picklist/#Accessibility
 */
export const DuelingPicklistColumn = forwardRef<DuelingPicklistColumnRef, DuelingPicklistColumnProps>(
  (
    {
      id,
      label,
      items,
      disabled,
      isResponsive,
      allowFilter,
      filterPlaceholder,
      emptyMessage,
      allowMoveDirection,
      onMove,
      onMoveWithinList,
    },
    ref,
  ) => {
    const keyBuffer = useRef(new KeyBuffer());
    const listRef = useRef<HTMLUListElement>(null);
    const [filter, setFilter] = useState('');
    const [selectedValues, setSelectedValues] = useState<string[]>([]);
    const [cursor, setCursor] = useState(0);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    // Option to focus once it is rendered. Focus is only ever moved in response to the keyboard,
    // otherwise a re-render would steal focus from whatever else the user is typing in.
    const [pendingFocusValue, setPendingFocusValue] = useState<string | null>(null);
    // Set when the next focus must not select the option: a click decides the selection itself (a Ctrl/Cmd click
    // would otherwise toggle off what focus just selected), and Ctrl/Cmd + arrow moves focus without selecting.
    const skipSelectOnFocus = useRef(false);

    const moveKeyLabel = allowMoveDirection === 'RIGHT' ? 'right' : 'left';

    const visibleItems = useMemo(() => {
      const filterText = filter.trim().toLowerCase();
      return filterText ? items.filter((item) => item.label.toLowerCase().includes(filterText)) : items;
    }, [items, filter]);

    // Options that moved to the other column or were filtered out are no longer selected
    const selectedItems = useMemo(() => {
      const selected = new Set(selectedValues);
      return visibleItems.filter((item) => selected.has(item.value));
    }, [visibleItems, selectedValues]);

    const activeIndex = Math.min(cursor, Math.max(visibleItems.length - 1, 0));

    useEffect(() => {
      if (pendingFocusValue === null) {
        return;
      }
      const index = visibleItems.findIndex(({ value }) => value === pendingFocusValue);
      if (index < 0) {
        // Moved in from the other column and not rendered yet
        return;
      }
      setPendingFocusValue(null);
      if (index !== cursor) {
        setCursor(index);
      }
      const option = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index];
      option?.focus();
      option?.scrollIntoView?.({ block: 'nearest' });
    }, [pendingFocusValue, visibleItems, cursor]);

    useImperativeHandle<DuelingPicklistColumnRef, DuelingPicklistColumnRef>(ref, () => ({
      moveSelection() {
        moveItems(selectedItems, false);
      },
      moveWithinList(direction: UpDown) {
        if (onMoveWithinList && selectedItems.length) {
          onMoveWithinList(selectedItems, direction);
        }
      },
      focusItems(values: string[]) {
        // The moved options may not match the filter, they must be visible to be focused
        setFilter('');
        // What arrives becomes the selection, so that moving it straight back does not take along what was selected before
        setSelectedValues(values);
        setPendingFocusValue(values[0] ?? null);
      },
    }));

    function select(itemsToSelect: DuelingPicklistItem[]) {
      setSelectedValues(itemsToSelect.map(({ value }) => value));
    }

    function moveItems(itemsToMove: DuelingPicklistItem[], viaKeyboard: boolean) {
      if (disabled || !itemsToMove.length) {
        return;
      }
      setIsReorderMode(false);
      select([]);
      onMove(itemsToMove, viaKeyboard);
    }

    function focusOption(index: number) {
      setPendingFocusValue(visibleItems[index].value);
      setCursor(index);
    }

    function setReorderMode(enabled: boolean) {
      setIsReorderMode(enabled);
      setAnnouncement(enabled ? 'Reorder mode on. Use the up and down arrow keys to move the selected options.' : 'Reorder mode off.');
    }

    function handleClick(event: MouseEvent<HTMLLIElement>, item: DuelingPicklistItem, index: number) {
      event.preventDefault();
      if (disabled) {
        return;
      }
      setPendingFocusValue(null);
      skipSelectOnFocus.current = false;
      let newSelectedItems = [item];
      if (event.shiftKey && selectedItems.length > 0) {
        // Range from the first selected option to the clicked one
        const anchorIndex = visibleItems.indexOf(selectedItems[0]);
        newSelectedItems = visibleItems.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1);
      } else if ((event.ctrlKey || event.metaKey) && selectedItems.length > 0) {
        newSelectedItems = selectedItems.includes(item)
          ? selectedItems.filter((selectedItem) => selectedItem !== item)
          : [...selectedItems, item];
      }
      setCursor(index);
      select(newSelectedItems);
    }

    /** Tabbing into the list selects the focused option, unless a selection is already waiting there */
    function handleFocus(item: DuelingPicklistItem, index: number) {
      // Keyboard actions apply to the cursor, which has to be whichever option has focus
      setCursor(index);
      const shouldSelect = !skipSelectOnFocus.current;
      skipSelectOnFocus.current = false;
      if (shouldSelect && !disabled && !selectedItems.length) {
        select([item]);
      }
    }

    function handleBlur(event: FocusEvent<HTMLUListElement>) {
      if (isReorderMode && !event.currentTarget.contains(event.relatedTarget)) {
        setIsReorderMode(false);
      }
    }

    function getArrowTargetIndex(event: KeyboardEvent<HTMLLIElement>): number | null {
      if (isArrowUpKey(event)) {
        return activeIndex === 0 ? visibleItems.length - 1 : activeIndex - 1;
      }
      if (isArrowDownKey(event)) {
        return activeIndex === visibleItems.length - 1 ? 0 : activeIndex + 1;
      }
      if (event.key === 'Home') {
        return 0;
      }
      if (event.key === 'End') {
        return visibleItems.length - 1;
      }
      return null;
    }

    function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
      if (disabled || !visibleItems.length) {
        return;
      }
      setPendingFocusValue(null);
      const focusedItem = visibleItems[activeIndex];
      const arrowTargetIndex = getArrowTargetIndex(event);
      const isMoveKey =
        (isArrowRightKey(event) && allowMoveDirection === 'RIGHT') || (isArrowLeftKey(event) && allowMoveDirection === 'LEFT');

      if (hasCtrlOrMeta(event)) {
        if (isAKey(event)) {
          trapEvent(event);
          select([...visibleItems]);
        } else if (isSpaceKey(event)) {
          // Toggle the focused option without changing the rest of the selection
          trapEvent(event);
          select(
            selectedItems.includes(focusedItem) ? selectedItems.filter((item) => item !== focusedItem) : [...selectedItems, focusedItem],
          );
        } else if (isMoveKey) {
          trapEvent(event);
          moveItems(selectedItems.length ? selectedItems : [focusedItem], true);
        } else if (arrowTargetIndex !== null) {
          // Focus moves, the selection stays where it is
          trapEvent(event);
          skipSelectOnFocus.current = arrowTargetIndex !== activeIndex;
          focusOption(arrowTargetIndex);
        }
        return;
      }

      if (isEnterKey(event)) {
        trapEvent(event);
        moveItems(selectedItems.length ? selectedItems : [focusedItem], true);
        return;
      }

      if (isSpaceKey(event)) {
        trapEvent(event);
        if (!selectedItems.includes(focusedItem)) {
          select([...selectedItems, focusedItem]);
        }
        if (onMoveWithinList) {
          setReorderMode(!isReorderMode);
        }
        return;
      }

      if (isReorderMode && isEscapeKey(event)) {
        trapEvent(event);
        setReorderMode(false);
        return;
      }

      if (isReorderMode && onMoveWithinList && (isArrowUpKey(event) || isArrowDownKey(event))) {
        // The focused option is part of what moves, so focus has to follow it to its new position
        trapEvent(event);
        setPendingFocusValue(focusedItem.value);
        onMoveWithinList(selectedItems, isArrowUpKey(event) ? 'UP' : 'DOWN');
        return;
      }

      let targetIndex = arrowTargetIndex;
      if (targetIndex !== null) {
        trapEvent(event);
      } else if (isAlphaNumericKey(event)) {
        // Typing jumps to the first option that starts with what was typed
        targetIndex =
          selectMenuItemFromKeyboard({
            key: event.key,
            keyCode: event.keyCode,
            keyBuffer: keyBuffer.current,
            items: visibleItems,
            labelProp: 'label',
          }) ?? null;
      }

      const targetItem = targetIndex === null ? undefined : visibleItems[targetIndex];
      if (targetIndex === null || !targetItem) {
        return;
      }
      focusOption(targetIndex);
      if (hasShiftModifierKey(event)) {
        if (!selectedItems.includes(targetItem)) {
          select([...selectedItems, targetItem]);
        }
      } else {
        select([targetItem]);
      }
    }

    return (
      <div className={classNames('slds-dueling-list__column', { 'slds-dueling-list__column_responsive': isResponsive })}>
        <span className="slds-form-element__label" id={id}>
          {label}
        </span>
        <span className="slds-assistive-text" id={`${id}-instructions`}>
          Use the up and down arrow keys to select an option, hold Shift to select more than one. Press Control or Command plus the{' '}
          {moveKeyLabel} arrow key to move the selected options to the other list.
          {onMoveWithinList &&
            ' Press Space to turn reorder mode on or off, then use the up and down arrow keys to move the selected options.'}
        </span>
        <span className="slds-assistive-text" aria-live="assertive">
          {announcement}
        </span>
        <div className={classNames('slds-dueling-list__options', { 'slds-is-disabled': disabled })} css={OPTIONS_CONTAINER_STYLES}>
          {allowFilter && (
            <input
              type="search"
              className="slds-input"
              css={FILTER_STYLES}
              aria-label={`Filter ${label}`}
              placeholder={filterPlaceholder ?? 'Filter'}
              value={filter}
              disabled={disabled}
              autoComplete="off"
              onChange={(event) => {
                setFilter(event.target.value);
                setCursor(0);
              }}
              onKeyDown={(event) => {
                // Enter would otherwise submit the form this picklist is part of
                if (isEnterKey(event)) {
                  event.preventDefault();
                }
              }}
            />
          )}
          {!visibleItems.length && emptyMessage && (
            <p className="slds-p-around_small slds-text-color_weak slds-text-body_small">{filter.trim() ? 'No matches' : emptyMessage}</p>
          )}
          <ul
            ref={listRef}
            aria-labelledby={id}
            aria-describedby={`${id}-instructions`}
            aria-multiselectable="true"
            aria-disabled={disabled}
            className="slds-listbox slds-listbox_vertical"
            css={LIST_STYLES}
            role="listbox"
            onBlur={handleBlur}
          >
            {visibleItems.map((item, i) => {
              const selected = selectedItems.includes(item);
              return (
                <li
                  css={OPTION_STYLES}
                  key={item.value}
                  role="presentation"
                  className="slds-listbox__item"
                  onMouseDown={() => {
                    skipSelectOnFocus.current = true;
                  }}
                  onClick={(event) => handleClick(event, item, i)}
                  onDoubleClick={() => moveItems([item], false)}
                  onKeyDown={handleKeyDown}
                >
                  <div
                    className={classNames('slds-listbox__option slds-listbox__option_plain slds-media slds-media_small slds-media_inline', {
                      'slds-is-selected': selected,
                      'slds-is-grabbed': selected && isReorderMode,
                    })}
                    aria-selected={selected}
                    role="option"
                    tabIndex={activeIndex === i ? 0 : -1}
                    onFocus={() => handleFocus(item, i)}
                  >
                    <span className="slds-media__body">
                      <span className="slds-truncate" title={item.title ?? item.label}>
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
  },
);

export default DuelingPicklistColumn;

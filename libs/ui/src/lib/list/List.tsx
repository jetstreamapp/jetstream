/* eslint-disable @typescript-eslint/no-explicit-any */

import { css } from '@emotion/react';
import {
  hasMetaModifierKey,
  isArrowDownKey,
  isArrowLeftKey,
  isArrowRightKey,
  isArrowUpKey,
  isEndKey,
  isEnterOrSpace,
  isHomeKey,
  menuItemSelectScroll,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import uniqueId from 'lodash/uniqueId';
import { ForwardedRef, Fragment, KeyboardEvent, ReactNode, RefObject, createRef, forwardRef, useEffect, useRef, useState } from 'react';
import ListItem from './ListItem';
import ListItemCheckbox from './ListItemCheckbox';

type RefObjType = RefObject<HTMLLIElement>[] | RefObject<HTMLInputElement>[];

/**
 * Focus the row a keyboard user should land on when entering a List from outside (e.g. ArrowDown from
 * the panel's filter input): the active/selected row, else the first row, else the list itself.
 */
export function focusListEntryRow(listElement: HTMLUListElement | null) {
  if (!listElement) {
    return;
  }
  const entryRow =
    listElement.querySelector<HTMLElement>('[role="option"][aria-selected="true"], input[type="checkbox"]:checked') ??
    listElement.querySelector<HTMLElement>('[role="option"], input[type="checkbox"]');
  (entryRow ?? listElement).focus();
}

export interface ListProps {
  className?: string;
  /**
   * Accessible name for the list. Optional in the type, but strongly encouraged — the list renders
   * no visible label element, so a listbox-mode list has no accessible name without it.
   */
  ariaLabel?: string;
  items: any[];
  isMultiSelect?: boolean;
  autoScrollToFocus?: boolean;
  useCheckbox?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  disabled?: boolean;
  isActive: (item: any) => boolean;
  // function used to extract
  getContent: (item: any) => {
    key: string;
    id?: string;
    testId?: string;
    /** Accessible name for the row checkbox — required when heading is a ReactNode, which cannot label the input */
    label?: string;
    heading?: Maybe<string | ReactNode>;
    subheading?: Maybe<string>;
    trailingHeader?: ReactNode;
    children?: ReactNode;
  };
  onSelected: (key: string) => void;
}

export const List = forwardRef<HTMLUListElement, ListProps>(
  (
    {
      className,
      ariaLabel,
      items,
      autoScrollToFocus = false,
      useCheckbox = false,
      subheadingPlaceholder = false,
      isMultiSelect = useCheckbox,
      searchTerm,
      highlightText,
      disabled = false,
      isActive,
      getContent,
      onSelected,
    },
    ref: ForwardedRef<HTMLUListElement>,
  ) => {
    const [focusedItem, setFocusedItem] = useState<number | null>(null);
    const [trailingHintId] = useState(() => uniqueId('list-trailing-hint-'));
    const [didScrollIntoView, setDidScrollIntoView] = useState(false);
    const elRefs = useRef<RefObjType>([]);

    // keep track of ref for all items in list
    if (elRefs.current.length !== items.length) {
      const refs: RefObjType = [];
      items.forEach((item, i) => {
        refs[i] = elRefs.current[i] || createRef();
      });
      // add or remove refs
      elRefs.current = refs;
    }

    useNonInitialEffect(() => {
      setFocusedItem(null);
    }, [items]);

    useEffect(() => {
      if (autoScrollToFocus && !didScrollIntoView && items?.length) {
        const activeItemIdx = items.findIndex(isActive);
        if (elRefs.current[activeItemIdx] && elRefs.current[activeItemIdx].current) {
          // without timeout, the viewport does not appear to have been fully rendered and the scroll position was slightly off
          const timeout = setTimeout(() => elRefs.current?.[activeItemIdx]?.current?.scrollIntoView());
          setDidScrollIntoView(true);
          return () => clearTimeout(timeout);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoScrollToFocus, items]);

    useNonInitialEffect(() => {
      if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
        try {
          elRefs.current?.[focusedItem]?.current?.focus();

          if (ref && typeof ref !== 'function' && ref.current) {
            menuItemSelectScroll({
              container: ref.current,
              focusedIndex: focusedItem,
            });
          }
        } catch {
          // silent failure
        }
      }
    }, [focusedItem]);

    function handleSelect(key: string, idx: number) {
      onSelected(key);
      if (idx !== focusedItem) {
        setFocusedItem(idx);
      }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
      let newFocusedItem;
      const focusedRow = (event.target as HTMLElement).closest('li');
      // Keys from content rendered inside a row's React subtree but OUTSIDE this list in the DOM (a
      // portaled popover/modal) or from a nested list belong to that content, not to this list —
      // otherwise ArrowDown inside a row's details popover moved focus onto the next row and closed it
      if (focusedRow && focusedRow.parentElement !== event.currentTarget) {
        return;
      }
      // The current row is whichever one actually has focus: the focusedItem state is reset whenever
      // `items` changes identity (every toggle/expand/filter re-creates the array), so navigating from
      // state jumped back to "first selected + 1" instead of continuing from the focused row
      const domFocusedIndex = focusedRow
        ? elRefs.current.findIndex((rowRef) => !!rowRef.current && focusedRow.contains(rowRef.current))
        : -1;
      const currFocusedItem = domFocusedIndex >= 0 ? domFocusedIndex : focusedItem;

      // Entering the list from the ul itself (no row focused yet): land ON the active row, else at the
      // end the user is moving toward — not one past the active row
      if (!isNumber(currFocusedItem) && (isArrowUpKey(event) || isArrowDownKey(event))) {
        event.stopPropagation();
        event.preventDefault();
        const activeIndex = items.findIndex((item) => isActive(item));
        setFocusedItem(activeIndex >= 0 ? activeIndex : isArrowDownKey(event) ? 0 : items.length - 1);
        return;
      }

      if (isArrowUpKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        if (!isNumber(currFocusedItem) || currFocusedItem === 0) {
          newFocusedItem = items.length - 1;
        } else {
          newFocusedItem = currFocusedItem - 1;
        }
      } else if (isArrowDownKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        if (!isNumber(currFocusedItem) || currFocusedItem >= items.length - 1) {
          newFocusedItem = 0;
        } else {
          newFocusedItem = currFocusedItem + 1;
        }
      } else if (isHomeKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        newFocusedItem = 0;
      } else if (isEndKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        newFocusedItem = items.length - 1;
      } else if (isArrowRightKey(event) || isArrowLeftKey(event)) {
        // Row-local navigation (both list modes): ArrowRight steps through a row's secondary controls
        // (e.g. a details popover trigger), ArrowLeft steps back toward the row itself. This lets
        // those controls stay out of the page tab order without becoming keyboard-unreachable — in
        // listbox mode the focused option li matches [tabindex], so it is the natural first stop.
        const rowElement = (event.target as HTMLElement).closest('li');
        if (rowElement) {
          const descendants = Array.from(
            rowElement.querySelectorAll<HTMLElement>('input, button, a[href], select, textarea, [tabindex]'),
          ).filter((el) => !el.hasAttribute('disabled') && el.closest('li') === rowElement);
          // querySelectorAll only returns descendants, so the focusable option li itself must be
          // prepended explicitly — it is stop zero, the ArrowLeft target from the first control. In
          // checkbox mode the li is not an option (the checkbox is stop zero), so it is never a target.
          const focusables = rowElement.matches('[role="option"]') ? [rowElement as HTMLElement, ...descendants] : descendants;
          const currentIndex = focusables.indexOf(event.target as HTMLElement);
          const next = isArrowRightKey(event) ? focusables[currentIndex + 1] : focusables[currentIndex - 1];
          if (next) {
            event.stopPropagation();
            event.preventDefault();
            next.focus();
          }
        }
        return;
      } else if (!useCheckbox && !hasMetaModifierKey(event) && isEnterOrSpace(event)) {
        event.stopPropagation();
        event.preventDefault();
        if (!isNil(currFocusedItem) && items[currFocusedItem]) {
          const { key } = getContent(items[currFocusedItem]);
          handleSelect(key, currFocusedItem);
        }
        return;
      }
      if (isNumber(newFocusedItem)) {
        event.stopPropagation();
        setFocusedItem(newFocusedItem);
      }
    }

    // getContent builds each row's element tree, so call it once per item per render (not once more
    // for the trailing-actions check — that doubled the work on 500-field objects on every keystroke)
    const itemContents = Array.isArray(items) ? items.map((item) => getContent(item)) : [];
    const hasTrailingActions = itemContents.some((content) => !!content.trailingHeader);

    return (
      // eslint-disable-next-line react/jsx-no-useless-fragment
      <Fragment>
        {Array.isArray(items) &&
          items.length > 0 && (
            // Composite-widget pattern the rule cannot see: the ul is the list's single tab stop and
            // its keydown handler delegates for the focusable rows/checkboxes inside it. In checkbox
            // mode the ul is deliberately NOT a listbox (options cannot contain interactive children).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <ul
              ref={ref}
              // Checkbox mode moves focus into the checkboxes themselves, and options must not contain
              // interactive children — so checkbox lists are plain lists of labeled checkboxes, while
              // single-select lists keep listbox/option semantics.
              role={useCheckbox ? undefined : 'listbox'}
              aria-label={ariaLabel}
              aria-multiselectable={useCheckbox ? undefined : isMultiSelect}
              className={classNames('slds-has-dividers_bottom-space', className)}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              css={css`
                /* Inset outlines: Safari paints no default focus ring on lists/items, and an outline
                 drawn outside the element is clipped left/right by the scrolling container */
                &:focus-visible,
                & li:focus-visible {
                  outline: 2px solid var(--slds-g-color-brand-base-50, #0176d3);
                  outline-offset: -2px;
                }
              `}
            >
              {items.map((item, i) => {
                const { key, id, testId, label, heading, subheading, trailingHeader, children } = itemContents[i];
                return useCheckbox ? (
                  <ListItemCheckbox
                    inputRef={elRefs.current[i] as RefObject<HTMLInputElement>}
                    key={key}
                    id={id || key}
                    label={label}
                    testId={testId}
                    isActive={isActive(item)}
                    heading={heading}
                    subheading={subheading}
                    subheadingPlaceholder={subheadingPlaceholder}
                    searchTerm={searchTerm}
                    highlightText={highlightText}
                    disabled={disabled}
                    onSelected={() => handleSelect(key, i)}
                  >
                    {children}
                  </ListItemCheckbox>
                ) : (
                  <ListItem
                    key={key}
                    testId={testId}
                    liRef={elRefs.current[i] as RefObject<HTMLLIElement>}
                    describedById={trailingHeader ? trailingHintId : undefined}
                    isActive={isActive(item)}
                    heading={heading}
                    subheading={subheading}
                    trailingHeader={trailingHeader}
                    subheadingPlaceholder={subheadingPlaceholder}
                    searchTerm={searchTerm}
                    highlightText={highlightText}
                    disabled={disabled}
                    onSelected={() => handleSelect(key, i)}
                  >
                    {children}
                  </ListItem>
                );
              })}
            </ul>
          )}
        {/* Discoverability hint for rows with trailing actions — read after the option's name/state.
            Only rendered when some row actually has them, so lists without trailing controls don't
            carry stray assistive text */}
        {hasTrailingActions && (
          <span id={trailingHintId} className="slds-assistive-text">
            Press Right Arrow for additional actions
          </span>
        )}
      </Fragment>
    );
  },
);

export default List;

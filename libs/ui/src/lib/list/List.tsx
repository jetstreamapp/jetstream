/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  hasMetaModifierKey,
  isArrowDownKey,
  isArrowUpKey,
  isEndKey,
  isEnterOrSpace,
  isHomeKey,
  menuItemSelectScroll,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import { Fragment, KeyboardEvent, RefObject, createRef, forwardRef, useEffect, useRef, useState } from 'react';
import ListItem from './ListItem';
import ListItemCheckbox from './ListItemCheckbox';

type RefObjType = RefObject<HTMLLIElement>[] | RefObject<HTMLInputElement>[];

export interface ListProps {
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
    heading?: Maybe<string | JSX.Element>;
    subheading?: Maybe<string>;
  };
  onSelected: (key: string) => void;
}

export const List = forwardRef<HTMLUListElement, ListProps>(
  (
    {
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
    ref: RefObject<HTMLUListElement>
  ) => {
    const [focusedItem, setFocusedItem] = useState<number | null>(null);
    const [didScrollIntoView, setDidScrollIntoView] = useState(false);
    const elRefs = useRef<RefObjType>([]);

    // keep track of ref for all items in list
    if (elRefs.current.length !== items.length) {
      const refs: RefObjType = [];
      items.forEach((item, i) => {
        refs[i] = elRefs[i] || createRef();
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
    }, [autoScrollToFocus, items]);

    useNonInitialEffect(() => {
      if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
        try {
          elRefs.current?.[focusedItem]?.current?.focus();

          if (ref.current) {
            menuItemSelectScroll({
              container: ref.current,
              focusedIndex: focusedItem,
            });
          }
        } catch (ex) {
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
      let currFocusedItem = focusedItem;

      // see if there is a selected item and start there
      if (!isNumber(currFocusedItem) && (isArrowUpKey(event) || isArrowDownKey(event))) {
        event.stopPropagation();
        event.preventDefault();
        const activeIndex = items.findIndex((item) => isActive(item));
        if (activeIndex >= 0) {
          currFocusedItem = activeIndex;
        }
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

    return (
      // eslint-disable-next-line react/jsx-no-useless-fragment
      <Fragment>
        {Array.isArray(items) && items.length > 0 && (
          <ul
            ref={ref}
            role="listbox"
            aria-multiselectable={isMultiSelect}
            className="slds-has-dividers_bottom-space"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {items.map((item, i) => {
              const { key, id, testId, heading, subheading } = getContent(item);
              return useCheckbox ? (
                <ListItemCheckbox
                  inputRef={elRefs.current[i] as RefObject<HTMLInputElement>}
                  key={key}
                  id={id || key}
                  testId={testId}
                  isActive={isActive(item)}
                  heading={heading}
                  subheading={subheading}
                  subheadingPlaceholder={subheadingPlaceholder}
                  searchTerm={searchTerm}
                  highlightText={highlightText}
                  disabled={disabled}
                  onSelected={() => handleSelect(key, i)}
                />
              ) : (
                <ListItem
                  key={key}
                  testId={testId}
                  liRef={elRefs.current[i] as RefObject<HTMLLIElement>}
                  isActive={isActive(item)}
                  heading={heading}
                  subheading={subheading}
                  subheadingPlaceholder={subheadingPlaceholder}
                  searchTerm={searchTerm}
                  highlightText={highlightText}
                  disabled={disabled}
                  onSelected={() => handleSelect(key, i)}
                />
              );
            })}
          </ul>
        )}
      </Fragment>
    );
  }
);

export default List;

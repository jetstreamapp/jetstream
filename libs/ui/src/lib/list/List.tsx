/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/core';
import { isArrowDownKey, isArrowUpKey, isEndKey, isEnterOrSpace, isHomeKey, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import isNumber from 'lodash/isNumber';
import { createRef, forwardRef, Fragment, KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import ListItem from './ListItem';
import ListItemCheckbox from './ListItemCheckbox';

type RefObjType = RefObject<HTMLLIElement>[] | RefObject<HTMLInputElement>[];

export interface ListProps {
  items: any[];
  autoScrollToFocus?: boolean;
  useCheckbox?: boolean;
  subheadingPlaceholder?: boolean;
  isActive: (item: any) => boolean;
  // function used to extract
  getContent: (
    item: any
  ) => {
    key: string;
    id?: string;
    heading?: string | JSX.Element;
    subheading?: string;
  };
  onSelected: (item: any) => void;
}

export const List = forwardRef<HTMLUListElement, ListProps>(
  (
    { items, autoScrollToFocus = false, useCheckbox = false, subheadingPlaceholder = false, isActive, getContent, onSelected },
    ref: RefObject<HTMLUListElement>
  ) => {
    const [focusedItem, setFocusedItem] = useState<number>(null);
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
          elRefs.current[activeItemIdx].current.scrollIntoView();
          setDidScrollIntoView(true);
        }
      }
    }, [autoScrollToFocus, items]);

    useEffect(() => {
      if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
        try {
          elRefs.current[focusedItem].current.focus();
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

    function scrollIntoView() {}

    function handleKeyUp(event: KeyboardEvent<HTMLUListElement>) {
      event.stopPropagation();
      let newFocusedItem;
      let currFocusedItem = focusedItem;

      // see if there is a selected item and start there
      if (!isNumber(currFocusedItem) && (isArrowUpKey(event) || isArrowDownKey(event))) {
        const activeIndex = items.findIndex((item) => isActive(item));
        if (activeIndex >= 0) {
          currFocusedItem = activeIndex;
        }
      }

      if (isArrowUpKey(event)) {
        if (!isNumber(currFocusedItem) || currFocusedItem === 0) {
          newFocusedItem = items.length - 1;
        } else {
          newFocusedItem = currFocusedItem - 1;
        }
      } else if (isArrowDownKey(event)) {
        if (!isNumber(currFocusedItem) || currFocusedItem >= items.length - 1) {
          newFocusedItem = 0;
        } else {
          newFocusedItem = currFocusedItem + 1;
        }
      } else if (isHomeKey(event)) {
        newFocusedItem = 0;
      } else if (isEndKey(event)) {
        newFocusedItem = items.length - 1;
      } else if (!useCheckbox && isEnterOrSpace(event)) {
        const { key } = getContent(items[currFocusedItem]);
        handleSelect(key, currFocusedItem);
        return;
      }
      if (isNumber(newFocusedItem)) {
        setFocusedItem(newFocusedItem);
      }
    }

    return (
      <Fragment>
        {Array.isArray(items) && items.length > 0 && (
          <ul ref={ref} className="slds-has-dividers_bottom-space" tabIndex={0} onKeyUp={handleKeyUp}>
            {items.map((item, i) => {
              const { key, id, heading, subheading } = getContent(item);
              return useCheckbox ? (
                <ListItemCheckbox
                  inputRef={elRefs.current[i] as RefObject<HTMLInputElement>}
                  key={key}
                  id={id || key}
                  isActive={isActive(item)}
                  heading={heading}
                  subheading={subheading}
                  subheadingPlaceholder={subheadingPlaceholder}
                  onSelected={() => handleSelect(key, i)}
                />
              ) : (
                <ListItem
                  key={key}
                  liRef={elRefs.current[i] as RefObject<HTMLLIElement>}
                  isActive={isActive(item)}
                  heading={heading}
                  subheading={subheading}
                  subheadingPlaceholder={subheadingPlaceholder}
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

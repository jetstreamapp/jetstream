import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { isArrowLeftKey, isArrowRightKey, isEnterOrSpace, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

export interface ColorSwatchItem {
  id: string;
  color: string;
}

export interface ColorSwatchesProps {
  className?: string;
  items: ColorSwatchItem[];
  selectedItem?: string;
  onSelection: (item: ColorSwatchItem) => void;
}

export const ColorSwatches = ({ className, items = [], selectedItem, onSelection }: ColorSwatchesProps) => {
  const ulRef = useRef<HTMLUListElement>(null);
  const elRefs = useRef<HTMLAnchorElement[]>([]);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [focusedItem, setFocusedItem] = useState<number>(() => {
    if (selectedItem) {
      const currSelectedIdx = items.findIndex(({ id }) => id === selectedItem);
      if (currSelectedIdx >= 0) {
        return currSelectedIdx;
      }
    }
    return 0;
  });

  useEffect(() => {
    elRefs.current = elRefs.current.slice(0, items.length);
  }, [items]);

  useEffect(() => {
    let currSelectedIdx: number | null = null;
    if (selectedItem) {
      currSelectedIdx = items.findIndex(({ id }) => id === selectedItem);
      if (currSelectedIdx < 0) {
        currSelectedIdx = null;
      }
    }
    setSelectedItemIdx(currSelectedIdx);
  }, [items, selectedItem]);

  useNonInitialEffect(() => {
    try {
      if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && ulRef.current?.contains(document.activeElement)) {
        elRefs.current[focusedItem].focus();
      }
    } catch (ex) {
      logger.log('Error with keyboard navigation', ex);
    }
  }, [focusedItem]);

  function handleKeyUp(event: KeyboardEvent<HTMLAnchorElement>) {
    if (isArrowRightKey(event)) {
      if (focusedItem === elRefs.current.length - 1) {
        setFocusedItem(0);
      } else {
        setFocusedItem(focusedItem + 1);
      }
    } else if (isArrowLeftKey(event)) {
      if (focusedItem === 0) {
        setFocusedItem(elRefs.current.length - 1);
      } else {
        setFocusedItem(focusedItem - 1);
      }
    } else if (isEnterOrSpace(event)) {
      items[focusedItem] && handleSelectionChange(items[focusedItem]);
    }
  }

  function handleSelectionChange(item: ColorSwatchItem) {
    onSelection(item);
  }

  function handleBlur() {
    setTimeout(() => {
      if (ulRef.current && !ulRef.current.contains(document.activeElement)) {
        setFocusedItem(0);
      }
    });
  }

  return (
    <ul ref={ulRef} className={classNames('slds-color-picker__swatches', className)} role="menu" onBlur={handleBlur}>
      {items.map((item, i) => (
        <li
          key={item.id}
          className="slds-color-picker__swatch slds-p-bottom_xxx-small"
          role="presentation"
          css={css`
            ${selectedItemIdx === i ? 'border-bottom: solid #514f4d' : ''}
          `}
        >
          {/* it is REALLY stupid but salesforce requires an anchor tag for this to style correctly!?!??!? */}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            className="slds-color-picker__swatch-trigger"
            href="#"
            role="menuitem"
            tabIndex={i === 0 ? 0 : -1}
            ref={(el) => Array.isArray(elRefs.current) && el && (elRefs.current[i] = el)}
            onKeyUp={handleKeyUp}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              handleSelectionChange(item);
            }}
          >
            <span
              className="slds-swatch"
              css={css`
                background: ${item.color};
              `}
            >
              <span className="slds-assistive-text">{item.color}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
};

export default ColorSwatches;

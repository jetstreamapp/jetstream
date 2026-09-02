import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { FunctionComponent, KeyboardEvent, useRef } from 'react';
import { Popover, PopoverRef } from '../popover/Popover';
import Icon from '../widgets/Icon';

export interface ItemSelectionSummaryProps {
  label?: string;
  items: { value: string; label: string }[];
  disabled?: boolean;
  onClearItem: (item: string) => void;
  onClearAll: () => void;
}

export const ItemSelectionSummary: FunctionComponent<ItemSelectionSummaryProps> = ({
  label = 'item',
  items = [],
  disabled = false,
  onClearItem,
  onClearAll,
}) => {
  const popoverRef = useRef<PopoverRef>(null);
  const listRef = useRef<HTMLUListElement>(null);

  function handleClearAll() {
    onClearAll();
    popoverRef.current?.close();
  }

  function handleClearItem(item: string, index: number) {
    if (disabled) {
      return;
    }
    onClearItem(item);
    if (items.length === 1) {
      // Removing the last item closes the popover; its returnFocus lands on the trigger
      popoverRef.current?.close();
      return;
    }
    // The activated button unmounts with its row — focus the item that takes its place (or the new last)
    window.setTimeout(() => {
      const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      if (buttons.length) {
        focusItemButton(buttons, Math.min(index, buttons.length - 1));
      }
    });
  }

  /** Roving tabindex: only the active item is tabbable so the whole list is a single tab stop */
  function focusItemButton(buttons: HTMLButtonElement[], index: number) {
    buttons.forEach((button, i) => {
      button.tabIndex = i === index ? 0 : -1;
    });
    buttons[index]?.focus();
  }

  /** ArrowUp/ArrowDown move between the remove buttons for faster review of long selections */
  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex === -1) {
      return;
    }
    event.preventDefault();
    const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    focusItemButton(buttons, nextIndex);
  }

  return (
    <div
      css={css`
        min-height: 20px;
      `}
    >
      <Popover
        ref={popoverRef}
        placement="bottom-end"
        header={
          <header className="slds-popover__header">
            <h2 className="slds-text-heading_small" title="Selected Items">
              Selected Items
            </h2>
          </header>
        }
        content={
          <div>
            <p className="slds-text-color_weak">{disabled ? 'Selected items' : 'Choose an item to de-select it'}</p>
            {/* Delegated arrow-key handler: it only acts when one of the child remove BUTTONS is
                focused — a pattern the rule cannot see (same as List.tsx). */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <ul ref={listRef} className="slds-has-dividers_top-space slds-dropdown_length-5" onKeyDown={handleListKeyDown}>
              {items.map((item, i) => (
                <li key={`${item.value}-${i}`} className="slds-item">
                  {disabled ? (
                    <div className="slds-truncate" title={item.label}>
                      {item.label}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="slds-button slds-button_reset slds-text-link slds-truncate w-100 slds-text-align_left"
                      title={item.label}
                      tabIndex={i === 0 ? 0 : -1}
                      onClick={() => handleClearItem(item.value, i)}
                    >
                      <span className="slds-assistive-text">Remove </span>
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        }
        footer={
          <footer className="slds-popover__footer">
            <button className="slds-button slds-button_neutral slds-button_stretch" disabled={disabled} onClick={handleClearAll}>
              Clear All
            </button>
          </footer>
        }
        buttonProps={{
          className: 'slds-button',
          // aria-disabled keeps the trigger focusable: it is the returnFocus target when removing the
          // final item closes the popover — a natively disabled trigger dropped focus on <body>. The
          // keydown guard blocks Enter/Space activation (aria-disabled CSS already blocks the mouse).
          'aria-disabled': disabled || !items.length,
          onKeyDown: (event) => {
            if ((disabled || !items.length) && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
            }
          },
        }}
      >
        {formatNumber(items.length)} {pluralizeIfMultiple(label, items)} selected
        {!!items.length && <Icon type="utility" icon="chevrondown" omitContainer className="slds-button__icon slds-button__icon_right" />}
      </Popover>
    </div>
  );
};

export default ItemSelectionSummary;

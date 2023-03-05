import { css } from '@emotion/react';
import { ListItem, Maybe } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ComboboxListItem } from './ComboboxListItem';

export interface ComboboxListVirtualProps {
  items: ListItem[];
  parentRef: HTMLDivElement | null;
  selectedItem: Maybe<ListItem<string, any>>;
  onSelected: (item: ListItem) => void;
  // getScrollElement: () => Maybe<HTMLDivElement>;
}

export const ComboboxListVirtual = ({ items, selectedItem, parentRef, onSelected }: ComboboxListVirtualProps) => {
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    observeElementRect: (instance, cb) => {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        cb(entry.contentRect);
      });
      observer.observe(instance);
      return () => observer.disconnect();
    },
    getScrollElement: () => parentRef,
    // getScrollElement: getScrollElement as any, // TS definition docs say "can return undefined", but TS definition does not allow
    estimateSize: (index: number) => {
      const item = items[index];
      if (item.isGroup) {
        return 37;
      }
      // TODO: make sure these numbers are correct
      return item.secondaryLabelOnNewLine && item.secondaryLabel ? 72 : 36;
    },
  });

  return (
    <ul
      className="slds-listbox slds-listbox_vertical"
      role="group"
      css={css`
        height: ${rowVirtualizer.getTotalSize()}px;
        width: 100%;
        position: relative;
      `}
    >
      {rowVirtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];

        const styles = css`
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: ${virtualItem.size}px;
          transform: translateY(${virtualItem.start}px);
        `;

        return item.isGroup ? (
          <li key={item.id} role="presentation" className="slds-listbox__item slds-item" css={styles}>
            <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="presentation">
              <h3 className="slds-listbox__option-header" role="presentation">
                {item.label}
              </h3>
            </div>
          </li>
        ) : (
          <ComboboxListItem
            id={item.id}
            containerCss={styles}
            label={item.label}
            secondaryLabel={item.secondaryLabel}
            secondaryLabelOnNewLine={item.secondaryLabelOnNewLine}
            selected={item.id === selectedItem?.id}
            onSelection={() => {
              onSelected(item);
            }}
          />
        );
      })}
    </ul>
  );
};

import { css } from '@emotion/react';
import { NOOP } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ComboboxListItem } from './ComboboxListItem';

export interface ComboboxListVirtualProps {
  items: ListItem[];
  parentRef: HTMLDivElement | null;
  selectedItem: Maybe<ListItem<string, any>>;
  onSelected: (item: ListItem) => void;
}

export const ComboboxListVirtual = ({ items, selectedItem, parentRef, onSelected }: ComboboxListVirtualProps) => {
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef,
    estimateSize: (index: number) => {
      const item = items[index];
      if (item.isGroup) {
        return 37;
      }
      return item.secondaryLabelOnNewLine && item.secondaryLabel ? 53 : 36;
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <ul
      className="slds-listbox slds-listbox_vertical"
      role="group"
      css={css`
        height: ${rowVirtualizer.getTotalSize() || 36}px;
        width: 100%;
        position: relative;
      `}
    >
      {virtualItems.length === 0 && (
        <ComboboxListItem
          containerCss={css`
            position: absolute;
            top: 0;
            left: 0;
            width: 99%;
            height: 36px;
          `}
          id="placeholder"
          placeholder
          label="There are no items for selection"
          selected={false}
          onSelection={NOOP}
        />
      )}
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];

        const styles = css`
          position: absolute;
          top: 0;
          left: 0;
          width: 99%;
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
            key={item.id}
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

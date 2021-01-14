/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, orderStringsBy, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListItem as ListItemType, UpDown } from '@jetstream/types';
import { createRef, Fragment, FunctionComponent, useEffect, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Spinner from '../widgets/Spinner';
import List from './List';

export interface ListWithFilterMultiSelectProps {
  labels: {
    listHeading?: string;
    filter: string; // {Filter Items}
    descriptorSingular: string; // item -> showing x of x {items} || x {items} selected
    descriptorPlural: string; // items
  };
  items: ListItemType[];
  selectedItems: string[];
  allowSelectAll?: boolean;
  disabled?: boolean;
  loading: boolean;
  errorMessage?: string; // TODO:
  onSelected: (items: string[]) => void;
  errorReattempt: () => void;
}

/**
 * Full list implementation with a filter and multi-selection
 * This will extend to the full page height
 */
export const ListWithFilterMultiSelect: FunctionComponent<ListWithFilterMultiSelectProps> = ({
  labels,
  items,
  selectedItems = [],
  allowSelectAll = true,
  disabled = false, // TODO:
  loading,
  errorMessage,
  onSelected,
  errorReattempt,
}) => {
  const [filteredItems, setFilteredItems] = useState<ListItemType[]>(null);
  const [selectedItemsSet, setSelectedItemsSet] = useState<Set<string>>(new Set<string>(selectedItems || []));
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputId] = useState(`${labels.descriptorSingular}-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  useEffect(() => {
    if (items && items.length > 0 && searchTerm) {
      setFilteredItems(items.filter(multiWordObjectFilter(['label', 'secondaryLabel'], searchTerm)));
    } else {
      setFilteredItems(items);
    }
  }, [items, searchTerm]);

  useEffect(() => {
    setSelectedItemsSet(new Set<string>(selectedItems || []));
  }, [selectedItems]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  function handleSelection(itemId: string) {
    if (selectedItemsSet.has(itemId)) {
      selectedItemsSet.delete(itemId);
      onSelected(Array.from(selectedItemsSet));
    } else {
      onSelected(orderStringsBy(Array.from(selectedItemsSet).concat(itemId)));
    }
  }

  function handleSelectAll(value: boolean) {
    filteredItems.forEach((item) => {
      if (value) {
        selectedItemsSet.add(item.id);
      } else {
        selectedItemsSet.delete(item.id);
      }
    });
    onSelected(orderStringsBy(Array.from(selectedItemsSet)));
  }

  return (
    <Fragment>
      {labels.listHeading && (
        <h2 className="slds-text-heading_medium slds-grow slds-text-align_center slds-p-top_xx-small slds-p-bottom_xx-small">
          {labels.listHeading}
        </h2>
      )}
      {loading && (
        <div
          className="slds-is-relative"
          css={css`
            min-height: 50px;
          `}
        >
          <Spinner />
        </div>
      )}
      <div>
        {errorMessage && (
          <p className="slds-p-around_medium slds-text-align_center">
            <span className="slds-text-color_error">There was an error loading {labels.descriptorPlural} for the selected org.</span>
            <button className="slds-button slds-m-left_xx-small" onClick={() => errorReattempt()}>
              Try Again?
            </button>
          </p>
        )}
        {!loading && items && filteredItems && (
          <Fragment>
            <div className="slds-p-bottom--xx-small">
              <SearchInput
                id={searchInputId}
                placeholder={labels.filter}
                onChange={setSearchTerm}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {formatNumber(filteredItems.length)} of {formatNumber(items.length)}{' '}
                {pluralizeIfMultiple(labels.descriptorSingular, items)}
              </div>
              {allowSelectAll && (
                <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                  <Checkbox
                    id={`select-all-${labels.descriptorSingular}-multi`}
                    checked={
                      filteredItems.length !== 0 &&
                      selectedItemsSet.size >= filteredItems.length &&
                      filteredItems.every((item) => selectedItemsSet.has(item.id))
                    }
                    label="Select All"
                    onChange={handleSelectAll}
                    disabled={filteredItems.length === 0}
                  />
                  {formatNumber(selectedItems.length)} {pluralizeIfMultiple(labels.descriptorSingular, selectedItems)} selected
                </div>
              )}
            </div>
            <AutoFullHeightContainer>
              <List
                ref={ulRef}
                items={filteredItems}
                isActive={(item: ListItemType) => selectedItemsSet.has(item.id)}
                onSelected={handleSelection}
                getContent={(item: ListItemType) => ({
                  key: item.id,
                  heading: item.label,
                  subheading: item.secondaryLabel,
                })}
              />
              {!filteredItems.length && (
                <EmptyState imageWidth={200}>
                  <p>There are no matching {labels.descriptorPlural}</p>
                  <p>Adjust your selection.</p>
                </EmptyState>
              )}
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default ListWithFilterMultiSelect;

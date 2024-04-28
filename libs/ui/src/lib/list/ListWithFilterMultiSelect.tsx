import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, NOOP, orderValues, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListItem as ListItemType, Maybe, UpDown } from '@jetstream/types';
import uniqueId from 'lodash/uniqueId';
import { createRef, Fragment, FunctionComponent, useEffect, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import EmptyState from '../illustrations/EmptyState';
import { FishIllustration } from '../illustrations/FishIllustration';
import AutoFullHeightContainer, { AutoFullHeightContainerProps } from '../layout/AutoFullHeightContainer';
import Icon from '../widgets/Icon';
import ItemSelectionSummary from '../widgets/ItemSelectionSummary';
import Spinner from '../widgets/Spinner';
import Tooltip from '../widgets/Tooltip';
import List from './List';

export interface ListWithFilterMultiSelectProps {
  labels: {
    listHeading?: string;
    filter: string; // {Filter Items}
    descriptorSingular: string; // item -> showing x of x {items} || x {items} selected
    descriptorPlural: string; // items
  };
  items: Maybe<ListItemType[]>;
  selectedItems: string[];
  allowSelectAll?: boolean;
  disabled?: boolean;
  loading?: boolean;
  hasError?: boolean;
  allowRefresh?: boolean;
  lastRefreshed?: string;
  autoFillContainerProps?: AutoFullHeightContainerProps;
  portalRef?: Element;
  onSelected: (items: string[]) => void;
  errorReattempt?: () => void;
  onRefresh?: () => void;
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
  disabled = false,
  loading = false,
  hasError,
  allowRefresh,
  lastRefreshed,
  autoFillContainerProps,
  portalRef,
  onSelected,
  errorReattempt,
  onRefresh = NOOP,
}) => {
  const [selectedItemsSet, setSelectedItemsSet] = useState<Set<string>>(new Set<string>(selectedItems || []));
  const [searchTerm, setSearchTerm] = useState('');
  const [id] = useState(() => uniqueId(`select-all-${labels.descriptorSingular}-multi`));
  const [filteredItems, setFilteredItems] = useState<Maybe<ListItemType[]>>(() => {
    if (items && items.length > 0 && searchTerm) {
      return items.filter(multiWordObjectFilter(['label', 'secondaryLabel'], searchTerm));
    }
    return items;
  });
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
      onSelected(orderValues(Array.from(selectedItemsSet).concat(itemId)));
    }
  }

  function handleSelectAll(value: boolean) {
    if (!filteredItems) {
      return;
    }
    filteredItems.forEach((item) => {
      if (value) {
        selectedItemsSet.add(item.id);
      } else {
        selectedItemsSet.delete(item.id);
      }
    });
    onSelected(orderValues(Array.from(selectedItemsSet)));
  }

  return (
    <Fragment>
      {labels.listHeading && (
        <Fragment>
          {allowRefresh && (
            <Grid>
              <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">{labels.listHeading}</h2>
              <div>
                <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed || ''}>
                  <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={onRefresh}>
                    <Icon
                      type="utility"
                      icon="refresh"
                      description={`Reload ${labels.descriptorPlural}`}
                      className="slds-button__icon"
                      omitContainer
                    />
                  </button>
                </Tooltip>
              </div>
            </Grid>
          )}
          {!allowRefresh && (
            <h2 className="slds-text-heading_medium slds-grow slds-text-align_center slds-p-top_xx-small slds-p-bottom_xx-small">
              {labels.listHeading}
            </h2>
          )}
        </Fragment>
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
        {hasError && (
          <p className="slds-p-around_medium slds-text-align_center">
            <span className="slds-text-color_error">There was an error loading {labels.descriptorPlural} for the selected org.</span>
            {errorReattempt && (
              <button className="slds-button slds-m-left_xx-small" onClick={() => errorReattempt()}>
                Try Again?
              </button>
            )}
          </p>
        )}
        {!hasError && items && filteredItems && (
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
                    id={id}
                    checked={
                      filteredItems.length !== 0 &&
                      selectedItemsSet.size >= filteredItems.length &&
                      filteredItems.every((item) => selectedItemsSet.has(item.id))
                    }
                    label="Select All"
                    onChange={handleSelectAll}
                    disabled={disabled || filteredItems.length === 0}
                  />
                  <ItemSelectionSummary
                    items={items.filter((item) => selectedItemsSet.has(item.id)).map((item) => ({ label: item.label, value: item.id }))}
                    portalRef={portalRef}
                    disabled={disabled}
                    onClearAll={() => onSelected([])}
                    onClearItem={handleSelection}
                  />
                </div>
              )}
            </div>
            <AutoFullHeightContainer bottomBuffer={15} {...autoFillContainerProps}>
              <List
                ref={ulRef}
                items={filteredItems}
                isMultiSelect
                isActive={(item: ListItemType) => selectedItemsSet.has(item.id)}
                onSelected={handleSelection}
                getContent={(item: ListItemType) => ({
                  key: item.id,
                  heading: item.label,
                  subheading: item.secondaryLabel,
                })}
                searchTerm={searchTerm}
                highlightText
                disabled={disabled}
              />
              {!loading && !items.length && (
                <EmptyState headline={`There are no ${labels.descriptorPlural}`} illustration={<FishIllustration />}></EmptyState>
              )}
              {!loading && !!items.length && !filteredItems.length && (
                <EmptyState headline={`There are no matching ${labels.descriptorPlural}`} subHeading="Adjust your selection."></EmptyState>
              )}
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default ListWithFilterMultiSelect;

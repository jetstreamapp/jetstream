import { css } from '@emotion/react';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { MetadataObject, SalesforceOrgUi, UpDown } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Checkbox,
  EmptyState,
  FishIllustration,
  Grid,
  Icon,
  ItemSelectionSummary,
  List,
  SearchInput,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import startCase from 'lodash/startCase';
import { Fragment, FunctionComponent, createRef, useEffect, useRef, useState } from 'react';
import { useDescribeMetadata } from './useDescribeMetadata';
import { getMetadataLabelFromFullName } from './utils';

interface ItemWithLabel {
  name: string;
  label: string;
}

export interface DescribeMetadataListProps {
  inputLabelPlural: string;
  org: SalesforceOrgUi;
  initialItems: string[];
  initialItemMap: Record<string, MetadataObject>;
  selectedItems: Set<string>;
  omitRefresh?: boolean;
  onItems: (items: string[]) => void;
  onItemsMap: (itemMap: Record<string, MetadataObject>) => void;
  onSelected: (items: string[], options?: { selectAllValue?: boolean; clearSelection?: boolean }) => void;
}

export const DescribeMetadataList: FunctionComponent<DescribeMetadataListProps> = ({
  inputLabelPlural,
  org,
  initialItems,
  initialItemMap,
  selectedItems,
  omitRefresh,
  onItems,
  onItemsMap,
  onSelected,
}) => {
  const isMounted = useRef(true);
  const [selectedItemsSet, setSelectedItemsSet] = useState<Set<string>>(new Set<string>(selectedItems || []));
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputId] = useState(`${inputLabelPlural}-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  const { loadDescribeMetadata, loading, hasError, metadataItemMap, metadataItems, lastRefreshed } = useDescribeMetadata(
    org,
    initialItems,
    initialItemMap
  );

  const [itemsWithLabel, setItemsWithLabel] = useState<ItemWithLabel[] | null>(() =>
    metadataItems ? metadataItems.map((name) => ({ name, label: getMetadataLabelFromFullName(name) })) : null
  );
  const [filteredMetadataItems, setFilteredMetadataItems] = useState<ItemWithLabel[] | null | undefined>(() => {
    if (itemsWithLabel && itemsWithLabel.length > 0 && searchTerm) {
      return itemsWithLabel.filter(multiWordObjectFilter(['name', 'label'], searchTerm));
    } else if (itemsWithLabel) {
      return itemsWithLabel;
    }
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    setSelectedItemsSet(new Set<string>(selectedItems || []));
  }, [selectedItems]);

  useNonInitialEffect(() => {
    if (metadataItems) {
      onItemsMap(metadataItemMap);
      onItems(metadataItems);
      setItemsWithLabel(metadataItems.map((name) => ({ name, label: getMetadataLabelFromFullName(name) })));
    }
  }, [metadataItems]);

  useEffect(() => {
    if (Array.isArray(itemsWithLabel)) {
      if (itemsWithLabel.length > 0 && searchTerm) {
        setFilteredMetadataItems(itemsWithLabel.filter(multiWordObjectFilter(['name', 'label'], searchTerm)));
      } else if (itemsWithLabel) {
        setFilteredMetadataItems(itemsWithLabel);
      }
    }
  }, [itemsWithLabel, searchTerm]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  async function handleRefresh() {
    try {
      loadDescribeMetadata(true);
      onSelected([], { clearSelection: true });
    } catch (ex) {
      // error
    }
  }

  return (
    <Fragment>
      <Grid>
        <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">{startCase(inputLabelPlural)}</h2>
        {!omitRefresh && (
          <div>
            <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed}>
              <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
                <Icon
                  type="utility"
                  icon="refresh"
                  description={`Reload ${inputLabelPlural}`}
                  className="slds-button__icon"
                  omitContainer
                />
              </button>
            </Tooltip>
          </div>
        )}
      </Grid>
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
        {!loading && hasError && (
          <p className="slds-p-around_medium slds-text-align_center">
            <span className="slds-text-color_error">There was an error loading {inputLabelPlural} for the selected org.</span>
            <button className="slds-button slds-m-left_xx-small" onClick={() => handleRefresh()}>
              Try Again?
            </button>
          </p>
        )}
        {!loading && !hasError && metadataItems && filteredMetadataItems && itemsWithLabel && (
          <Fragment>
            <div className="slds-p-bottom--xx-small">
              <SearchInput
                id={searchInputId}
                placeholder={`Filter ${startCase(inputLabelPlural)}`}
                onChange={setSearchTerm}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small">
                Showing {formatNumber(filteredMetadataItems.length)} of {formatNumber(metadataItems.length)} {inputLabelPlural}
              </div>
              <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small">
                <Checkbox
                  id={`select-all-${inputLabelPlural}`}
                  checked={
                    filteredMetadataItems.length > 0 &&
                    selectedItems.size >= filteredMetadataItems.length &&
                    filteredMetadataItems.every((item) => selectedItems.has(item.name))
                  }
                  label={'Select All'}
                  disabled={filteredMetadataItems.length === 0}
                  onChange={(value) => onSelected([...filteredMetadataItems.map((item) => item.name)], { selectAllValue: value })}
                />
                <ItemSelectionSummary
                  items={itemsWithLabel
                    .filter((item) => selectedItemsSet.has(item.name))
                    .map((item) => ({ label: item.label, value: item.name }))}
                  onClearAll={() => onSelected([], { clearSelection: true })}
                  onClearItem={(item) => onSelected([item])}
                />
              </div>
            </div>
            <AutoFullHeightContainer bottomBuffer={20}>
              <List
                ref={ulRef}
                autoScrollToFocus
                items={filteredMetadataItems}
                isActive={(item: ItemWithLabel) => selectedItems.has(item.name)}
                onSelected={(item) => onSelected([item])}
                getContent={(item: ItemWithLabel) => ({
                  key: item.name,
                  heading: item.label,
                  subheading: item.name,
                })}
                searchTerm={searchTerm}
                highlightText
              />
              {!metadataItems.length && (
                <EmptyState headline={`There are no ${inputLabelPlural}`} illustration={<FishIllustration />}></EmptyState>
              )}
              {!!metadataItems.length && !filteredMetadataItems.length && (
                <EmptyState headline={`There are no matching ${inputLabelPlural}`} subHeading="Adjust your selection."></EmptyState>
              )}
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default DescribeMetadataList;

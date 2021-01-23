/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordStringFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi, UpDown } from '@jetstream/types';
import { AutoFullHeightContainer, Checkbox, EmptyState, Grid, Icon, List, SearchInput, Spinner, Tooltip } from '@jetstream/ui';
import { MetadataObject } from 'jsforce';
import { startCase } from 'lodash';
import { createRef, Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useDescribeMetadata } from './useDescribeMetadata';
import { getMetadataLabelFromFullName } from './utils';

export interface DescribeMetadataListProps {
  inputLabelPlural: string;
  org: SalesforceOrgUi;
  initialItems: string[];
  initialItemMap: MapOf<MetadataObject>;
  selectedItems: Set<string>;
  onItems: (items: string[]) => void;
  onItemsMap: (itemMap: MapOf<MetadataObject>) => void;
  onSelected: (items: string[], selectAllValue?: boolean) => void;
}

export const DescribeMetadataList: FunctionComponent<DescribeMetadataListProps> = ({
  inputLabelPlural,
  org,
  initialItems,
  initialItemMap,
  selectedItems,
  onItems,
  onItemsMap,
  onSelected,
}) => {
  const isMounted = useRef(null);

  const [filteredMetadataItems, setFilteredMetadataItems] = useState<string[]>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputId] = useState(`${inputLabelPlural}-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  const {
    loadDescribeMetadata,
    loading,
    hasError,
    errorMessage,
    metadataItemMap,
    metadataItems,
    orgInformation,
    lastRefreshed,
  } = useDescribeMetadata(org, initialItems, initialItemMap);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useNonInitialEffect(() => {
    if (metadataItems) {
      onItemsMap(metadataItemMap);
      onItems(metadataItems);
    }
  }, [metadataItems]);

  useEffect(() => {
    if (Array.isArray(metadataItems)) {
      if (metadataItems.length > 0 && searchTerm) {
        setFilteredMetadataItems(metadataItems.filter(multiWordStringFilter(searchTerm)));
      } else if (metadataItems) {
        setFilteredMetadataItems(metadataItems);
      }
    }
  }, [metadataItems, searchTerm]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  async function handleRefresh() {
    try {
      loadDescribeMetadata(true);
    } catch (ex) {
      // error
    }
  }

  return (
    <Fragment>
      <Grid>
        <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">{startCase(inputLabelPlural)}</h2>
        <div>
          <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed}>
            <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
              <Icon type="utility" icon="refresh" description={`Reload ${inputLabelPlural}`} className="slds-button__icon" omitContainer />
            </button>
          </Tooltip>
        </div>
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
        {!loading && metadataItems && filteredMetadataItems && (
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
                    filteredMetadataItems.every((item) => selectedItems.has(item))
                  }
                  label={'Select All'}
                  disabled={filteredMetadataItems.length === 0}
                  onChange={(value) => onSelected([...filteredMetadataItems], value)}
                />
                {formatNumber(selectedItems.size)} {pluralizeFromNumber('object', selectedItems.size)} selected
              </div>
            </div>
            <AutoFullHeightContainer bottomBuffer={20}>
              <List
                ref={ulRef}
                autoScrollToFocus
                items={filteredMetadataItems}
                isActive={(item: string) => selectedItems.has(item)}
                onSelected={(item) => onSelected([item])}
                getContent={(item: string) => ({
                  key: item,
                  heading: getMetadataLabelFromFullName(item),
                  subheading: item,
                })}
              />
              {!filteredMetadataItems.length && (
                <EmptyState imageWidth={200}>
                  <p>There are no matching {inputLabelPlural}</p>
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

export default DescribeMetadataList;

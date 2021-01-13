/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { listMetadata } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { NOOP, orderObjectsBy, pluralizeFromNumber } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi, UpDown } from '@jetstream/types';
import { AutoFullHeightContainer, Checkbox, EmptyState, Grid, Icon, List, SearchInput, Spinner, Tooltip } from '@jetstream/ui';
import { formatRelative } from 'date-fns';
import { startCase } from 'lodash';
import { createRef, Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

// Store global state so that if a user leaves and comes back and items are restored
// we know the most recent known value to start with instead of no value
let _lastRefreshed: string;

function decodeFullNameAndApplyTransform(item: ListMetadataResult, additionalTransform: (item: ListMetadataResult) => ListMetadataResult) {
  return additionalTransform({ ...item, fullName: decodeURIComponent(item.fullName) });
}

export interface ListMetadataListProps {
  inputLabelPlural: string;
  org: SalesforceOrgUi;
  type: string;
  items: ListMetadataResult[];
  selectedItems: Set<string>;
  transformItems?: (item: ListMetadataResult) => ListMetadataResult;
  onItems: (items: ListMetadataResult[]) => void;
  onSelected: (fullNames: string[], selectAllValue?: boolean) => void;
  errorReattempt: () => void;
}

export const ListMetadataList: FunctionComponent<ListMetadataListProps> = ({
  inputLabelPlural,
  org,
  type,
  items = [],
  selectedItems,
  transformItems = (item: ListMetadataResult) => item,
  onItems,
  onSelected,
  errorReattempt,
}) => {
  const isMounted = useRef(null);

  const [filteredItems, setFilteredItems] = useState<ListMetadataResult[]>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputId] = useState(`${type}-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (org && !hasQueried) {
      setHasQueried(true);
      load().then(NOOP);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, hasQueried]);

  useEffect(() => {
    if (items && items.length > 0 && searchTerm) {
      const lowercaseTerm = searchTerm.toLowerCase();
      const filteredSobject = items.filter((obj) => `${obj.fullName}`.toLowerCase().includes(lowercaseTerm));
      setFilteredItems(filteredSobject);
    } else {
      setFilteredItems(items);
    }
  }, [items, searchTerm]);

  async function load() {
    const uniqueId = org.uniqueId;
    try {
      setLoading(true);
      const resultsWithCache = await listMetadata(org, [{ type: type }]);
      if (!isMounted.current || uniqueId !== org.uniqueId) {
        return;
      }

      if (resultsWithCache.cache) {
        const cache = resultsWithCache.cache;
        setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
      }
      onItems(
        orderObjectsBy(
          resultsWithCache.data.map((item) => decodeFullNameAndApplyTransform(item, transformItems)),
          'fullName'
        )
      );
    } catch (ex) {
      logger.error(ex);
      if (!isMounted.current || uniqueId !== org.uniqueId) {
        return;
      }
      setErrorMessage(ex.message);
    }
    setLoading(false);
  }

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  async function handleRefresh() {
    try {
      onItems(null);
      onSelected(null);
      await load();
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
        {errorMessage && (
          <p className="slds-p-around_medium slds-text-align_center">
            <span className="slds-text-color_error">There was an error loading {inputLabelPlural} for the selected org.</span>
            <button className="slds-button slds-m-left_xx-small" onClick={() => errorReattempt()}>
              Try Again?
            </button>
          </p>
        )}
        {items && filteredItems && (
          <Fragment>
            <div className="slds-p-bottom--xx-small">
              <SearchInput
                id={searchInputId}
                placeholder={`Filter ${startCase(inputLabelPlural)}`}
                onChange={setSearchTerm}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small">
                Showing {formatNumber(filteredItems.length)} of {formatNumber(items.length)} {inputLabelPlural}
              </div>
              <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small">
                <Checkbox
                  id={`select-all-${type}`}
                  checked={
                    filteredItems.length > 0 &&
                    selectedItems.size >= filteredItems.length &&
                    filteredItems.every((item) => selectedItems.has(item.fullName))
                  }
                  label={'Select All'}
                  disabled={filteredItems.length === 0}
                  onChange={(value) =>
                    onSelected(
                      filteredItems.map((item) => item.fullName),
                      value
                    )
                  }
                />
                {formatNumber(selectedItems.size)} {pluralizeFromNumber('object', selectedItems.size)} selected
              </div>
            </div>
            <AutoFullHeightContainer bottomBuffer={20}>
              <List
                ref={ulRef}
                autoScrollToFocus
                items={filteredItems}
                isActive={(item: ListMetadataResult) => selectedItems.has(item.fullName)}
                onSelected={(fullName) => onSelected([fullName])}
                getContent={(item: ListMetadataResult) => ({
                  key: item.fullName,
                  heading: item.fullName, // FIXME: replacements, AKA Admin=System Administrator
                })}
              />
              {!filteredItems.length && (
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

export default ListMetadataList;

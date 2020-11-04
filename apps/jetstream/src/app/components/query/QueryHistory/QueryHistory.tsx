/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx, css } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { REGEX } from '@jetstream/shared/utils';
import { QueryHistoryItem, QueryHistorySelection, MapOf, UpDown } from '@jetstream/types';
import { Grid, GridCol, Icon, List, Modal, SearchInput, EmptyState } from '@jetstream/ui';
import localforage from 'localforage';
import { formatNumber } from '@jetstream/shared/utils';
import { createRef, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import * as fromQueryHistoryState from './query-history.state';
import QueryHistoryItemCard from './QueryHistoryItemCard';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorBoundaryFallback from '../../core/ErrorBoundaryFallback';
import { useLocation } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryHistoryProps {}

export const QueryHistory: FunctionComponent<QueryHistoryProps> = () => {
  const location = useLocation();
  const queryHistoryStateMap = useRecoilValue(fromQueryHistoryState.queryHistoryState);
  const queryHistory = useRecoilValue(fromQueryHistoryState.selectQueryHistoryState);
  const ulRef = createRef<HTMLUListElement>();

  const [selectedObject, setSelectedObject] = useRecoilState(fromQueryHistoryState.selectedObjectState);
  const resetSelectedObject = useResetRecoilState(fromQueryHistoryState.selectedObjectState);
  const selectObjectsList = useRecoilValue(fromQueryHistoryState.selectObjectsList);

  const [isOpen, setIsOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [filteredSelectObjectsList, setFilteredSelectObjectsList] = useState(selectObjectsList);

  // Update store if queryHistory was modified
  useEffect(() => {
    if (queryHistory) {
      // load history and put into store
      (async () => {
        try {
          logger.info('Updating query history store', queryHistory);
          await localforage.setItem<MapOf<QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory, queryHistoryStateMap);
        } catch (ex) {
          logger.warn(ex);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryHistory]);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (!filterValue && selectObjectsList !== filteredSelectObjectsList) {
      setFilteredSelectObjectsList(selectObjectsList);
    } else if (filterValue) {
      const value = new RegExp(filterValue.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, ''), 'i');
      setFilteredSelectObjectsList(selectObjectsList.filter((item) => item.name === 'all' || value.test(`${item.name}${item.label}`)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectObjectsList, filterValue]);

  function onModalClose() {
    setIsOpen(false);
    resetSelectedObject();
  }

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <button className="slds-button slds-button_neutral" aria-haspopup="true" title="Favorites" onClick={() => setIsOpen(true)}>
        <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
        View History
      </button>
      {isOpen && (
        <Modal header="Query History" size="lg" skipAutoFocus onClose={() => onModalClose()}>
          {selectObjectsList.length <= 1 && (
            <EmptyState imageWidth={200}>
              <p>We couldn't find any previous queries with the currently selected org.</p>
              <p>Come back once you have performed some queries.</p>
            </EmptyState>
          )}
          {selectObjectsList.length > 1 && (
            <Grid className="slds-scrollable_y">
              <GridCol size={6} sizeMedium={4} className="slds-scrollable_y">
                <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
                <div className="slds-p-bottom--xx-small">
                  <SearchInput
                    id="query-history-object-filter"
                    placeholder="Filter Objects"
                    autoFocus
                    onChange={setFilterValue}
                    onArrowKeyUpDown={handleSearchKeyboard}
                  />
                  <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                    Showing {formatNumber(filteredSelectObjectsList.length)} of {formatNumber(selectObjectsList.length)} objects
                  </div>
                </div>
                <List
                  ref={ulRef}
                  items={filteredSelectObjectsList}
                  isActive={(item: QueryHistorySelection) => item.name === selectedObject}
                  subheadingPlaceholder
                  onSelected={setSelectedObject}
                  getContent={(item: QueryHistorySelection) => ({
                    key: item.key,
                    heading: item.label,
                    subheading: item.name !== 'all' ? item.name : '',
                  })}
                />
              </GridCol>
              <GridCol
                className="slds-p-around_x-small slds-scrollable_y"
                css={css`
                  max-height: 75vh;
                  min-height: 75vh;
                `}
              >
                {queryHistory.map((item) => (
                  <QueryHistoryItemCard key={item.key} item={item} />
                ))}
              </GridCol>
            </Grid>
          )}
        </Modal>
      )}
    </ErrorBoundary>
  );
};

export default QueryHistory;

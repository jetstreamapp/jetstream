/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { MapOf, QueryHistoryItem, QueryHistorySelection, UpDown } from '@jetstream/types';
import { EmptyState, Grid, GridCol, Icon, List, Modal, SearchInput, Spinner } from '@jetstream/ui';
import localforage from 'localforage';
import { createRef, FunctionComponent, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import ErrorBoundaryFallback from '../../core/ErrorBoundaryFallback';
import * as fromQueryHistoryState from './query-history.state';
import QueryHistoryItemCard from './QueryHistoryItemCard';

const SHOWING_STEP = 10;

export interface QueryHistoryProps {
  onRestore?: (soql: string) => void;
}

export const QueryHistory: FunctionComponent<QueryHistoryProps> = ({ onRestore }) => {
  const location = useLocation();
  const queryHistoryStateMap = useRecoilValue(fromQueryHistoryState.queryHistoryState);
  const queryHistory = useRecoilValue(fromQueryHistoryState.selectQueryHistoryState);
  const ulRef = createRef<HTMLUListElement>();

  const [selectedObject, setSelectedObject] = useRecoilState(fromQueryHistoryState.selectedObjectState);
  const resetSelectedObject = useResetRecoilState(fromQueryHistoryState.selectedObjectState);
  const selectObjectsList = useRecoilValue(fromQueryHistoryState.selectObjectsList);

  const [isOpen, setIsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [filteredSelectObjectsList, setFilteredSelectObjectsList] = useState(selectObjectsList);

  const [sqlFilterValue, setSqlFilterValue] = useState('');
  const [filteredQueryHistory, setFilteredQueryHistory] = useState(queryHistory);

  const [showingUpTo, setShowingUpTo] = useState(SHOWING_STEP);
  const [visibleQueryHistory, setVisibleQueryHistory] = useState(filteredQueryHistory.slice(0, showingUpTo));

  // Update store if queryHistory was modified
  useEffect(() => {
    if (queryHistory) {
      // load history and put into store
      (async () => {
        try {
          await localforage.setItem<MapOf<QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory, queryHistoryStateMap);
        } catch (ex) {
          logger.warn(ex);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryHistory]);

  useEffect(() => {
    if (!isOpen && showingUpTo !== SHOWING_STEP) {
      setShowingUpTo(SHOWING_STEP);
    }
  }, [isOpen, showingUpTo]);

  useEffect(() => {
    if (queryHistory) {
      setShowingUpTo(SHOWING_STEP);
      if (!sqlFilterValue) {
        setFilteredQueryHistory(queryHistory);
      } else {
        setFilteredQueryHistory(queryHistory.filter(multiWordObjectFilter(['soql'], sqlFilterValue)));
      }
    }
  }, [queryHistory, sqlFilterValue]);

  useEffect(() => {
    if (filteredQueryHistory && showingUpTo) {
      setVisibleQueryHistory(filteredQueryHistory.slice(0, showingUpTo));
    }
  }, [filteredQueryHistory, showingUpTo]);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (selectedObject) {
      setSqlFilterValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject]);

  useEffect(() => {
    if (!filterValue && selectObjectsList !== filteredSelectObjectsList) {
      setFilteredSelectObjectsList(selectObjectsList);
    } else if (filterValue) {
      setFilteredSelectObjectsList(
        selectObjectsList.filter(multiWordObjectFilter(['name', 'label'], filterValue, (item) => item.name === 'all'))
      );
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

  function handleStartRestore() {
    setIsRestoring(true);
  }

  function handleEndRestore(soql: string, fatalError: boolean, errors?: any) {
    setIsRestoring(false);
    if (!fatalError) {
      setIsOpen(false);
      onRestore && onRestore(soql);
    }
  }

  function showMore() {
    setShowingUpTo(showingUpTo + SHOWING_STEP);
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <button className="slds-button slds-button_neutral" aria-haspopup="true" title="Favorites" onClick={() => setIsOpen(true)}>
        <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
        View History
      </button>
      {isOpen && (
        <Modal header="Query History" size="lg" skipAutoFocus onClose={() => onModalClose()} className="slds-is-relative">
          {isRestoring && <Spinner />}
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
                    value={filterValue}
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
                className="slds-p-horizontal_x-small slds-scrollable_y"
                css={css`
                  max-height: 75vh;
                  min-height: 75vh;
                `}
              >
                <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
                <SearchInput
                  id="query-history-sql-filter"
                  placeholder="Filter Queries"
                  autoFocus
                  value={sqlFilterValue}
                  onChange={setSqlFilterValue}
                />
                {visibleQueryHistory.map((item) => (
                  <QueryHistoryItemCard
                    key={item.key}
                    item={item}
                    startRestore={handleStartRestore}
                    endRestore={(fatalError, errors) => handleEndRestore(item.soql, fatalError, errors)}
                  />
                ))}
                {visibleQueryHistory.length === 0 && (
                  <EmptyState imageWidth={200}>
                    <p>There are no matching queries.</p>
                    <p>Adjust your selection.</p>
                  </EmptyState>
                )}
                {!!visibleQueryHistory.length && visibleQueryHistory.length < filteredQueryHistory.length && (
                  <div className="slds-grid slds-grid_align-center slds-m-around_small">
                    <button className="slds-button slds-button_neutral" onClick={showMore}>
                      Load More
                    </button>
                  </div>
                )}
              </GridCol>
            </Grid>
          )}
        </Modal>
      )}
    </ErrorBoundary>
  );
};

export default QueryHistory;

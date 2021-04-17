/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, INDEXED_DB } from '@jetstream/shared/constants';
import { formatNumber, hasModifierKey, isHKey, useGlobalEventHandler, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { MapOf, QueryHistoryItem, QueryHistorySelection, SalesforceOrgUi, UpDown } from '@jetstream/types';
import { EmptyState, Grid, GridCol, Icon, List, Modal, SearchInput, Spinner } from '@jetstream/ui';
import localforage from 'localforage';
import { createRef, FunctionComponent, useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { useAmplitude } from '../../core/analytics';
import ErrorBoundaryFallback from '../../core/ErrorBoundaryFallback';
import * as fromQueryHistoryState from './query-history.state';
import QueryHistoryEmptyState from './QueryHistoryEmptyState';
import QueryHistoryItemCard from './QueryHistoryItemCard';
import QueryHistoryWhichOrg from './QueryHistoryWhichOrg';
import QueryHistoryWhichType from './QueryHistoryWhichType';

const SHOWING_STEP = 10;

export interface QueryHistoryProps {
  selectedOrg: SalesforceOrgUi;
  onRestore?: (soql: string, tooling: boolean) => void;
}

export const QueryHistory: FunctionComponent<QueryHistoryProps> = ({ selectedOrg, onRestore }) => {
  const location = useLocation();
  const { trackEvent } = useAmplitude();
  const [queryHistoryStateMap, setQueryHistorySateMap] = useRecoilState(fromQueryHistoryState.queryHistoryState);
  const queryHistory = useRecoilValue(fromQueryHistoryState.selectQueryHistoryState);
  const [whichType, setWhichType] = useRecoilState(fromQueryHistoryState.queryHistoryWhichType);
  const [whichOrg, setWhichOrg] = useRecoilState(fromQueryHistoryState.queryHistoryWhichOrg);
  const resetWhichType = useResetRecoilState(fromQueryHistoryState.queryHistoryWhichType);
  const resetWhichOrg = useResetRecoilState(fromQueryHistoryState.queryHistoryWhichOrg);
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

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen && hasModifierKey(event as any) && isHKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(true);
      }
    },
    [isOpen]
  );

  useGlobalEventHandler('keydown', onKeydown);

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
    if (queryHistory) {
      fromQueryHistoryState.cleanUpHistoryState().then((remainingItems) => {
        if (remainingItems) {
          setQueryHistorySateMap(remainingItems);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset load more when specific properties changes
  useEffect(() => {
    setShowingUpTo(SHOWING_STEP);
  }, [isOpen, selectedObject, whichType, whichOrg]);

  useNonInitialEffect(() => {
    trackEvent(ANALYTICS_KEYS.query_HistoryChangeOrgs, { whichOrg });
  }, [whichOrg]);

  useNonInitialEffect(() => {
    trackEvent(ANALYTICS_KEYS.query_HistoryTypeChanged, { whichType });
  }, [whichType]);

  useNonInitialEffect(() => {
    if (!isOpen) {
      resetSelectedObject();
      setFilterValue('');
      setSqlFilterValue('');
      resetWhichType();
      resetWhichOrg();
    }
  }, [isOpen, resetSelectedObject, showingUpTo]);

  useEffect(() => {
    if (queryHistory) {
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
      trackEvent(ANALYTICS_KEYS.query_HistoryModalOpened);
    }
  }, [isOpen, trackEvent]);

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

  function handleExecute({ created, lastRun, runCount, isTooling, isFavorite }: QueryHistoryItem) {
    trackEvent(ANALYTICS_KEYS.query_HistoryExecute, {
      created,
      lastRun,
      runCount,
      isTooling,
      isFavorite,
    });
    onModalClose();
  }

  function onModalClose() {
    setIsOpen(false);
    resetSelectedObject();
    resetWhichType();
    resetWhichOrg();
  }

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  function handleStartRestore() {
    setIsRestoring(true);
  }

  function handleEndRestore(item: QueryHistoryItem, fatalError: boolean, errors?: any) {
    const { soql, created, lastRun, runCount, isTooling, isFavorite } = item;
    setIsRestoring(false);
    if (!fatalError) {
      setIsOpen(false);
      onRestore && onRestore(soql, isTooling);
    }
    trackEvent(ANALYTICS_KEYS.query_HistoryRestore, { created, lastRun, runCount, isTooling, isFavorite, fatalError, errors });
  }

  function showMore() {
    setShowingUpTo(showingUpTo + SHOWING_STEP);
    trackEvent(ANALYTICS_KEYS.query_HistoryShowMore);
  }

  function handleSaveFavorite(item: QueryHistoryItem, isFavorite: boolean) {
    setQueryHistorySateMap({ ...queryHistoryStateMap, [item.key]: { ...item, isFavorite } });
    trackEvent(ANALYTICS_KEYS.query_HistorySaveQueryToggled, { isFavorite });
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <button
        className="slds-button slds-button_neutral"
        aria-haspopup="true"
        title="View query history and saved queries (ctrl/command + h)"
        onClick={() => setIsOpen(true)}
      >
        <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
        View History
      </button>
      {isOpen && (
        <Modal
          header="Query History"
          className="slds-grow"
          tagline={
            <Grid align="spread" verticalAlign="center">
              <QueryHistoryWhichOrg selectedOrg={selectedOrg} whichOrg={whichOrg} onChange={setWhichOrg} />
              <QueryHistoryWhichType which={whichType} onChange={setWhichType} />
            </Grid>
          }
          size="lg"
          skipAutoFocus
          onClose={() => onModalClose()}
        >
          {isRestoring && <Spinner />}
          {selectObjectsList.length <= 1 && <QueryHistoryEmptyState whichType={whichType} whichOrg={whichOrg} />}
          {selectObjectsList.length > 1 && (
            <Grid className="slds-scrollable_y">
              <GridCol size={6} sizeMedium={4} className="slds-scrollable_y">
                <div className="slds-p-bottom--xx-small">
                  <SearchInput
                    id="query-history-object-filter"
                    className="slds-p-around_xx-small"
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
                    heading: (
                      <Grid align="spread">
                        <div className="slds-truncate">{item.label}</div>
                        {item.name !== 'all' && (
                          <Icon
                            type="utility"
                            className="slds-icon slds-icon-text-default slds-icon_x-small"
                            icon={item.isTooling ? 'setup' : 'record_lookup'}
                            title={item.isTooling ? 'Metadata Query' : 'Object Query'}
                          />
                        )}
                      </Grid>
                    ),
                    subheading: item.name !== 'all' ? item.name : '',
                  })}
                />
              </GridCol>
              <GridCol className="slds-p-horizontal_x-small slds-scrollable_y">
                <SearchInput
                  id="query-history-sql-filter"
                  className="slds-p-top_xx-small"
                  placeholder="Filter Queries"
                  autoFocus
                  value={sqlFilterValue}
                  onChange={setSqlFilterValue}
                />
                <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                  Showing {formatNumber(visibleQueryHistory.length)} of {formatNumber(queryHistory.length)} queries
                </div>
                {visibleQueryHistory.map((item) => (
                  <QueryHistoryItemCard
                    key={item.key}
                    item={item}
                    onExecute={handleExecute}
                    onSave={handleSaveFavorite}
                    startRestore={handleStartRestore}
                    endRestore={(fatalError, errors) => handleEndRestore(item, fatalError, errors)}
                  />
                ))}
                {visibleQueryHistory.length === 0 && (
                  <EmptyState headline="There are no matching queries." subHeading="Adjust your selection."></EmptyState>
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

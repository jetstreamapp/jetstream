/* eslint-disable @typescript-eslint/no-explicit-any */

import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import {
  formatNumber,
  hasModifierKey,
  hasShiftModifierKey,
  isHKey,
  useGlobalEventHandler,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { QueryHistoryItem, QueryHistorySelection, SalesforceOrgUi, UpDown } from '@jetstream/types';
import {
  ButtonGroupContainer,
  EmptyState,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  List,
  Modal,
  SearchInput,
  Spinner,
  Tooltip,
  getModifierKey,
} from '@jetstream/ui';
import { ErrorBoundaryFallback, fromQueryHistoryState, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { createRef, forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import QueryHistoryEmptyState from './QueryHistoryEmptyState';
import QueryHistoryItemCard from './QueryHistoryItemCard';
import QueryHistoryWhichOrg from './QueryHistoryWhichOrg';
import QueryHistoryWhichType from './QueryHistoryWhichType';

const SHOWING_STEP = 25;

export interface QueryHistoryRef {
  open: (type: fromQueryHistoryState.QueryHistoryType) => void;
}

export interface QueryHistoryProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
  onRestore?: (soql: string, tooling: boolean) => void;
}

export const QueryHistory = forwardRef<any, QueryHistoryProps>(({ className, selectedOrg, onRestore }, ref) => {
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

  useImperativeHandle(ref, () => {
    return {
      open: (type: fromQueryHistoryState.QueryHistoryType = 'HISTORY') => {
        handleOpenModal(type, 'externalAction');
      },
    };
  });

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen && hasModifierKey(event as any) && isHKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        handleOpenModal(hasShiftModifierKey(event as any) ? 'SAVED' : 'HISTORY', 'keyboardShortcut');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  useGlobalEventHandler('keydown', onKeydown);

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
  }, [trackEvent, whichOrg]);

  useNonInitialEffect(() => {
    trackEvent(ANALYTICS_KEYS.query_HistoryTypeChanged, { whichType });
  }, [trackEvent, whichType]);

  useNonInitialEffect(() => {
    if (!isOpen) {
      resetSelectedObject();
      setFilterValue('');
      setSqlFilterValue('');
      resetWhichType();
      resetWhichOrg();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resetSelectedObject, showingUpTo]);

  useEffect(() => {
    if (queryHistory) {
      if (!sqlFilterValue) {
        setFilteredQueryHistory(queryHistory);
      } else {
        setFilteredQueryHistory(queryHistory.filter(multiWordObjectFilter(['label', 'soql'], sqlFilterValue)));
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

  function handleOpenModal(type: fromQueryHistoryState.QueryHistoryType = 'HISTORY', source = 'buttonClick') {
    setWhichType(type);
    setIsOpen(true);
    fromQueryHistoryState.initQueryHistory().then((queryHistory) => setQueryHistorySateMap(queryHistory));
    trackEvent(ANALYTICS_KEYS.query_HistoryModalOpened, { source, type });
  }

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

  async function handleSaveFavorite(item: QueryHistoryItem, isFavorite: boolean) {
    let queryHistory = queryHistoryStateMap;
    try {
      // ensure that changes made in other browser tabs are not overwritten
      queryHistory = await fromQueryHistoryState.initQueryHistory();
    } catch (ex) {
      logger.warn('[ERROR] Could not get updated query history', ex);
    }
    setQueryHistorySateMap({ ...queryHistory, [item.key]: { ...item, isFavorite } });
    trackEvent(ANALYTICS_KEYS.query_HistorySaveQueryToggled, { location: 'modal', isFavorite });
  }

  function handleSetWhichType(type: fromQueryHistoryState.QueryHistoryType) {
    setWhichType(type);
    setWhichOrg('ALL');
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <ButtonGroupContainer>
        <Tooltip
          content={
            <div className="slds-p-bottom_small">
              View query history
              <KeyboardShortcut inverse keys={[getModifierKey(), 'h']} />
            </div>
          }
        >
          <button
            aria-label="Query History"
            className={classNames('slds-button slds-button_neutral slds-button_first', className)}
            css={css`
              padding: 0.5rem;
            `}
            aria-haspopup="true"
            onClick={() => handleOpenModal('HISTORY')}
          >
            <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
        <Tooltip
          content={
            <div className="slds-p-bottom_small">
              View saved queries
              <KeyboardShortcut inverse keys={[getModifierKey(), 'shift', 'h']} />
            </div>
          }
        >
          <button
            aria-label="Saved Queries"
            className={classNames('slds-button slds-button_neutral slds-button_last', className)}
            css={css`
              padding: 0.5rem;
            `}
            aria-haspopup="true"
            onClick={() => handleOpenModal('SAVED')}
          >
            <Icon type="utility" icon="favorite" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
      </ButtonGroupContainer>
      {isOpen && (
        <Modal
          header="Query History"
          className="slds-grow"
          tagline={
            <Grid align="spread" verticalAlign="center">
              <QueryHistoryWhichOrg selectedOrg={selectedOrg} whichOrg={whichOrg} onChange={setWhichOrg} />
              <QueryHistoryWhichType which={whichType} onChange={handleSetWhichType} />
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
                    isOnSavedQueries={whichType === 'SAVED'}
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
});

export default QueryHistory;

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
  getModifierKey,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  List,
  Modal,
  SearchInput,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import { ErrorBoundaryFallback, fromQueryHistoryState, useAmplitude } from '@jetstream/ui-core';
import { dexieDb, queryHistoryDb } from '@jetstream/ui/db';
import classNames from 'classnames';
import { useLiveQuery } from 'dexie-react-hooks';
import uniqBy from 'lodash/uniqBy';
import { createRef, forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import QueryHistoryEmptyState from './QueryHistoryEmptyState';
import QueryHistoryItemCard from './QueryHistoryItemCard';
import QueryHistoryWhichOrg from './QueryHistoryWhichOrg';
import QueryHistoryWhichType from './QueryHistoryWhichType';

const SHOWING_STEP = 25;
const SOBJECT_ALL = 'ALL';

const defaultSelectedObject: QueryHistorySelection = {
  key: SOBJECT_ALL,
  name: 'All',
  label: 'All Objects',
  isTooling: false,
};

export type QueryHistoryType = 'HISTORY' | 'SAVED';
export type WhichOrgType = 'ALL' | 'SELECTED';

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
  const [whichType, setWhichType] = useState<QueryHistoryType>('HISTORY');
  const [whichOrg, setWhichOrg] = useState<WhichOrgType>('SELECTED');
  const ulRef = createRef<HTMLUListElement>();

  const [selectedObject, setSelectedObject] = useState(SOBJECT_ALL);

  const selectObjectsList = useLiveQuery(
    () =>
      dexieDb._query_history_object
        .orderBy('sObject')
        .filter((item) => whichOrg === 'ALL' || item.org === selectedOrg.uniqueId)
        .toArray()
        .then((items) => [
          defaultSelectedObject,
          ...uniqBy(items, 'sObject').map(
            (item): QueryHistorySelection => ({
              key: item.sObject,
              name: item.sObject,
              label: item.sObjectLabel,
              isTooling: item.isTooling === 'true',
            })
          ),
        ]),
    [whichOrg],
    [] as QueryHistorySelection[]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [sObjectFilterValue, setSObjectFilterValue] = useState('');
  const [filteredSelectObjectsList, setFilteredSelectObjectsList] = useState(selectObjectsList);

  const [sqlFilterValue, setSqlFilterValue] = useState('');
  const [showingUpTo, setShowingUpTo] = useState(SHOWING_STEP);

  const filterRecordsFn = useCallback(
    (item: QueryHistoryItem) => {
      if (selectedObject !== SOBJECT_ALL && item.sObject !== selectedObject) {
        return false;
      }
      if (whichOrg === 'SELECTED' && item.org !== selectedOrg.uniqueId) {
        return false;
      }
      if (whichType === 'SAVED' && !item.isFavorite) {
        return false;
      }
      if (sqlFilterValue) {
        return multiWordObjectFilter(['label', 'soql'], sqlFilterValue)(item);
      }
      return true;
    },
    [selectedObject, selectedOrg.uniqueId, sqlFilterValue, whichOrg, whichType]
  );

  const queryHistory = useLiveQuery(
    // Since we want to sort by lastRun, we cannot use a normal where clause
    () => dexieDb.query_history.orderBy('lastRun').reverse().filter(filterRecordsFn).limit(showingUpTo).toArray(),
    [filterRecordsFn, showingUpTo],
    [] as QueryHistoryItem[]
  );

  const totalRecordCount = useLiveQuery(
    () => dexieDb.query_history.orderBy('lastRun').reverse().filter(filterRecordsFn).count(),
    [filterRecordsFn, showingUpTo],
    0
  );

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
      setSelectedObject(SOBJECT_ALL);
      setSObjectFilterValue('');
      setSqlFilterValue('');
      setWhichType('HISTORY');
      setWhichOrg('ALL');
    }
  }, [isOpen, showingUpTo]);

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
  }, [selectedObject]);

  useEffect(() => {
    if (!sObjectFilterValue && selectObjectsList !== filteredSelectObjectsList) {
      setFilteredSelectObjectsList(selectObjectsList);
    } else if (sObjectFilterValue) {
      setFilteredSelectObjectsList(
        selectObjectsList.filter(multiWordObjectFilter(['name', 'label'], sObjectFilterValue, (item) => item.key === SOBJECT_ALL))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectObjectsList, sObjectFilterValue]);

  function handleOpenModal(type: fromQueryHistoryState.QueryHistoryType = 'HISTORY', source = 'buttonClick') {
    setWhichType(type);
    setIsOpen(true);
    trackEvent(ANALYTICS_KEYS.query_HistoryModalOpened, { source, type });
  }

  function handleExecute({ createdAt, lastRun, runCount, isTooling, isFavorite }: QueryHistoryItem) {
    trackEvent(ANALYTICS_KEYS.query_HistoryExecute, {
      created: createdAt,
      lastRun,
      runCount,
      isTooling,
      isFavorite,
    });
    onModalClose();
  }

  function onModalClose() {
    setIsOpen(false);
    setWhichType('HISTORY');
    setWhichOrg('ALL');
    setSelectedObject(SOBJECT_ALL);
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
    const { soql, createdAt, lastRun, runCount, isTooling, isFavorite } = item;
    setIsRestoring(false);
    if (!fatalError) {
      setIsOpen(false);
      onRestore && onRestore(soql, isTooling);
    }
    trackEvent(ANALYTICS_KEYS.query_HistoryRestore, { created: createdAt, lastRun, runCount, isTooling, isFavorite, fatalError, errors });
  }

  function showMore() {
    setShowingUpTo(showingUpTo + SHOWING_STEP);
    trackEvent(ANALYTICS_KEYS.query_HistoryShowMore);
  }

  async function handleSaveFavorite(item: QueryHistoryItem, isFavorite: boolean) {
    try {
      await queryHistoryDb.setAsFavorite(item.key, isFavorite);
    } catch (ex) {
      logger.warn('[ERROR] Could not update query history', ex);
    }
    trackEvent(ANALYTICS_KEYS.query_HistorySaveQueryToggled, { location: 'modal', isFavorite });
  }

  async function handleEdit(item: QueryHistoryItem, customLabel: string | null) {
    try {
      await queryHistoryDb.updateCustomLabel(item.key, customLabel);
    } catch (ex) {
      logger.warn('[ERROR] Could not update query history', ex);
    }
    trackEvent(ANALYTICS_KEYS.query_HistoryUpdateLabel, {
      location: 'modal',
      hadPriorCustomLabel: !!item.customLabel,
      isReset: !customLabel,
    });
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
                    value={sObjectFilterValue}
                    onChange={setSObjectFilterValue}
                    onArrowKeyUpDown={handleSearchKeyboard}
                  />
                  <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                    Showing {formatNumber(filteredSelectObjectsList.length)} of {formatNumber(selectObjectsList.length)} objects
                  </div>
                </div>
                <List
                  ref={ulRef}
                  items={filteredSelectObjectsList}
                  isActive={(item: QueryHistorySelection) => item.key === selectedObject}
                  subheadingPlaceholder
                  onSelected={setSelectedObject}
                  getContent={(item: QueryHistorySelection) => ({
                    key: item.key,
                    heading: (
                      <Grid align="spread">
                        <div className="slds-truncate">{item.label}</div>
                        {item.key !== SOBJECT_ALL && (
                          <Icon
                            type="utility"
                            className="slds-icon slds-icon-text-default slds-icon_x-small"
                            icon={item.isTooling ? 'setup' : 'record_lookup'}
                            title={item.isTooling ? 'Metadata Query' : 'Object Query'}
                          />
                        )}
                      </Grid>
                    ),
                    subheading: item.key !== SOBJECT_ALL ? item.name : '',
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
                  Showing {formatNumber(queryHistory.length)} of {formatNumber(totalRecordCount)} queries
                </div>
                {queryHistory.map((item) => (
                  <QueryHistoryItemCard
                    key={item.key}
                    isOnSavedQueries={whichType === 'SAVED'}
                    item={item}
                    onExecute={handleExecute}
                    onUpdate={handleEdit}
                    onSave={handleSaveFavorite}
                    startRestore={handleStartRestore}
                    endRestore={(fatalError, errors) => handleEndRestore(item, fatalError, errors)}
                  />
                ))}
                {queryHistory.length === 0 && (
                  <EmptyState headline="There are no matching queries." subHeading="Adjust your selection."></EmptyState>
                )}
                {queryHistory.length < totalRecordCount && (
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

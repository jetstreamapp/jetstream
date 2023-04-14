/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { QueryResults as IQueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import {
  formatNumber,
  hasModifierKey,
  isMKey,
  useBrowserNotifications,
  useGlobalEventHandler,
  useLocationState,
  useNonInitialEffect,
  useObservable,
} from '@jetstream/shared/ui-utils';
import { getRecordIdFromAttributes, getSObjectNameFromAttributes, pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  AsyncJob,
  AsyncJobNew,
  BulkDownloadJob,
  CloneEditView,
  FileExtCsvXLSXJsonGSheet,
  MapOf,
  Maybe,
  Record,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  CampingRainIllustration,
  EmptyState,
  Grid,
  GridCol,
  Icon,
  RecordDownloadModal,
  SalesforceRecordDataTable,
  Spinner,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
  useConfirmation,
} from '@jetstream/ui';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import { Query, WhereClause } from 'soql-parser-js';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import ViewEditCloneRecord from '../../core/ViewEditCloneRecord';
import * as fromQueryState from '../query.state';
import * as fromQueryHistory from '../QueryHistory/query-history.state';
import QueryHistory, { QueryHistoryRef } from '../QueryHistory/QueryHistory';
import IncludeDeletedRecordsToggle from '../QueryOptions/IncludeDeletedRecords';
import { getFlattenSubqueryFlattenedFieldMap } from '../utils/query-utils';
import useQueryRestore from '../utils/useQueryRestore';
import QueryResultsAttachmentDownload, { FILE_DOWNLOAD_FIELD_MAP } from './QueryResultsAttachmentDownload';
import QueryResultsCopyToClipboard from './QueryResultsCopyToClipboard';
import QueryResultsDownloadButton from './QueryResultsDownloadButton';
import QueryResultsGetRecAsApexModal from './QueryResultsGetRecAsApexModal';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import QueryResultsViewRecordFields from './QueryResultsViewRecordFields';
import { useQueryResultsFetchMetadata } from './useQueryResultsFetchMetadata';
import copyToClipboard from 'copy-to-clipboard';

type SourceAction = 'STANDARD' | 'ORG_CHANGE' | 'BULK_DELETE' | 'HISTORY' | 'RECORD_ACTION' | 'MANUAL' | 'RELOAD';

const SOURCE_STANDARD: SourceAction = 'STANDARD';
const SOURCE_ORG_CHANGE: SourceAction = 'ORG_CHANGE';
const SOURCE_BULK_DELETE: SourceAction = 'BULK_DELETE';
const SOURCE_HISTORY: SourceAction = 'HISTORY';
const SOURCE_RECORD_ACTION: SourceAction = 'RECORD_ACTION';
const SOURCE_MANUAL: SourceAction = 'MANUAL';
const SOURCE_RELOAD: SourceAction = 'RELOAD';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = React.memo(() => {
  const isMounted = useRef(true);
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const queryHistoryRef = useRef<QueryHistoryRef>();
  const previousSoql = useRecoilValue(fromQueryState.querySoqlState);
  const includeDeletedRecords = useRecoilValue(fromQueryState.queryIncludeDeletedRecordsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);
  const [isTooling, setIsTooling] = useRecoilState(fromQueryState.isTooling);
  const location = useLocation();
  const locationState = useLocationState<{
    soql: string;
    isTooling: boolean;
    fromHistory?: boolean;
    sobject?: { name: string; label: string };
  }>();
  const [soqlPanelOpen, setSoqlPanelOpen] = useState<boolean>(false);
  const [soql, setSoql] = useState<string>('');
  const [sobject, setSobject] = useState<Maybe<string>>(null);
  const [parsedQuery, setParsedQuery] = useState<Maybe<Query>>(null);
  const [queryResults, setQueryResults] = useState<IQueryResults | null>(null);
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [records, setRecords] = useState<Record[] | null>(null);
  const [nextRecordsUrl, setNextRecordsUrl] = useState<Maybe<string>>(null);
  const [fields, setFields] = useState<string[] | null>(null);
  const [modifiedFields, setModifiedFields] = useState<string[] | null>(null);
  const [subqueryFields, setSubqueryFields] = useState<Maybe<MapOf<string[]>>>(null);
  const [filteredRows, setFilteredRows] = useState<Record[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [{ serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [totalRecordCount, setTotalRecordCount] = useState<number | null>(null);
  const [queryHistory, setQueryHistory] = useRecoilState(fromQueryHistory.queryHistoryState);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents.getObservable('jobFinished').pipe(filter((ev: AsyncJob) => ev.type === 'BulkDelete'))
  );
  const confirm = useConfirmation();
  const { notifyUser } = useBrowserNotifications(serverUrl, window.electron?.isFocused);

  const [cloneEditViewRecord, setCloneEditViewRecord] = useState<{
    action: CloneEditView;
    sobjectName: string;
    recordId: string | null;
  } | null>(null);
  const [getRecordAsApex, setGetRecordAsApex] = useState<{ record: any; sobjectName: string } | null>(null);
  const [restore] = useQueryRestore(soql, isTooling, { silent: true });

  const [allowContentDownload, setAllowContentDownload] = useState<{
    enabled: boolean;
    sobjectName: string | null;
    missingFields: string[];
  }>({
    enabled: false,
    missingFields: [],
    sobjectName: null,
  });

  const { fieldMetadata, fieldMetadataSubquery } = useQueryResultsFetchMetadata(selectedOrg, queryResults?.parsedQuery, isTooling);

  // ensure that on a page refresh, the query is restored from browser state if it exists
  useEffect(() => {
    if (!locationState && window.history?.state?.state?.soql) {
      navigate('', { replace: true, state: window.history.state.state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (hasModifierKey(event as any) && isMKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        setSoqlPanelOpen(!soqlPanelOpen);
      }
    },
    [soqlPanelOpen]
  );

  useGlobalEventHandler('keydown', onKeydown);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (queryResults?.queryResults?.records) {
      document.title = `${formatNumber(queryResults.queryResults.records.length)} Records ${TITLES.BAR_JETSTREAM}`;
    } else {
      document.title = TITLES.QUERY;
    }
  }, [queryResults]);

  useEffect(() => {
    if (bulkDeleteJob && executeQuery && soql) {
      executeQuery(soql, SOURCE_BULK_DELETE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkDeleteJob]);

  useNonInitialEffect(() => {
    if (soqlPanelOpen) {
      trackEvent(ANALYTICS_KEYS.query_ManualSoqlOpened, { isTooling });
    }
  }, [isTooling, soqlPanelOpen, trackEvent]);

  useEffect(() => {
    logger.log({ location });
    if (locationState) {
      setSoql(locationState.soql || '');
      setIsTooling(locationState.isTooling ? true : false);
      locationState.soql &&
        executeQuery(locationState.soql, locationState.fromHistory ? SOURCE_HISTORY : SOURCE_STANDARD, {
          isTooling: locationState.isTooling,
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (priorSelectedOrg && selectedOrg && selectedOrg.uniqueId !== priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      executeQuery(soql, SOURCE_ORG_CHANGE, { forceRestore: true, isTooling });
    } else {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  async function saveQueryHistory(soql: string, sObject: string, tooling: boolean) {
    let sObjectLabel: string | undefined = undefined;
    // if object name did not change since last query, use data from location
    if (locationState?.sobject) {
      if (locationState.sobject.name === sObject) {
        sObjectLabel = locationState.sobject.label;
      }
    }
    if (soql && sObject) {
      try {
        // eslint-disable-next-line prefer-const
        let { queryHistoryItem, refreshedQueryHistory } = await fromQueryHistory.getQueryHistoryItem(
          selectedOrg,
          soql,
          sObject,
          sObjectLabel,
          tooling
        );
        refreshedQueryHistory = refreshedQueryHistory || queryHistory;
        // increment count and ensure certain properties are not overwritten
        if (refreshedQueryHistory && refreshedQueryHistory[queryHistoryItem.key]) {
          queryHistoryItem.runCount = refreshedQueryHistory[queryHistoryItem.key].runCount + 1;
          queryHistoryItem.created = refreshedQueryHistory[queryHistoryItem.key].created;
          queryHistoryItem.label = refreshedQueryHistory[queryHistoryItem.key].label;
          queryHistoryItem.isFavorite = refreshedQueryHistory[queryHistoryItem.key].isFavorite;
        }
        setQueryHistory({ ...refreshedQueryHistory, [queryHistoryItem.key]: queryHistoryItem });
      } catch (ex) {
        logger.warn(ex);
      }
    }
  }

  async function executeQuery(
    soqlQuery: string,
    source: SourceAction,
    options: {
      forceRestore?: boolean;
      isTooling?: boolean;
    } = { forceRestore: false, isTooling: false }
  ) {
    const forceRestore = options.forceRestore ?? false;
    const tooling = options.isTooling ?? false;
    try {
      setLoading(true);
      if (soql !== soqlQuery) {
        setSoql(soqlQuery);
      }
      if (isTooling !== tooling) {
        setIsTooling(tooling);
      }
      setRecords(null);
      setRecordCount(null);
      // setFields(null);
      setSubqueryFields(null);
      const results = await query(selectedOrg, soqlQuery, tooling, !tooling && includeDeletedRecords);
      if (!isMounted.current) {
        return;
      }
      setQueryResults(results);
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      setRecordCount(results.queryResults.totalSize);
      setRecords(results.queryResults.records);
      setSubqueryFields(getFlattenSubqueryFlattenedFieldMap(results.parsedQuery));
      // Matching ReactRouter state format
      window.history.replaceState({ state: { soql: soqlQuery, isTooling: tooling } }, '');

      setTotalRecordCount(results.queryResults.totalSize);
      setErrorMessage(null);

      notifyUser(`Your query is finished`, {
        body: `${results.queryResults.totalSize.toLocaleString()} total records`,
        tag: 'query',
      });

      handleDownloadContentConfig(results);

      if (forceRestore || previousSoql !== soqlQuery) {
        restore(soqlQuery, tooling);
      }
      trackEvent(ANALYTICS_KEYS.query_ExecuteQuery, { source, success: true, isTooling: tooling, includeDeletedRecords });

      const sobjectName = results.parsedQuery?.sObject || results.columns?.entityName;
      sobjectName && (await saveQueryHistory(soqlQuery, sobjectName, tooling));
      setSobject(sobjectName);
      setParsedQuery(results.parsedQuery);
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      logger.warn('ERROR', ex);
      setErrorMessage(ex.message);
      setSoqlPanelOpen(true);
      trackEvent(ANALYTICS_KEYS.query_ExecuteQuery, { source, success: false, isTooling: tooling, includeDeletedRecords });
      notifyUser(`Your query failed`, {
        body: ex.message,
        tag: 'query',
      });
      setSobject(null);
      setParsedQuery(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Enable content downloads for allowed objects
   * This is evaluated after each query
   */
  function handleDownloadContentConfig(results: IQueryResults<any>) {
    // Configure file download content
    if (results.parsedQuery?.sObject && FILE_DOWNLOAD_FIELD_MAP.has(results.parsedQuery.sObject.toLowerCase())) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { bodyField, nameField, sizeField } = FILE_DOWNLOAD_FIELD_MAP.get(results.parsedQuery.sObject.toLowerCase())!;
      const missingFields: string[] = [];
      const fields = new Set(
        results.parsedQuery.fields?.map((field) => field.type === 'Field' && field.field.toLowerCase()).filter(Boolean) || []
      );
      if (!fields.has(bodyField.toLowerCase())) {
        missingFields.push(bodyField);
      }
      if (!fields.has(nameField.toLowerCase())) {
        missingFields.push(nameField);
      }
      if (!fields.has(sizeField.toLowerCase())) {
        missingFields.push(sizeField);
      }
      setAllowContentDownload({ enabled: true, missingFields, sobjectName: results.parsedQuery.sObject });
    } else {
      if (allowContentDownload.enabled) {
        setAllowContentDownload({ enabled: false, missingFields: [], sobjectName: null });
      }
    }
  }

  function handleBulkRowAction(id: string, rows: Record[]) {
    logger.log({ id, rows });
    switch (id) {
      case 'delete record': {
        const recordCountText = `${rows.length} ${pluralizeIfMultiple('Record', rows)}`;
        confirm({
          content: (
            <div className="slds-m-around_medium">
              <p className="slds-align_absolute-center slds-m-bottom_small">
                Are you sure you want to <span className="slds-text-color_destructive slds-p-left_xx-small">delete {recordCountText}</span>?
              </p>
              <p>
                <strong>These records will be deleted from Salesforce.</strong> If you want to recover deleted records you can use the
                Salesforce recycle bin.
              </p>
            </div>
          ),
        }).then(() => {
          const jobs: AsyncJobNew[] = [
            {
              type: 'BulkDelete',
              title: `Delete ${recordCountText}`,
              org: selectedOrg,
              meta: rows,
            },
          ];
          fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
          trackEvent(ANALYTICS_KEYS.query_BulkDelete, { numRecords: rows.length });
        });
        break;
      }
      default:
        break;
    }
  }

  function handleLoadMore(results: IQueryResults<any>) {
    if (isMounted.current) {
      const sobjectName = results.parsedQuery?.sObject || results.columns?.entityName;
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      sobjectName && saveQueryHistory(soql, sobjectName, isTooling);
      records && setRecords(records.concat(results.queryResults.records));
      trackEvent(ANALYTICS_KEYS.query_LoadMore, {
        existingRecordCount: records?.length || 0,
        nextSetCount: results.queryResults.records.length,
        totalSize: results.queryResults.totalSize,
        isTooling,
      });
    }
  }

  function hasRecords() {
    return !loading && !errorMessage && !!records?.length;
  }

  function handleCloneEditView(record: any, action: CloneEditView) {
    setCloneEditViewRecord({
      action,
      recordId: record.Id || getRecordIdFromAttributes(record),
      sobjectName: getSObjectNameFromAttributes(record),
    });
    trackEvent(ANALYTICS_KEYS.query_RecordAction, { action });
  }

  function handleChangeAction(action: CloneEditView) {
    setCloneEditViewRecord((currentAction) => (currentAction ? { ...currentAction, action } : null));
  }

  async function handleCloseEditCloneModal(reloadRecords?: boolean) {
    setCloneEditViewRecord(null);
    if (reloadRecords) {
      executeQuery(soql, SOURCE_RECORD_ACTION, { isTooling });
    }
  }

  function handleGetAsApex(record: any) {
    setGetRecordAsApex({
      record: record,
      sobjectName: getSObjectNameFromAttributes(record),
    });
  }

  function handleGetAsApexClose() {
    setGetRecordAsApex(null);
  }

  function handleGetAsJson(record: any) {
    copyToClipboard(JSON.stringify(record, null, 2), { format: 'text/plain' });
  }

  function handleRestoreFromHistory(soql: string, tooling) {
    navigate(`/query`, { state: { soql, isTooling: tooling, fromHistory: true } });
  }

  function handleCreateNewRecord() {
    if (queryResults?.parsedQuery?.sObject) {
      setCloneEditViewRecord({
        action: 'create',
        recordId: null,
        sobjectName: queryResults?.parsedQuery?.sObject,
      });
      trackEvent(ANALYTICS_KEYS.query_RecordAction, { action: 'create' });
    }
  }

  function handleFieldsChanged({ allFields, visibleFields }: { allFields: string[]; visibleFields: string[] }) {
    setFields(allFields);
    setModifiedFields(visibleFields);
  }

  function handleOpenHistory(type: fromQueryHistory.QueryHistoryType) {
    queryHistoryRef.current?.open(type);
  }

  return (
    <div data-testid="query-results-page">
      {cloneEditViewRecord && cloneEditViewRecord.recordId && (
        <ViewEditCloneRecord
          apiVersion={defaultApiVersion}
          selectedOrg={selectedOrg}
          action={cloneEditViewRecord.action}
          sobjectName={cloneEditViewRecord.sobjectName}
          recordId={cloneEditViewRecord.recordId}
          onClose={handleCloseEditCloneModal}
          onChangeAction={handleChangeAction}
        />
      )}
      {getRecordAsApex && (
        <QueryResultsGetRecAsApexModal
          org={selectedOrg}
          record={getRecordAsApex.record}
          sobjectName={getRecordAsApex.sobjectName}
          onClose={handleGetAsApexClose}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to="/query" state={{ soql }}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Back
          </Link>
          <button
            className={classNames('slds-button collapsible-button collapsible-button-md', {
              'slds-button_neutral': !soqlPanelOpen,
              'slds-button_brand': soqlPanelOpen,
            })}
            title="View or manually edit SOQL query (ctrl/command + m)"
            onClick={() => setSoqlPanelOpen(!soqlPanelOpen)}
          >
            <Icon type="utility" icon="component_customization" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>SOQL Query</span>
          </button>
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-md"
            onClick={() => executeQuery(soql, SOURCE_RELOAD, { isTooling })}
            disabled={!!(loading || errorMessage)}
            title="Re-run the current query"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>Reload</span>
          </button>
          <QueryHistory ref={queryHistoryRef} selectedOrg={selectedOrg} onRestore={handleRestoreFromHistory} />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          {/* FIXME: strongly type me! */}
          {!isTooling && (
            <Tooltip content={selectedRows.length === 0 ? 'Select one or more records' : 'Delete selected records'}>
              <button
                className={classNames('slds-button slds-button_icon slds-button_icon-border slds-m-right_xx-small', {
                  'slds-button_icon-error': selectedRows.length !== 0,
                })}
                disabled={selectedRows.length === 0}
                onClick={() => handleBulkRowAction('delete record', selectedRows)}
              >
                <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
              </button>
            </Tooltip>
          )}
          <QueryResultsCopyToClipboard
            className="collapsible-button collapsible-button-md"
            hasRecords={hasRecords()}
            fields={modifiedFields || []}
            records={records || []}
            filteredRows={filteredRows}
            selectedRows={selectedRows}
            isTooling={isTooling}
          />
          <QueryResultsDownloadButton
            selectedOrg={selectedOrg}
            sObject={sobject}
            soql={soql}
            parsedQuery={parsedQuery}
            columns={queryResults?.columns?.columns || []}
            disabled={!hasRecords()}
            isTooling={isTooling}
            nextRecordsUrl={nextRecordsUrl}
            fields={fields || []}
            modifiedFields={modifiedFields || []}
            subqueryFields={subqueryFields}
            records={records || []}
            filteredRows={filteredRows}
            selectedRows={selectedRows}
            totalRecordCount={totalRecordCount || 0}
            refreshRecords={() => executeQuery(soql, SOURCE_RELOAD, { isTooling })}
          />
        </ToolbarItemActions>
      </Toolbar>
      <div className="slds-grid">
        <QueryResultsSoqlPanel
          soql={soql}
          isTooling={isTooling}
          isOpen={soqlPanelOpen}
          selectedOrg={selectedOrg}
          sObject={allowContentDownload.sobjectName || ''}
          onClosed={() => setSoqlPanelOpen(false)}
          executeQuery={(soql, tooling) => executeQuery(soql, SOURCE_MANUAL, { isTooling: tooling })}
          onOpenHistory={handleOpenHistory}
        />
        <AutoFullHeightContainer
          className="slds-scrollable bg-white"
          bottomBuffer={10}
          css={css`
            width: 100%;
          `}
        >
          {loading && <Spinner />}
          {/* this only shows content if allowContentDownload.enabled is true  */}
          <Grid className="slds-m-left_small">
            <QueryResultsAttachmentDownload
              selectedOrg={selectedOrg}
              enabled={allowContentDownload.enabled}
              sobjectName={allowContentDownload.sobjectName}
              missingFields={allowContentDownload.missingFields}
              selectedRecords={selectedRows}
              hasRecords={!loading && !errorMessage && !!records?.length && !!recordCount}
            />
          </Grid>
          {errorMessage && (
            <div className="slds-m-around_medium slds-box slds-text-color_error">
              <div className="slds-inline_icon_text slds-grid">
                <Icon
                  type="utility"
                  icon="error"
                  className="slds-icon slds-icon_x-small slds-m-right--small slds-icon-text-error"
                  containerClassname="slds-icon_container slds-icon-utility-error"
                />
                <div className="slds-col slds-align-middle">
                  There is an error with your query. Either <NavLink to="/query">go back</NavLink> to the query builder or manually adjust
                  your query.
                </div>
              </div>
              <pre>
                <code>{errorMessage}</code>
              </pre>
            </div>
          )}
          {!!(!loading && !errorMessage && !records?.length && !recordCount) && (
            <Fragment>
              <Grid className="slds-p-around_xx-small">
                <GridCol extraProps={{ dir: 'rtl' }} bump="left">
                  <IncludeDeletedRecordsToggle />
                </GridCol>
              </Grid>
              <EmptyState
                size="large"
                headline="There are no records matching your query"
                subHeading="Go back and adjust your query or create a new record."
                illustration={<CampingRainIllustration />}
              >
                <Link className="slds-button slds-button_brand" to="/query" state={{ soql }}>
                  <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Go Back
                </Link>
                {queryResults?.parsedQuery?.sObject && (
                  <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleCreateNewRecord}>
                    Create a new record
                  </button>
                )}
              </EmptyState>
            </Fragment>
          )}
          {!!(!loading && !errorMessage && !records?.length && recordCount) && (
            <div className="slds-col slds-text-heading_small slds-p-around_medium">
              Record Count: <strong>{recordCount}</strong>
            </div>
          )}
          {!!(records && !!records.length) && (
            <SalesforceRecordDataTable
              org={selectedOrg}
              google_apiKey={google_apiKey}
              google_appId={google_appId}
              google_clientId={google_clientId}
              isTooling={isTooling}
              serverUrl={serverUrl}
              queryResults={queryResults}
              fieldMetadata={fieldMetadata}
              fieldMetadataSubquery={fieldMetadataSubquery}
              summaryHeaderRightContent={
                <div dir="rtl">
                  <IncludeDeletedRecordsToggle />
                </div>
              }
              onSelectionChanged={setSelectedRows}
              onFields={handleFieldsChanged}
              onFilteredRowsChanged={setFilteredRows}
              onLoadMoreRecords={handleLoadMore}
              onEdit={(record) => {
                handleCloneEditView(record, 'edit');
              }}
              onClone={(record) => {
                handleCloneEditView(record, 'clone');
              }}
              onView={(record) => {
                handleCloneEditView(record, 'view');
              }}
              onGetAsApex={(record) => {
                handleGetAsApex(record);
              }}
              onGetAsJson={(record) => {
                handleGetAsJson(record);
              }}
            />
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

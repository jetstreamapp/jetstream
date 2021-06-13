/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { QueryResults as IQueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import { hasModifierKey, isMKey, useGlobalEventHandler, useNonInitialEffect, useObservable } from '@jetstream/shared/ui-utils';
import { getRecordIdFromAttributes, getSObjectNameFromAttributes, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { AsyncJob, AsyncJobNew, BulkDownloadJob, CloneEditView, FileExtCsvXLSX, Record, SalesforceOrgUi } from '@jetstream/types';
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
  useConfirmation,
} from '@jetstream/ui';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useHistory, useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import * as fromQueryState from '../query.state';
import * as fromQueryHistory from '../QueryHistory/query-history.state';
import QueryHistory from '../QueryHistory/QueryHistory';
import IncludeDeletedRecordsToggle from '../QueryOptions/IncludeDeletedRecords';
import useQueryRestore from '../utils/useQueryRestore';
import QueryResultsCopyToClipboard from './QueryResultsCopyToClipboard';
import QueryResultsGetRecAsApexModal from './QueryResultsGetRecAsApexModal';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import QueryResultsViewRecordFields from './QueryResultsViewRecordFields';
import { useQueryResultsFetchMetadata } from './useQueryResultsFetchMetadata';
import ViewEditCloneRecord from './ViewEditCloneRecord';

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
  const isMounted = useRef(null);
  const history = useHistory();
  const { trackEvent } = useAmplitude();
  const previousSoql = useRecoilValue(fromQueryState.querySoqlState);
  const includeDeletedRecords = useRecoilValue(fromQueryState.queryIncludeDeletedRecordsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  const [isTooling, setIsTooling] = useRecoilState(fromQueryState.isTooling);
  const location = useLocation<{ soql: string; isTooling: boolean; fromHistory?: boolean; sobject?: { name: string; label: string } }>();
  const [soqlPanelOpen, setSoqlPanelOpen] = useState<boolean>(false);
  const [recordDetailPanelOpen, setRecordDetailPanelOpen] = useState<boolean>(false);
  const [recordDetailSelectedRow, setRecordDetailSelectedRow] = useState<Record>(null);
  const [soql, setSoql] = useState<string>(null);
  const [userSoql, setUserSoql] = useState<string>(null);
  const [queryResults, setQueryResults] = useState<IQueryResults>(null);
  const [recordCount, setRecordCount] = useState<number>(null);
  const [records, setRecords] = useState<Record[]>(null);
  const [nextRecordsUrl, setNextRecordsUrl] = useState<string>(null);
  const [fields, setFields] = useState<string[]>(null);
  const [filteredRows, setFilteredRows] = useState<Record[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [{ serverUrl, defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [totalRecordCount, setTotalRecordCount] = useState<number>(null);
  const [queryHistory, setQueryHistory] = useRecoilState(fromQueryHistory.queryHistoryState);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents.getObservable('jobFinished').pipe(filter((ev: AsyncJob) => ev.type === 'BulkDelete'))
  );
  const confirm = useConfirmation();

  const [cloneEditViewRecord, setCloneEditViewRecord] = useState<{ action: CloneEditView; sobjectName: string; recordId: string }>();
  const [getRecordAsApex, setGetRecordAsApex] = useState<{ record: any; sobjectName: string }>();
  const [restore] = useQueryRestore(soql, isTooling, { silent: true });

  const { fieldMetadata, fieldMetadataSubquery } = useQueryResultsFetchMetadata(selectedOrg, queryResults?.parsedQuery, isTooling);

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
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (bulkDeleteJob && executeQuery) {
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
    if (location.state) {
      setSoql(location.state.soql || '');
      setUserSoql(location.state.soql || '');
      setIsTooling(location.state.isTooling ? true : false);
      executeQuery(location.state.soql, location.state.fromHistory ? SOURCE_HISTORY : SOURCE_STANDARD, {
        isTooling: location.state.isTooling,
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

  function saveQueryHistory(soql: string, sObject: string, tooling: boolean) {
    let sObjectLabel: string;
    // if object name did not change since last query, use data from location
    if (location?.state?.sobject) {
      if (location.state.sobject.name === sObject) {
        sObjectLabel = location.state.sobject.label;
      }
    }
    if (soql && sObject) {
      fromQueryHistory
        .getQueryHistoryItem(selectedOrg, soql, sObject, sObjectLabel, tooling)
        .then(({ queryHistoryItem, refreshedQueryHistory }) => {
          refreshedQueryHistory = refreshedQueryHistory || queryHistory;
          if (refreshedQueryHistory && refreshedQueryHistory[queryHistoryItem.key]) {
            queryHistoryItem.runCount = refreshedQueryHistory[queryHistoryItem.key].runCount + 1;
            queryHistoryItem.created = refreshedQueryHistory[queryHistoryItem.key].created;
            queryHistoryItem.isFavorite = refreshedQueryHistory[queryHistoryItem.key].isFavorite;
          }
          setQueryHistory({ ...refreshedQueryHistory, [queryHistoryItem.key]: queryHistoryItem });
        })
        .catch((ex) => logger.warn(ex));
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
      const results = await query(selectedOrg, soqlQuery, tooling, !tooling && includeDeletedRecords);
      if (!isMounted.current) {
        return;
      }
      setQueryResults(results);
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      saveQueryHistory(soqlQuery, results.parsedQuery?.sObject || results.columns?.entityName, tooling);
      setRecordCount(results.queryResults.totalSize);
      setRecords(results.queryResults.records);
      setTotalRecordCount(results.queryResults.totalSize);
      setErrorMessage(null);

      if (forceRestore || previousSoql !== soqlQuery) {
        restore(soqlQuery, tooling);
      }
      trackEvent(ANALYTICS_KEYS.query_ExecuteQuery, { source, success: true, isTooling: tooling, includeDeletedRecords });
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      logger.warn('ERROR', ex);
      setErrorMessage(ex.message);
      setSoqlPanelOpen(true);
      trackEvent(ANALYTICS_KEYS.query_ExecuteQuery, { source, success: false, isTooling: tooling, includeDeletedRecords });
    } finally {
      setLoading(false);
    }
  }

  function handleBulkRowAction(id: string, rows: Record[]) {
    logger.log({ id, rows });
    switch (id) {
      case 'delete record': {
        const recordCountText = `${rows.length} ${pluralizeIfMultiple('Record', rows)}`;
        confirm({
          content: <div className="slds-m-around_medium">Are you sure you want to delete {recordCountText}?</div>,
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

  function handleDidDownload(fileFormat: FileExtCsvXLSX, fileName: string, userOverrideFields: boolean) {
    trackEvent(ANALYTICS_KEYS.query_DownloadResults, { source: 'BROWSER', fileFormat, isTooling, userOverrideFields });
  }

  function handleDownloadFromServer(fileFormat: FileExtCsvXLSX, fileName: string, fields: string[]) {
    const jobs: AsyncJobNew<BulkDownloadJob>[] = [
      {
        type: 'BulkDownload',
        title: `Download Records`,
        org: selectedOrg,
        meta: {
          isTooling,
          fields,
          records: records,
          totalRecordCount,
          nextRecordsUrl,
          fileFormat,
          fileName,
        },
      },
    ];
    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
    trackEvent(ANALYTICS_KEYS.query_DownloadResults, { source: 'SERVER', fileFormat, isTooling });
  }

  function handleLoadMore(results: IQueryResults<any>) {
    if (isMounted.current) {
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      saveQueryHistory(soql, results.parsedQuery?.sObject || results.columns?.entityName, isTooling);
      setRecords(records.concat(results.queryResults.records));
      trackEvent(ANALYTICS_KEYS.query_LoadMore, {
        existingRecordCount: records.length,
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
    setCloneEditViewRecord((currentAction) => ({ ...currentAction, action }));
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

  function handleRestoreFromHistory(soql: string, tooling) {
    history.push(`/query`, { soql, isTooling: tooling, fromHistory: true });
  }

  return (
    <div>
      <RecordDownloadModal
        org={selectedOrg}
        downloadModalOpen={downloadModalOpen}
        fields={fields}
        records={records}
        filteredRecords={filteredRows}
        selectedRecords={selectedRows}
        totalRecordCount={totalRecordCount}
        onModalClose={() => setDownloadModalOpen(false)}
        onDownload={handleDidDownload}
        onDownloadFromServer={handleDownloadFromServer}
      />
      {cloneEditViewRecord && (
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
          <Link
            className="slds-button slds-button_brand"
            to={{
              pathname: `/query`,
              state: { soql },
            }}
          >
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
          <button
            className={classNames('slds-button', { 'slds-button_neutral': !soqlPanelOpen, 'slds-button_brand': soqlPanelOpen })}
            title="View or manually edit SOQL query (ctrl/command + m)"
            onClick={() => setSoqlPanelOpen(!soqlPanelOpen)}
          >
            <Icon type="utility" icon="component_customization" className="slds-button__icon slds-button__icon_left" omitContainer />
            Manage SOQL Query
          </button>
          <button
            className="slds-button slds-button_neutral"
            onClick={() => executeQuery(soql, SOURCE_RELOAD, { isTooling })}
            disabled={!!(loading || errorMessage)}
            title="Re-run the current query"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Re-load
          </button>
          <QueryHistory selectedOrg={selectedOrg} onRestore={handleRestoreFromHistory} />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          {/* FIXME: strongly type me! */}
          <button
            className="slds-button slds-button_text-destructive"
            disabled={selectedRows.length === 0 || isTooling}
            onClick={() => handleBulkRowAction('delete record', selectedRows)}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
            Delete Selected
          </button>
          <QueryResultsCopyToClipboard
            hasRecords={hasRecords()}
            fields={fields}
            records={records}
            filteredRows={filteredRows}
            selectedRows={selectedRows}
            isTooling={isTooling}
          />
          <button className="slds-button slds-button_brand" onClick={() => setDownloadModalOpen(true)} disabled={!hasRecords()}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Records
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <div className="slds-grid">
        <QueryResultsSoqlPanel
          soql={soql}
          isTooling={isTooling}
          isOpen={soqlPanelOpen}
          onClosed={() => setSoqlPanelOpen(false)}
          executeQuery={(soql, tooling) => executeQuery(soql, SOURCE_MANUAL, { isTooling: tooling })}
        />
        <QueryResultsViewRecordFields
          org={selectedOrg}
          row={recordDetailSelectedRow}
          isOpen={recordDetailPanelOpen}
          onClosed={() => setRecordDetailPanelOpen(false)}
        />
        <AutoFullHeightContainer
          className="slds-scrollable bg-white"
          bottomBuffer={10}
          css={css`
            width: 100%;
          `}
        >
          {loading && <Spinner />}
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
                headline="Your query yielded no results!"
                subHeading="There are no records matching your query."
                illustration={<CampingRainIllustration />}
              >
                <Link
                  className="slds-button slds-button_brand"
                  to={{
                    pathname: `/query`,
                    state: { soql },
                  }}
                >
                  <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Go Back
                </Link>
              </EmptyState>
            </Fragment>
          )}
          {!!(!loading && !errorMessage && !records?.length && recordCount) && (
            <div className="slds-col slds-text-heading_small slds-p-around_medium">
              Record Count: <strong>{recordCount}</strong>
            </div>
          )}
          {!!(records && !!records.length) && (
            <Fragment>
              <SalesforceRecordDataTable
                org={selectedOrg}
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
                onFields={setFields}
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
              />
            </Fragment>
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

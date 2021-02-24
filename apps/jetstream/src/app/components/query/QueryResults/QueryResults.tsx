/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { QueryResults as IQueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { transformTabularDataToExcelStr, useObservable } from '@jetstream/shared/ui-utils';
import {
  flattenRecords,
  getRecordIdFromAttributes,
  getSObjectNameFromAttributes,
  pluralizeIfMultiple,
  replaceSubqueryQueryResultsWithRecords,
} from '@jetstream/shared/utils';
import { AsyncJob, AsyncJobNew, BulkDownloadJob, CloneEditView, FileExtCsvXLSX, Record, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  EmptyState,
  FileDownloadModal,
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
import copyToClipboard from 'copy-to-clipboard';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useHistory, useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import * as fromQueryState from '../query.state';
import * as fromQueryHistory from '../QueryHistory/query-history.state';
import QueryHistory from '../QueryHistory/QueryHistory';
import IncludeDeletedRecordsToggle from '../QueryOptions/IncludeDeletedRecords';
import useQueryRestore from '../utils/useQueryRestore';
import QueryResultsActions from './QueryResultsActions';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import QueryResultsViewRecordFields from './QueryResultsViewRecordFields';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = React.memo(() => {
  const isMounted = useRef(null);
  const history = useHistory();
  const previousSoql = useRecoilValue(fromQueryState.querySoqlState);
  const includeDeletedRecords = useRecoilValue(fromQueryState.queryIncludeDeletedRecordsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  const [isTooling, setIsTooling] = useRecoilState(fromQueryState.isTooling);
  const location = useLocation<{ soql: string; isTooling: boolean; sobject?: { name: string; label: string } }>();
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
  const [restore] = useQueryRestore(soql, isTooling, { silent: true });

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (bulkDeleteJob && executeQuery) {
      executeQuery(soql);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkDeleteJob]);

  useEffect(() => {
    logger.log({ location });
    if (location.state) {
      setSoql(location.state.soql || '');
      setUserSoql(location.state.soql || '');
      setIsTooling(location.state.isTooling ? true : false);
      executeQuery(location.state.soql, false, location.state.isTooling);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (priorSelectedOrg && selectedOrg && selectedOrg.uniqueId !== priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      executeQuery(soql, true, isTooling);
    } else {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    }
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
        .then((queryHistoryItem) => {
          if (queryHistory && queryHistory[queryHistoryItem.key]) {
            queryHistoryItem.runCount = queryHistory[queryHistoryItem.key].runCount + 1;
            queryHistoryItem.created = queryHistory[queryHistoryItem.key].created;
            queryHistoryItem.isFavorite = queryHistory[queryHistoryItem.key].isFavorite;
          }
          setQueryHistory({ ...queryHistory, [queryHistoryItem.key]: queryHistoryItem });
        })
        .catch((ex) => logger.warn(ex));
    }
  }

  async function executeQuery(soqlQuery: string, forceRestore = false, tooling = false) {
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
      const results = await query(selectedOrg, soqlQuery, tooling, !tooling && includeDeletedRecords).then(
        replaceSubqueryQueryResultsWithRecords
      );
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
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      logger.warn('ERROR', ex);
      setErrorMessage(ex.message);
      setSoqlPanelOpen(true);
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
        });
        break;
      }
      default:
        break;
    }
  }

  function handleDownloadFromServer(fileFormat: FileExtCsvXLSX, fileName: string) {
    const jobs: AsyncJobNew<BulkDownloadJob>[] = [
      {
        type: 'BulkDownload',
        title: `Download Records`,
        org: selectedOrg,
        meta: {
          isTooling,
          fields,
          records: records,
          nextRecordsUrl,
          fileFormat,
          fileName,
        },
      },
    ];
    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
  }

  function handleLoadMore(results: IQueryResults<any>) {
    if (isMounted.current) {
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      saveQueryHistory(soql, results.parsedQuery?.sObject || results.columns?.entityName, isTooling);
      setRecords(records.concat(results.queryResults.records));
    }
  }

  function hasRecords() {
    return !loading && !errorMessage && records?.length;
  }

  function handleCopyToClipboard() {
    const flattenedData = flattenRecords(records, fields);
    copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields), { format: 'text/plain' });
  }

  function handleCloneEditView(record: any, action: CloneEditView) {
    setCloneEditViewRecord({
      action,
      recordId: record.Id || getRecordIdFromAttributes(record),
      sobjectName: getSObjectNameFromAttributes(record),
    });
  }

  function handleChangeAction(action: CloneEditView) {
    setCloneEditViewRecord((currentAction) => ({ ...currentAction, action }));
  }

  async function handleCloseEditCloneModal(reloadRecords?: boolean) {
    setCloneEditViewRecord(null);
    if (reloadRecords) {
      executeQuery(soql);
    }
  }

  function handleRestoreFromHistory(soql: string, tooling) {
    history.push(`/query`, { soql, isTooling: tooling });
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
        onDownloadFromServer={handleDownloadFromServer}
      />
      {cloneEditViewRecord && (
        <QueryResultsActions
          apiVersion={defaultApiVersion}
          selectedOrg={selectedOrg}
          action={cloneEditViewRecord.action}
          sobjectName={cloneEditViewRecord.sobjectName}
          recordId={cloneEditViewRecord.recordId}
          onClose={handleCloseEditCloneModal}
          onChangeAction={handleChangeAction}
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
            title="View or manually edit SOQL query"
            onClick={() => setSoqlPanelOpen(!soqlPanelOpen)}
          >
            <Icon type="utility" icon="component_customization" className="slds-button__icon slds-button__icon_left" omitContainer />
            Manage SOQL Query
          </button>
          <button
            className="slds-button slds-button_neutral"
            onClick={() => executeQuery(soql, false, isTooling)}
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
          <button
            className="slds-button slds-button_neutral"
            onClick={() => handleCopyToClipboard()}
            disabled={!hasRecords()}
            title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
          >
            <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
            Copy to Clipboard
          </button>
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
          executeQuery={(soql, tooling) => executeQuery(soql, false, tooling)}
        />
        <QueryResultsViewRecordFields
          org={selectedOrg}
          row={recordDetailSelectedRow}
          isOpen={recordDetailPanelOpen}
          onClosed={() => setRecordDetailPanelOpen(false)}
        />
        <AutoFullHeightContainer
          className="slds-scrollable bg-white"
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
                headline="Your query yielded no results!"
                callToAction={
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
                }
              >
                <p>There are no records matching your query.</p>
                <p>Better luck next time!</p>
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
              />
            </Fragment>
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

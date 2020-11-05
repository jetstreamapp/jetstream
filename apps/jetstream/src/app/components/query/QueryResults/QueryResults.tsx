/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { QueryResults as IQueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple, replaceSubqueryQueryResultsWithRecords } from '@jetstream/shared/utils';
import { AsyncJob, AsyncJobNew, BulkDownloadJob, FileExtCsvXLSX, Record, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  EmptyState,
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
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import * as fromQueryHistory from '../QueryHistory/query-history.state';
import QueryHistory from '../QueryHistory/QueryHistory';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import QueryResultsViewRecordFields from './QueryResultsViewRecordFields';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = React.memo(() => {
  const isMounted = useRef(null);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  const location = useLocation<{ soql: string; sobject?: { name: string; label: string } }>();
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
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [totalRecordCount, setTotalRecordCount] = useState<number>(null);
  const [queryHistory, setQueryHistory] = useRecoilState(fromQueryHistory.queryHistoryState);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents.getObservable('jobFinished').pipe(filter((ev: AsyncJob) => ev.type === 'BulkDelete'))
  );
  const confirm = useConfirmation();

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
      executeQuery(location.state.soql);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (priorSelectedOrg && selectedOrg && selectedOrg.uniqueId !== priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      executeQuery(soql);
    } else {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    }
  }, [selectedOrg]);

  function saveQueryHistory(soql: string, sObject: string) {
    let sObjectLabel: string;
    // if object name did not change since last query, use data from location
    if (location?.state?.sobject) {
      if (location.state.sobject.name === sObject) {
        sObjectLabel = location.state.sobject.label;
      }
    }
    if (soql && sObject) {
      fromQueryHistory
        .getQueryHistoryItem(selectedOrg, soql, sObject, sObjectLabel)
        .then((queryHistoryItem) => {
          if (queryHistory && queryHistory[queryHistoryItem.key]) {
            queryHistoryItem.runCount = queryHistory[queryHistoryItem.key].runCount + 1;
            queryHistoryItem.created = queryHistory[queryHistoryItem.key].created;
          }
          setQueryHistory({ ...queryHistory, [queryHistoryItem.key]: queryHistoryItem });
        })
        .catch((ex) => logger.warn(ex));
    }
  }

  async function executeQuery(soql: string) {
    try {
      setLoading(true);
      setSoql(soql);
      setRecords(null);
      setRecordCount(null);
      // setFields(null);
      const results = await query(selectedOrg, soql).then(replaceSubqueryQueryResultsWithRecords);
      if (!isMounted.current) {
        return;
      }
      setQueryResults(results);
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      saveQueryHistory(soql, results.parsedQuery?.sObject || results.columns?.entityName);
      setRecordCount(results.queryResults.totalSize);
      setRecords(results.queryResults.records);
      setTotalRecordCount(results.queryResults.totalSize);
      setErrorMessage(null);
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

  // Deprecated for now - this is worked and can be uncommented when we decide on specific row actions
  // function handleRowAction(id: string, row: Record) {
  //   logger.log({ id, row });
  //   const recordId = row.Id || getIdFromRecordUrl(row.attributes.url);
  //   switch (id) {
  //     case 'view-record':
  //       setRecordDetailSelectedRow(row);
  //       setSoqlPanelOpen(false);
  //       setRecordDetailPanelOpen(true);
  //       break;
  //     case 'delete record': {
  //       confirm({
  //         content: `Are you sure you want to delete record ${recordId}`,
  //       }).then(() => {
  //         const jobs: AsyncJobNew[] = [
  //           {
  //             type: 'BulkDelete',
  //             title: `Delete Record ${recordId}`,
  //             meta: row,
  //           },
  //         ];
  //         fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
  //       });
  //       break;
  //     }
  //     default:
  //       break;
  //   }
  // }

  function handleBulkRowAction(id: string, rows: Record[]) {
    logger.log({ id, rows });
    switch (id) {
      case 'delete record': {
        const recordCountText = `${rows.length} ${pluralizeIfMultiple('Record', rows)}`;
        confirm({
          content: `Are you sure you want to delete ${recordCountText}?`,
        }).then(() => {
          const jobs: AsyncJobNew[] = [
            {
              type: 'BulkDelete',
              title: `Delete ${recordCountText}`,
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
        meta: {
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
      saveQueryHistory(soql, results.parsedQuery?.sObject || results.columns?.entityName);
      setRecords(records.concat(results.queryResults.records));
    }
  }

  return (
    <div>
      <RecordDownloadModal
        org={selectedOrg}
        downloadModalOpen={downloadModalOpen}
        fields={fields}
        records={records}
        selectedRecords={selectedRows}
        totalRecordCount={totalRecordCount}
        onModalClose={() => setDownloadModalOpen(false)}
        onDownloadFromServer={handleDownloadFromServer}
      />
      <Toolbar>
        <ToolbarItemGroup>
          <Link
            className="slds-button slds-button_neutral"
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
            onClick={() => setSoqlPanelOpen(!soqlPanelOpen)}
          >
            <Icon type="utility" icon="component_customization" className="slds-button__icon slds-button__icon_left" omitContainer />
            Manage SOQL Query
          </button>
          <QueryHistory />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          {/* FIXME: strongly type me! */}
          <button
            className="slds-button slds-button_text-destructive"
            disabled={selectedRows.length === 0}
            onClick={() => handleBulkRowAction('delete record', selectedRows)}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
            Delete Selected Records
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => executeQuery(soql)}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Re-load Records
          </button>
          <button className="slds-button slds-button_brand" onClick={() => setDownloadModalOpen(true)}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Records
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <div className="slds-grid">
        <QueryResultsSoqlPanel soql={soql} isOpen={soqlPanelOpen} onClosed={() => setSoqlPanelOpen(false)} executeQuery={executeQuery} />
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
          {!loading && !errorMessage && !records?.length && !recordCount && (
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
          )}
          {!loading && !errorMessage && !records?.length && recordCount && (
            <div className="slds-col slds-text-heading_small slds-p-around_medium">
              Record Count: <strong>{recordCount}</strong>
            </div>
          )}
          {records && !!records.length && (
            <Fragment>
              <SalesforceRecordDataTable
                org={selectedOrg}
                serverUrl={serverUrl}
                queryResults={queryResults}
                onSelectionChanged={setSelectedRows}
                onFields={setFields}
                onLoadMoreRecords={handleLoadMore}
              />
            </Fragment>
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

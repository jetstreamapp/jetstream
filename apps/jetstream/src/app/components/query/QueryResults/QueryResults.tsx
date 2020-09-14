/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { QueryResultsColumn } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple, queryResultColumnToTypeLabel, replaceSubqueryQueryResultsWithRecords } from '@jetstream/shared/utils';
import { AsyncJob, AsyncJobNew, BulkDownloadJob, FileExtCsvXLSX, MapOf, QueryFieldHeader, Record, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  DataTable,
  EmptyState,
  Icon,
  Spinner,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  useConfirmation,
} from '@jetstream/ui';
import classNames from 'classnames';
import numeral from 'numeral';
import React, { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Column } from 'react-table';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import { FieldSubquery, getFlattenedFields } from 'soql-parser-js';
import { isFieldSubquery } from 'soql-parser-js/dist/src/utils';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import * as fromQueryHistory from '../QueryHistory/query-history.state';
import QueryHistory from '../QueryHistory/QueryHistory';
import QueryDownloadModal from './QueryDownloadModal';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import { getQueryResultsCellContents } from './QueryResultsTable/query-results-table-utils';
import QueryResultsViewCellModal from './QueryResultsTable/QueryResultsViewCellModal';
import QueryResultsViewRecordFields from './QueryResultsViewRecordFields';

function getStubbedField(field: string) {
  return {
    label: field,
    accessor: field,
    title: field,
    columnMetadata: {
      aggregate: false,
      apexType: 'String',
      booleanType: false,
      columnFullPath: field,
      columnName: field,
      custom: false,
      displayName: field,
      foreignKeyName: null,
      insertable: false,
      numberType: false,
      textType: false,
      updatable: false,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = React.memo(() => {
  const location = useLocation<{ soql: string; sobject?: { name: string; label: string } }>();
  const [soqlPanelOpen, setSoqlPanelOpen] = useState<boolean>(false);
  const [recordDetailPanelOpen, setRecordDetailPanelOpen] = useState<boolean>(false);
  const [recordDetailSelectedRow, setRecordDetailSelectedRow] = useState<Record>(null);
  const [soql, setSoql] = useState<string>(null);
  const [userSoql, setUserSoql] = useState<string>(null);
  const [records, setRecords] = useState<Record[]>(null);
  const [nextRecordsUrl, setNextRecordsUrl] = useState<string>(null);
  const [fields, setFields] = useState<QueryFieldHeader[]>(null);
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [totalRecordCount, setTotalRecordCount] = useState<number>(null);
  const [subqueryFieldMap, setSubqueryFieldMap] = useState<MapOf<string[]>>({});
  const [queryHistory, setQueryHistory] = useRecoilState(fromQueryHistory.queryHistoryState);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents.getObservable('jobFinished').pipe(filter((ev: AsyncJob) => ev.type === 'BulkDelete'))
  );
  const confirm = useConfirmation();

  const memoizedFields: Column<any>[] = useMemo<any>(
    () =>
      fields
        ? fields.map((field) => {
            const column: Column = {
              accessor: field.accessor,
              minWidth: 25,
              Header: () => (
                <div className="slds-truncate" title={field.title}>
                  <div>{field.accessor}</div>
                </div>
              ),
              Cell: ({ value }) => {
                return getQueryResultsCellContents(field, serverUrl, selectedOrg, value, (field, serverUrl, org, value: any) => {
                  // transform data if subquery
                  let headers: string[] = null;
                  if (subqueryFieldMap && subqueryFieldMap[field.accessor]) {
                    headers = subqueryFieldMap[field.accessor];
                  }
                  if (value && Array.isArray(value.records)) {
                    value = value.records;
                  }
                  return <QueryResultsViewCellModal field={field} serverUrl={serverUrl} org={org} value={value} headers={headers} />;
                });
              },
            };
            return column;
          })
        : undefined,
    [fields, selectedOrg, serverUrl]
  );
  const memoizedRecords: Record[] = useMemo(() => (records ? [...records] : undefined), [records]);

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
      setFields(null);
      const results = await query(selectedOrg, soql).then(replaceSubqueryQueryResultsWithRecords);
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      saveQueryHistory(soql, results.parsedQuery?.sObject || results.columns?.entityName);

      let queryColumnsByPath: MapOf<QueryResultsColumn> = {};

      if (results.columns?.columns) {
        queryColumnsByPath = results.columns.columns.reduce((out, curr) => {
          out[curr.columnFullPath.toLowerCase()] = curr;
          if (Array.isArray(curr.childColumnPaths)) {
            curr.childColumnPaths.forEach((subqueryField) => {
              out[subqueryField.columnFullPath.toLowerCase()] = subqueryField;
            });
          }
          return out;
        }, {});
      }

      // Base fields
      const flattenedFields: QueryFieldHeader[] = getFlattenedFields(results.parsedQuery).map((field) => {
        const fieldLowercase = field.toLowerCase();
        if (queryColumnsByPath[fieldLowercase]) {
          const col = queryColumnsByPath[fieldLowercase];
          return {
            label: col.displayName,
            accessor: col.columnFullPath,
            title: `${col.displayName} (${queryResultColumnToTypeLabel(col)})`,
            columnMetadata: col,
          };
        }
        // default values since column was not available
        return getStubbedField(field);
      });

      // subquery fields - only used if user clicks "view data" on a field so that the table can be built properly
      const tempSubqueryFieldMap: MapOf<string[]> = {};
      results.parsedQuery.fields
        .filter((field) => isFieldSubquery(field))
        .forEach((field: FieldSubquery) => {
          tempSubqueryFieldMap[field.subquery.relationshipName] = getFlattenedFields(field.subquery).map((field) => {
            const fieldLowercase = field.toLowerCase();
            return queryColumnsByPath[fieldLowercase] ? queryColumnsByPath[fieldLowercase].columnFullPath : field;
          });
        });

      setFields(flattenedFields);
      setSubqueryFieldMap(tempSubqueryFieldMap);
      setRecords(results.queryResults.records);
      setTotalRecordCount(results.queryResults.totalSize);
      setErrorMessage(null);
    } catch (ex) {
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
          fields: fields.map((field) => field.accessor),
          records: records,
          nextRecordsUrl,
          fileFormat,
          fileName,
        },
      },
    ];
    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
  }

  return (
    <div>
      <QueryDownloadModal
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
          {!loading && !errorMessage && !records?.length && (
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
          {records && !!records.length && (
            <Fragment>
              <div className="slds-grid slds-p-around_xx-small">
                <div className="slds-col">
                  Showing {numeral(records.length).format('0,0')} of {numeral(totalRecordCount).format('0,0')} records
                </div>
              </div>
              <DataTable columns={memoizedFields} data={memoizedRecords} allowRowSelection onRowSelection={setSelectedRows} />
            </Fragment>
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

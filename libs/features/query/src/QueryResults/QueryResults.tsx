/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { query, sobjectOperation } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  appActionObservable,
  formatNumber,
  hasModifierKey,
  isMKey,
  recordActionModalClosedObservable$,
  setItemInSessionStorage,
  useBrowserNotifications,
  useGlobalEventHandler,
  useLocationState,
  useNonInitialEffect,
  useObservable,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage, getRecordIdFromAttributes, getSObjectNameFromAttributes, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  AsyncJobNew,
  CloneEditView,
  QueryResults as IQueryResults,
  Maybe,
  QueryResult,
  SalesforceRecord,
  SobjectCollectionResponse,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ButtonGroupContainer,
  CampingRainIllustration,
  EmptyState,
  Grid,
  GridCol,
  Icon,
  SalesforceRecordDataTable,
  Spinner,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  useConfirmation,
} from '@jetstream/ui';
import {
  QueryHistory,
  QueryHistoryRef,
  fromJetstreamEvents,
  fromQueryHistoryState,
  fromQueryState,
  isAsyncJob,
  useAmplitude,
  useQueryRestore,
} from '@jetstream/ui-core';
import { getFlattenSubqueryFlattenedFieldMap } from '@jetstream/ui-core/shared';
import { fromAppState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { queryHistoryDb } from '@jetstream/ui/db';
import { FieldSubquery, Query, composeQuery, isFieldSubquery, parseQuery } from '@jetstreamapp/soql-parser-js';
import classNames from 'classnames';
import { useAtom, useAtomValue } from 'jotai';
import isString from 'lodash/isString';
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { filter } from 'rxjs/operators';
import IncludeDeletedRecordsToggle from '../QueryOptions/IncludeDeletedRecords';
import QueryResultsAttachmentDownload, { FILE_DOWNLOAD_FIELD_MAP } from './QueryResultsAttachmentDownload';
import QueryResultsCopyToClipboard from './QueryResultsCopyToClipboard';
import QueryResultsDownloadButton from './QueryResultsDownloadButton';
import QueryResultsGetRecAsApexModal from './QueryResultsGetRecAsApexModal';
import QueryResultsMoreActions from './QueryResultsMoreActions';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import { useQueryResultsFetchMetadata } from './useQueryResultsFetchMetadata';

type SourceAction = 'STANDARD' | 'ORG_CHANGE' | 'BULK_DELETE' | 'HISTORY' | 'RECORD_ACTION' | 'RECORD_BULK_ACTION' | 'MANUAL' | 'RELOAD';

const SOURCE_STANDARD: SourceAction = 'STANDARD';
const SOURCE_ORG_CHANGE: SourceAction = 'ORG_CHANGE';
const SOURCE_BULK_DELETE: SourceAction = 'BULK_DELETE';
const SOURCE_HISTORY: SourceAction = 'HISTORY';
const SOURCE_RECORD_ACTION: SourceAction = 'RECORD_ACTION';
const RECORD_BULK_ACTION: SourceAction = 'RECORD_BULK_ACTION';
const SOURCE_MANUAL: SourceAction = 'MANUAL';
const SOURCE_RELOAD: SourceAction = 'RELOAD';

function getTotalRecordCount(queryResult: QueryResult<unknown>, records: unknown[]) {
  if (queryResult.done) {
    return records.length;
  }
  // Big objects report -1 as totalSize
  return queryResult.totalSize < 0 ? queryResult.totalSize + 1 : queryResult.totalSize;
}

export const QueryResults = React.memo(() => {
  const isMounted = useRef(true);
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const queryHistoryRef = useRef<QueryHistoryRef>(null);
  const previousSoql = useAtomValue(fromQueryState.querySoqlState);
  const includeDeletedRecords = useAtomValue(fromQueryState.queryIncludeDeletedRecordsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);
  const [isTooling, setIsTooling] = useAtom(fromQueryState.isTooling);
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
  const [records, setRecords] = useState<SalesforceRecord[] | null>(null);
  const [nextRecordsUrl, setNextRecordsUrl] = useState<Maybe<string>>(null);
  const [fields, setFields] = useState<string[] | null>(null);
  const [subqueryFields, setSubqueryFields] = useState<Maybe<Record<string, string[]>>>(null);
  const [filteredRows, setFilteredRows] = useState<SalesforceRecord[]>([]);
  const [selectedRows, setSelectedRows] = useState<SalesforceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useAtomValue(fromAppState.applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const skipFrontdoorLogin = useAtomValue(fromAppState.selectSkipFrontdoorAuth);
  const [totalRecordCount, setTotalRecordCount] = useState<number | null>(null);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents
      .getObservable('jobFinished')
      .pipe(filter((ev) => isAsyncJob(ev) && (ev.type === 'BulkDelete' || ev.type === 'BulkUndelete')))
  );
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const { confirm } = useConfirmation();

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

  // if record modal closed and same object was specified, re-load the page
  const reloadRecordEvents = useObservable(
    recordActionModalClosedObservable$.pipe(filter(({ objectName, reloadRecords }) => !!reloadRecords && objectName === sobject))
  );

  useNonInitialEffect(() => {
    if (reloadRecordEvents) {
      executeQuery(soql, SOURCE_RECORD_ACTION, { isTooling });
    }
  }, [reloadRecordEvents]);

  // ensure that on a page refresh, the query is restored from browser state if it exists
  useEffect(() => {
    const soql = window.history?.state?.state?.soql;
    if (locationState) {
      return;
    }
    if (isString(window.history?.state?.state?.soql)) {
      navigate('', { replace: true, state: window.history.state.state });
      return;
    }
    // Fallback to session state if browser history is not available (e.g. browser extension)
    try {
      const potentialState = JSON.parse(sessionStorage.getItem('query') || '');
      if (isString(potentialState.soql)) {
        navigate('', { replace: true, state: potentialState });
      }
    } catch (ex) {
      // could not parse session, ignore
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

  // Ensure that the query is updated in the browser history any time it changes
  useNonInitialEffect(() => {
    if (soql) {
      window.history.replaceState({ state: { soql, isTooling } }, '');
    }
  }, [isTooling, soql]);

  useEffect(() => {
    logger.log({ location });
    if (locationState && locationState.soql) {
      setSoql(locationState.soql);
      setIsTooling(locationState.isTooling ? true : false);

      try {
        const parsedQuery = parseQuery(locationState.soql);
        setParsedQuery(parsedQuery);
      } catch (ex) {
        logger.warn('Could not parse query from location state', locationState.soql, getErrorMessage(ex));
      }

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
        await queryHistoryDb.saveQueryHistoryItem(selectedOrg, soql, sObject, {
          sObjectLabel,
          isTooling: tooling,
          incrementRunCount: true,
        });
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
      setSubqueryFields(null);
      const results = await query(selectedOrg, soqlQuery, tooling, !tooling && includeDeletedRecords);
      if (!isMounted.current) {
        return;
      }
      setParsedQuery(results.parsedQuery);
      setQueryResults(results);
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      setRecordCount(getTotalRecordCount(results.queryResults, results.queryResults.records));
      setRecords(results.queryResults.records);
      setSubqueryFields(getFlattenSubqueryFlattenedFieldMap(results.parsedQuery));
      // Matching ReactRouter state format
      window.history.replaceState({ state: { soql: soqlQuery, isTooling: tooling } }, '');
      setItemInSessionStorage('query', JSON.stringify({ soql: soqlQuery, isTooling: tooling }));

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
      if (sobjectName) {
        // this is async, but don't block on results
        saveQueryHistory(soqlQuery, sobjectName, tooling).catch((ex) => logger.warn('Error saving query history', ex));
      }
      setSobject(sobjectName);
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      logger.warn('ERROR', ex);
      setErrorMessage(getErrorMessage(ex));
      setSoqlPanelOpen(true);
      trackEvent(ANALYTICS_KEYS.query_ExecuteQuery, { source, success: false, isTooling: tooling, includeDeletedRecords });
      notifyUser(`Your query failed`, {
        body: getErrorMessage(ex),
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
      const { bodyField, nameField, extensionField, titleField, sizeField } = FILE_DOWNLOAD_FIELD_MAP.get(
        results.parsedQuery.sObject.toLowerCase()
      )!;
      const missingFields: string[] = [];
      const fields = new Set(
        results.parsedQuery.fields?.map((field) => field.type === 'Field' && field.field.toLowerCase()).filter(Boolean) || []
      );
      if (!fields.has(bodyField.toLowerCase())) {
        missingFields.push(bodyField);
      }
      const hasTitleField = titleField && fields.has(titleField.toLowerCase());
      const hasExtensionField = extensionField && fields.has(extensionField.toLowerCase());

      if (!fields.has(nameField.toLowerCase())) {
        if (!hasTitleField && !hasExtensionField) {
          missingFields.push(nameField);
        }
        // titleField is optional and will be used if available. But since name field is missing we flag this as missing as well
        if (titleField && !hasTitleField) {
          missingFields.push(titleField);
        }
        // Extension is only required if nameField is not available, otherwise we can get the extension from the nameField
        if (titleField && hasTitleField && extensionField && !hasExtensionField) {
          missingFields.push(nameField);
          missingFields.push(extensionField);
        }
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

  function handleLoadMore(results: IQueryResults<any>) {
    if (isMounted.current) {
      const sobjectName = results.parsedQuery?.sObject || results.columns?.entityName;
      setNextRecordsUrl(results.queryResults.nextRecordsUrl);
      sobjectName && saveQueryHistory(soql, sobjectName, isTooling);
      if (records) {
        const newRecords = records.concat(results.queryResults.records);
        setRecordCount(getTotalRecordCount(results.queryResults, newRecords));
        setTotalRecordCount(getTotalRecordCount(results.queryResults, newRecords));
        setRecords(newRecords);
      }
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

  function handleCloneEditView(record: any, action: CloneEditView, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') {
    const recordId = record.Id || getRecordIdFromAttributes(record);
    const sobjectName = getSObjectNameFromAttributes(record);
    switch (action) {
      case 'clone':
        appActionObservable.next({ action: 'CLONE_RECORD', payload: { recordId } });
        break;
      case 'create':
        appActionObservable.next({ action: 'CREATE_RECORD', payload: { objectName: sobjectName } });
        break;
      case 'edit':
        appActionObservable.next({ action: 'EDIT_RECORD', payload: { recordId } });
        break;
      case 'view':
        appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId } });
        break;
    }
    trackEvent(ANALYTICS_KEYS.query_RecordAction, { action, source });
  }

  async function handleUpdateRecords(modifiedRecords: any[]): Promise<SobjectCollectionResponse> {
    const type = sobject || modifiedRecords?.[0]?.attributes?.type;
    if (!type) {
      return [];
    }
    const results = (
      await Promise.all(
        splitArrayToMaxSize(modifiedRecords, 200).map((records) =>
          sobjectOperation(selectedOrg, type, 'update', { records }, { allOrNone: false })
        )
      )
    ).flat();
    trackEvent(ANALYTICS_KEYS.query_UpdateRecordsInline, { recordCount: modifiedRecords.length });
    return results;
  }

  async function handleDelete(record?: SalesforceRecord) {
    const label = record.Name || record.Name || record.Id || getRecordIdFromAttributes(record);
    await confirm({
      content: (
        <div className="slds-m-around_medium">
          <p className="slds-align_absolute-center slds-m-bottom_small">
            <span>
              Are you sure you want to <span className="slds-text-color_destructive slds-p-left_xx-small">delete {label}</span>?
            </span>
          </p>
          <p>
            <strong>This record will be deleted from Salesforce.</strong> If you want to recover deleted records you can use the Salesforce
            recycle bin.
          </p>
        </div>
      ),
      header: 'Confirm Delete',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
      .then(() => {
        const jobs: AsyncJobNew[] = [
          {
            type: 'BulkDelete',
            title: `Delete Record - ${label}`,
            org: selectedOrg,
            meta: { records: [record] },
          },
        ];
        fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
        trackEvent(ANALYTICS_KEYS.query_BulkDelete, { numRecords: selectedRows.length, source: 'ROW_ACTION' });
      })
      .catch((ex) => {
        logger.info(ex);
        // user canceled
      });
  }

  async function handleUndelete(record?: SalesforceRecord) {
    const label = record.Name || record.Name || record.Id || getRecordIdFromAttributes(record);
    await confirm({
      content: (
        <div className="slds-m-around_medium">
          <p className="slds-align_absolute-center slds-m-bottom_small">
            <span>
              Are you sure you want to restore the record: <strong>{label}</strong> from the Recycle Bin?
            </span>
          </p>
        </div>
      ),
      header: 'Confirm Restore',
      confirmText: 'Restore',
      cancelText: 'Cancel',
    })
      .then(() => {
        const jobs: AsyncJobNew[] = [
          {
            type: 'BulkUndelete',
            title: `Restore Record - ${label}`,
            org: selectedOrg,
            meta: { records: [record] },
          },
        ];
        fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
        trackEvent(ANALYTICS_KEYS.query_BulkUndelete, { numRecords: selectedRows.length, source: 'ROW_ACTION' });
      })
      .catch((ex) => {
        logger.info(ex);
        // user canceled
      });
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

  function handleRestoreFromHistory(soql: string, isTooling = false) {
    navigate(APP_ROUTES.QUERY.ROUTE, { state: { soql, isTooling, fromHistory: true } });
  }

  function handleCreateNewRecord() {
    if (queryResults?.parsedQuery?.sObject) {
      appActionObservable.next({ action: 'CREATE_RECORD', payload: { objectName: queryResults.parsedQuery.sObject } });
      trackEvent(ANALYTICS_KEYS.query_RecordAction, { action: 'create', source: 'QUERY_RESULTS_CREATE_RECORD' });
    }
  }

  function handleFieldsChanged(newFields: string[], columnOrder: number[]) {
    try {
      setFields(newFields);
      if (newFields?.length && parsedQuery?.fields && Array.isArray(parsedQuery.fields)) {
        const newParsedQuery = {
          ...parsedQuery,
          fields: columnOrder.map((idx) => parsedQuery.fields![idx]),
        };
        setParsedQuery(newParsedQuery);
        setSoql(composeQuery(newParsedQuery, { format: true }));
      }
    } catch (ex) {
      logger.warn('Error setting query after fields changed', getErrorMessage(ex));
    }
  }

  function handleSubqueryFieldsChanged(columnKey: string, newFields: string[], columnOrder: number[]) {
    try {
      const subqueryIdx = fields?.findIndex((field) => field === columnKey) || -1;
      if (
        subqueryIdx >= 0 &&
        newFields?.length &&
        parsedQuery?.fields &&
        Array.isArray(parsedQuery.fields) &&
        isFieldSubquery(parsedQuery.fields[subqueryIdx])
      ) {
        const subqueryColumn = { ...(parsedQuery.fields[subqueryIdx] as FieldSubquery) };

        subqueryColumn.subquery = {
          ...subqueryColumn.subquery,
          fields: columnOrder.map((idx) => subqueryColumn.subquery.fields![idx]),
        };

        const newParsedQuery = {
          ...parsedQuery,
          fields: parsedQuery.fields.map((field, idx) => (idx === subqueryIdx ? subqueryColumn : field)),
        };
        setParsedQuery(newParsedQuery);

        setSoql(composeQuery(newParsedQuery, { format: true }));
      }
    } catch (ex) {
      logger.warn('Error setting query after fields changed (Subquery)', getErrorMessage(ex));
    }
  }

  function handleOpenHistory(type: fromQueryHistoryState.QueryHistoryType) {
    queryHistoryRef.current?.open(type);
  }

  return (
    <div data-testid="query-results-page">
      {getRecordAsApex && (
        <QueryResultsGetRecAsApexModal
          org={selectedOrg}
          records={[getRecordAsApex.record]}
          sobjectName={getRecordAsApex.sobjectName}
          onClose={handleGetAsApexClose}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link
            className="slds-button slds-button_brand"
            to={{ pathname: APP_ROUTES.QUERY.ROUTE, search: APP_ROUTES.QUERY.SEARCH_PARAM }}
            state={{ soql }}
          >
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Back
          </Link>
          <ButtonGroupContainer>
            <button
              className={classNames('slds-button collapsible-button collapsible-button-md slds-button_first', {
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
              className="slds-button slds-button_neutral collapsible-button collapsible-button-md slds-button_last"
              onClick={() => executeQuery(soql, SOURCE_RELOAD, { isTooling })}
              disabled={!!(loading || errorMessage)}
              title="Re-run the current query"
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
              <span>Reload</span>
            </button>
            <QueryHistory ref={queryHistoryRef} selectedOrg={selectedOrg} onRestore={handleRestoreFromHistory} />
          </ButtonGroupContainer>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          {/* FIXME: strongly type me! */}
          {!isTooling && (
            <QueryResultsMoreActions
              selectedOrg={selectedOrg}
              sObject={sobject}
              parsedQuery={parsedQuery}
              disabled={loading}
              records={records || []}
              filteredRows={filteredRows}
              selectedRows={selectedRows}
              totalRecordCount={totalRecordCount || 0}
              includeDeletedRecords={includeDeletedRecords}
              refreshRecords={() => executeQuery(soql, SOURCE_RELOAD, { isTooling })}
              onCreateNewRecord={handleCreateNewRecord}
            />
          )}
          <QueryResultsCopyToClipboard
            className="collapsible-button collapsible-button-md"
            hasRecords={hasRecords()}
            fields={fields || []}
            records={records || []}
            filteredRows={filteredRows}
            selectedRows={selectedRows}
            isTooling={isTooling}
          />
          <QueryResultsDownloadButton
            selectedOrg={selectedOrg}
            sObject={sobject}
            soql={soql}
            columns={queryResults?.columns?.columns || []}
            disabled={!hasRecords()}
            isTooling={isTooling}
            nextRecordsUrl={nextRecordsUrl}
            fields={fields || []}
            subqueryFields={subqueryFields}
            records={records || []}
            filteredRows={filteredRows}
            selectedRows={selectedRows}
            totalRecordCount={totalRecordCount || 0}
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
                <Link className="slds-button slds-button_brand" to=".." state={{ soql }}>
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
              hasGoogleDriveAccess={hasGoogleDriveAccess}
              googleShowUpgradeToPro={googleShowUpgradeToPro}
              defaultApiVersion={defaultApiVersion}
              google_apiKey={google_apiKey}
              google_appId={google_appId}
              google_clientId={google_clientId}
              isTooling={isTooling}
              serverUrl={serverUrl}
              skipFrontdoorLogin={skipFrontdoorLogin}
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
              onSubqueryFieldReorder={handleSubqueryFieldsChanged}
              onFilteredRowsChanged={setFilteredRows}
              onLoadMoreRecords={handleLoadMore}
              onSavedRecords={(data) => {
                trackEvent(ANALYTICS_KEYS.query_InlineEditSave, data);
              }}
              onEdit={(record, source) => {
                handleCloneEditView(record, 'edit', source);
              }}
              onClone={(record, source) => {
                handleCloneEditView(record, 'clone', source);
              }}
              onView={(record, source) => {
                handleCloneEditView(record, 'view', source);
              }}
              onUpdateRecords={handleUpdateRecords}
              onDelete={(record) => {
                handleDelete(record);
              }}
              onUndelete={(record) => {
                handleUndelete(record);
              }}
              onGetAsApex={(record) => {
                handleGetAsApex(record);
              }}
              onReloadQuery={() => executeQuery(soql, RECORD_BULK_ACTION, { isTooling })}
            />
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
});

export default QueryResults;

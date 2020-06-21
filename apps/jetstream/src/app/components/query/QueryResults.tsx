/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import { saveFile } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import {
  AutoFullHeightContainer,
  Icon,
  Modal,
  Spinner,
  TableSortableResizable,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState, Fragment } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { getFlattenedFields } from 'soql-parser-js';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import { Record, SalesforceOrg, MapOf, QueryFieldHeader } from '@jetstream/types';
import QueryDownloadModal from './QueryDownloadModal';
import { useRecoilValue, useRecoilState } from 'recoil';
import { selectedOrgState, applicationCookieState } from '../../app-state';
import { logger } from '@jetstream/shared/client-logger';
import { QueryResultsColumn } from '@jetstream/api-interfaces';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = () => {
  const location = useLocation<{ soql: string }>();
  const [soqlPanelOpen, setSoqlPanelOpen] = useState<boolean>(false);
  const [soql, setSoql] = useState<string>(null);
  const [userSoql, setUserSoql] = useState<string>(null);
  const [records, setRecords] = useState<Record[]>(null);
  const [fields, setFields] = useState<QueryFieldHeader[]>(null);
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const selectedOrg = useRecoilValue<SalesforceOrg>(selectedOrgState);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [totalRecordCount, setTotalRecordCount] = useState<number>(null);

  useEffect(() => {
    logger.log({ location });
    if (location.state) {
      setSoql(location.state.soql || '');
      setUserSoql(location.state.soql || '');
      executeQuery(location.state.soql);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  async function executeQuery(soql: string) {
    try {
      setLoading(true);
      setSoql(soql);
      setFields(null);
      setRecords(null);
      const results = await query(selectedOrg, soql);

      let queryColumnsByPath: MapOf<QueryResultsColumn> = {};

      if (results.columns?.columns) {
        queryColumnsByPath = results.columns.columns.reduce((out, curr) => {
          out[curr.columnFullPath.toLowerCase()] = curr;
          return out;
        }, {});
      }

      const flattenedFields: QueryFieldHeader[] = getFlattenedFields(results.parsedQuery).map((field) => {
        const fieldLowercase = field.toLowerCase();
        if (queryColumnsByPath[fieldLowercase]) {
          const col = queryColumnsByPath[fieldLowercase];
          return {
            label: col.displayName,
            accessor: col.columnFullPath,
            title: `${field} (${col.apexType})`,
            columnMetadata: col,
          };
        }
        // default values since column was not available
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
      });

      setFields(flattenedFields);

      // TODO: we need a fallback here in case there are no parsed results
      // setFields(getFlattenedFields(results.parsedQuery));
      // TODO: do we need to flatten all of our records?
      // TODO: we should use the columns in combination with our parsed query and ensure the order is good
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

  function handleRowAction(id: string, row: any) {
    logger.debug({ id, row });
    switch (id) {
      case 'view-record':
        // TODO: show modal with all fields
        break;
      case 'delete record':
        // TODO: show modal and then delete
        break;
      default:
        break;
    }
  }

  return (
    <div className="slds-is-relative">
      <QueryDownloadModal
        downloadModalOpen={downloadModalOpen}
        fields={fields}
        records={records}
        selectedRecords={selectedRows}
        onModalClose={() => setDownloadModalOpen(false)}
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
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_text-destructive" disabled={selectedRows.length === 0}>
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
        <AutoFullHeightContainer
          className="slds-scrollable bg-white"
          fillHeight
          css={css`
            width: 100%;
          `}
        >
          {loading && <Spinner />}
          {errorMessage && (
            <div className="slds-m-around_medium slds-box  slds-text-color_error">
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
          {records && !!records.length && (
            <Fragment>
              <div className="slds-grid slds-p-around_xx-small">
                <div className="slds-col">
                  Showing {records.length} of {totalRecordCount} records
                </div>
              </div>
              <TableSortableResizable
                data={records}
                headers={fields}
                serverUrl={serverUrl}
                org={selectedOrg}
                onRowSelection={setSelectedRows}
                onRowAction={handleRowAction}
              />
            </Fragment>
          )}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
};

export default QueryResults;

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MIME_TYPES } from '@silverthorn/shared/constants';
import { query } from '@silverthorn/shared/data';
import { saveFile } from '@silverthorn/shared/ui-utils';
import { flattenRecords } from '@silverthorn/shared/utils';
import {
  AutoFullHeightContainer,
  Icon,
  Modal,
  Spinner,
  TableSortableResizable,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@silverthorn/ui';
import classNames from 'classnames';
import { unparse } from 'papaparse';
import { FunctionComponent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getFlattenedFields } from 'soql-parser-js';
import QueryResultsSoqlPanel from './QueryResultsSoqlPanel';
import { Record } from '@silverthorn/types';
import QueryDownloadModal from './QueryDownloadModal';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsProps {}

export const QueryResults: FunctionComponent<QueryResultsProps> = () => {
  const location = useLocation<{ soql: string }>();
  const [soqlPanelOpen, setSoqlPanelOpen] = useState<boolean>(false);
  const [soql, setSoql] = useState<string>(null);
  const [userSoql, setUserSoql] = useState<string>(null);
  const [records, setRecords] = useState<Record[]>(null);
  const [fields, setFields] = useState<string[]>(null);
  const [selectedRows, setSelectedRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);

  useEffect(() => {
    console.log({ location });
    if (location.state) {
      setSoql(location.state.soql || '');
      setUserSoql(location.state.soql || '');
      executeQuery(location.state.soql);
    }
  }, [location]);

  async function executeQuery(soql: string) {
    try {
      setLoading(true);
      setSoql(soql);
      const results = await query(soql);
      // TODO: we need a fallback here in case there are no parsed results
      setFields(getFlattenedFields(results.parsedQuery));
      // TODO: do we need to flatten all of our records?
      // TODO: we should use the columns in combination with our parsed query and ensure the order is good
      setRecords(results.queryResults.records);
    } catch (ex) {
      console.warn('ERROR', ex);
    } finally {
      setLoading(false);
    }
  }

  function downloadRecords() {
    // open modal
    const csv = unparse({ data: flattenRecords(records, fields), fields }, { header: true, quotes: true });
    console.log({ csv });
    saveFile(csv, 'query-results.csv', MIME_TYPES.CSV);
    setDownloadModalOpen(false);
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
      {/* {downloadModalOpen && (
        <Modal
          header="Download Records"
          footer={
            <button className="slds-button slds-button_brand" onClick={downloadRecords}>
              Download
            </button>
          }
          onClose={() => setDownloadModalOpen(false)}
        >
          <p>
            You are about to download records! This modal is here because in the future we may allow configuration of the download process.
          </p>
        </Modal> */}
      )}
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
        <AutoFullHeightContainer className="slds-scrollable" fillHeight>
          {loading && <Spinner />}
          {records && <TableSortableResizable data={records} headers={fields} onRowSelection={setSelectedRows} />}
          {/* TODO: where should this live? */}
          {/* <div>Rows selected: {selectedRows.length}</div> */}
        </AutoFullHeightContainer>
      </div>
    </div>
  );
};

export default QueryResults;

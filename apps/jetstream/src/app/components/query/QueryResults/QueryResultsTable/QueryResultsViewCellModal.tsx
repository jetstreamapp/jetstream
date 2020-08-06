/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
import { DataTable, Icon, Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { Column } from 'react-table';
import { getQueryResultsCellContents } from './query-results-table-utils';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsViewCellModalProps {
  field: QueryFieldHeader;
  serverUrl: string;
  org: SalesforceOrgUi;
  value: any;
  // dynamically calculated if not provided
  headers?: string[];
}

export const QueryResultsViewCellModal: FunctionComponent<QueryResultsViewCellModalProps> = ({ field, serverUrl, org, value, headers }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasNoData, setHasNoData] = useState<boolean>(false);
  const [columns, setColumns] = useState<Column<any>[]>(null);
  const [rows, setRows] = useState<any[]>(null);

  function handleOpen() {
    if (!columns) {
      let tempColumns: string[];
      let data = value;
      try {
        if (!data) {
          setHasNoData(true);
        } else {
          data = Array.isArray(data) ? data : [data];
          if (data.length === 0) {
            setHasNoData(true);
          } else {
            tempColumns = headers || Object.keys(data[0]);
            setRows(data);
          }
        }
      } catch (ex) {
        logger.warn(ex);
        setHasNoData(true);
      }

      if (tempColumns) {
        setRows(data);
        setColumns(
          tempColumns
            .filter((column) => column !== 'attributes')
            .map((column) => ({
              accessor: column,
              Header: () => (
                <div className="slds-line-clamp_medium" title={field.title}>
                  {column}
                </div>
              ),
              Cell: ({ value }) => {
                return getQueryResultsCellContents(field, serverUrl, org, value);
              },
            }))
        );
      }
    }
    setIsOpen(true);
  }

  return (
    <Fragment>
      {isOpen && (
        <Modal size="lg" closeOnBackdropClick onClose={() => setIsOpen(false)}>
          <div>
            {hasNoData && <span>There is no data to show.</span>}
            {!hasNoData && columns && <DataTable columns={columns} data={rows} />}
          </div>
        </Modal>
      )}
      <button className="slds-button" onClick={() => handleOpen()}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        {Array.isArray(value) ? `${value.length} Records` : 'View Data'}
      </button>
    </Fragment>
  );
};

export default QueryResultsViewCellModal;

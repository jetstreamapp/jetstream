/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
import { DataTable, Icon, Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Column } from 'react-table';
import { getQueryResultsCellContents } from './query-results-table-utils';
import { queryResultColumnToTypeLabel } from '@jetstream/shared/utils';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsViewCellModalProps {
  parentRecord?: any;
  field: QueryFieldHeader;
  serverUrl: string;
  org: SalesforceOrgUi;
  value: any;
  // dynamically calculated if not provided
  headers?: string[];
}

export const QueryResultsViewCellModal: FunctionComponent<QueryResultsViewCellModalProps> = ({
  parentRecord,
  field,
  serverUrl,
  org,
  value,
  headers,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [modalHeader, setModalHeader] = useState<string>();
  const [modalTagline, setModalTagline] = useState<string>();
  const [hasNoData, setHasNoData] = useState<boolean>(false);
  const [columns, setColumns] = useState<Column<any>[]>(null);
  const [rows, setRows] = useState<any[]>(null);

  function calculateHeader() {
    if (!modalTagline && !!parentRecord) {
      let currModalTagline: string;
      let recordName: string;
      let recordId: string;
      try {
        if (parentRecord.Name) {
          recordName = parentRecord.Name;
        }
        if (parentRecord?.Id) {
          recordId = parentRecord.Id;
        } else if (parentRecord?.attributes?.url) {
          recordId = parentRecord.attributes.url.substring(parentRecord.attributes.url.lastIndexOf('/') + 1);
        }
      } catch (ex) {
        // ignore error
      } finally {
        // if we have name and id, then show both, otherwise only show one or the other
        if (recordName || recordId) {
          currModalTagline = 'Parent Record: ';
          if (recordName) {
            currModalTagline += recordName;
          }
          if (recordName && recordId) {
            currModalTagline += ` (${recordId})`;
          } else if (recordId) {
            currModalTagline += recordId;
          }
        }
        if (currModalTagline) {
          setModalTagline(currModalTagline);
        }
      }
    }
  }

  function handleOpen() {
    if (!columns) {
      calculateHeader();
      // core path that will result in the best table outcome
      let tempColumnsWithMeta: QueryFieldHeader[];
      // fallback if we do not have field metadata - will not render all fields
      let tempColumns: string[];
      let data = value;
      try {
        if (!data) {
          setHasNoData(true);
        } else if (Array.isArray(field?.columnMetadata?.childColumnPaths)) {
          const replaceRegex = new RegExp(`^${field.columnMetadata.columnFullPath}\.`);
          tempColumnsWithMeta = field.columnMetadata.childColumnPaths.map((columnMetadata) => {
            const fieldPath = columnMetadata.columnFullPath.replace(replaceRegex, '');
            return {
              accessor: fieldPath,
              columnMetadata,
              label: fieldPath,
              title: `${columnMetadata.displayName} (${queryResultColumnToTypeLabel(columnMetadata)})`,
            };
          });
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

      if (tempColumnsWithMeta) {
        setRows(data);
        setColumns(
          tempColumnsWithMeta.map((column) => ({
            accessor: column.accessor,
            Header: () => (
              <div className="slds-line-clamp_medium" title={column.title}>
                {column.label}
              </div>
            ),
            Cell: ({ value }) => {
              return getQueryResultsCellContents(column, serverUrl, org, value);
            },
          }))
        );
      } else if (tempColumns) {
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

  // TODO: deprecate me!
  return (
    <Fragment>
      {isOpen && (
        <Modal size="lg" header={field.title} tagline={modalTagline} closeOnBackdropClick onClose={() => setIsOpen(false)}>
          <div className="slds-scrollable_x">
            {hasNoData && <span>There is no data to show.</span>}
            {/* {!hasNoData && columns && <DataTable columns={columns} data={rows} />} */}
          </div>
        </Modal>
      )}
      <button className="link-button" onClick={() => handleOpen()}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        {Array.isArray(value) ? `${value.length} Records` : 'View Data'}
      </button>
    </Fragment>
  );
};

export default QueryResultsViewCellModal;

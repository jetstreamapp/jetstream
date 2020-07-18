/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Fragment, FunctionComponent, memo, useMemo } from 'react';
import TableBase from '../table/TableBase';
import { getSortableResizableColumns } from './table-utils';
import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TableSortableResizableProps {
  headers: QueryFieldHeader[];
  data: any[];
  serverUrl: string;
  org: SalesforceOrgUi;
  onRowSelection?: (rows) => void;
  onRowAction: (id: string, row: any) => void;
}

export const TableSortableResizable: FunctionComponent<TableSortableResizableProps> = memo(
  ({ headers, data, serverUrl, org, onRowSelection, onRowAction }) => {
    const memoizedColumns = useMemo(() => getSortableResizableColumns(headers, serverUrl, org, onRowAction), [
      headers,
      serverUrl,
      org,
      onRowAction,
    ]);
    const memoizedData = useMemo(() => [...data], [data]);

    return (
      <Fragment>{headers && data && <TableBase data={memoizedData} columns={memoizedColumns} onRowSelection={onRowSelection} />}</Fragment>
    );
  }
);

export default TableSortableResizable;

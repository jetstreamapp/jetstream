/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, memo, useMemo } from 'react';
import TableBase from '../table/TableBase';
import { getSortableResizableColumns } from './table-utils';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TableSortableResizableProps {
  headers: QueryFieldHeader[];
  data: any[];
  serverUrl: string;
  org: SalesforceOrgUi;
  onRowSelection?: (rows) => void;
  onRowAction: (id: string, row: any) => void;
}

function areEqual(prevProps: TableSortableResizableProps, nextProps: TableSortableResizableProps): boolean {
  return (
    prevProps.headers === nextProps.headers &&
    prevProps.data === nextProps.data &&
    prevProps.serverUrl === nextProps.serverUrl &&
    prevProps.org === nextProps.org
  );
}

export const TableSortableResizable: FunctionComponent<TableSortableResizableProps> = memo(
  ({ headers, data, serverUrl, org, onRowSelection, onRowAction }) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedColumns = useMemo(() => getSortableResizableColumns(headers, serverUrl, org, onRowAction), [
      headers,
      serverUrl,
      org,
      // onRowAction,
    ]);
    const memoizedData = useMemo(() => [...data], [data]);

    return (
      <Fragment>{headers && data && <TableBase data={memoizedData} columns={memoizedColumns} onRowSelection={onRowSelection} />}</Fragment>
    );
  },
  areEqual
);

export default TableSortableResizable;

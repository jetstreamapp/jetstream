/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Fragment, FunctionComponent, memo, useMemo } from 'react';
import TableBase from '../table/TableBase';
import { getSortableResizableColumns } from './table-utils';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TableSortableResizableProps {
  headers: string[];
  data: any[];
  onRowSelection?: (rows) => void;
}

export const TableSortableResizable: FunctionComponent<TableSortableResizableProps> = memo(({ headers, data, onRowSelection }) => {
  const memoizedColumns = useMemo(() => getSortableResizableColumns(headers), [headers]);
  const memoizedData = useMemo(() => [...data], [data]);

  return (
    <Fragment>{headers && data && <TableBase data={memoizedData} columns={memoizedColumns} onRowSelection={onRowSelection} />}</Fragment>
  );
});

export default TableSortableResizable;

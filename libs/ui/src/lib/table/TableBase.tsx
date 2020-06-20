/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */

import { jsx } from '@emotion/core';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useBlockLayout, useResizeColumns, useRowSelect, useSortBy, useTable } from 'react-table';
import { alphanumeric } from './table-sort';

// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react-table/react-table-tests.tsx
declare module 'react-table' {
  // take this file as-is, or comment out the sections that don't apply to your plugin configuration
  interface TableOptions<D extends object>
    extends UseExpandedOptions<D>,
      UseFiltersOptions<D>,
      UseGlobalFiltersOptions<D>,
      UseGroupByOptions<D>,
      UsePaginationOptions<D>,
      UseResizeColumnsOptions<D>,
      UseRowSelectOptions<D>,
      UseRowStateOptions<D>,
      UseSortByOptions<D> {
    updateMyData?: (rowIndex: number, columnId: string, value: any) => void;
  }

  interface TableInstance<D extends object = {}>
    extends UseColumnOrderInstanceProps<D>,
      UseExpandedInstanceProps<D>,
      UseFiltersInstanceProps<D>,
      UseGlobalFiltersInstanceProps<D>,
      UseGroupByInstanceProps<D>,
      UsePaginationInstanceProps<D>,
      UseRowSelectInstanceProps<D>,
      UseRowStateInstanceProps<D>,
      UseSortByInstanceProps<D> {
    editable: boolean;
  }

  interface TableState<D extends object = {}>
    extends UseColumnOrderState<D>,
      UseExpandedState<D>,
      UseFiltersState<D>,
      UseGlobalFiltersState<D>,
      UseGroupByState<D>,
      UsePaginationState<D>,
      UseResizeColumnsState<D>,
      UseRowSelectState<D>,
      UseRowStateState<D>,
      UseSortByState<D> {}

  interface ColumnInterface<D extends object = {}>
    extends UseFiltersColumnOptions<D>,
      UseGlobalFiltersColumnOptions<D>,
      UseGroupByColumnOptions<D>,
      UseResizeColumnsColumnOptions<D>,
      UseSortByColumnOptions<D> {}

  interface ColumnInstance<D extends object = {}>
    extends UseFiltersColumnProps<D>,
      UseGroupByColumnProps<D>,
      UseResizeColumnsColumnProps<D>,
      UseSortByColumnProps<D> {}

  interface Cell<D extends object = {}> extends UseGroupByCellProps<D>, UseRowStateCellProps<D> {}

  interface Row<D extends object = {}>
    extends UseExpandedRowProps<D>,
      UseGroupByRowProps<D>,
      UseRowSelectRowProps<D>,
      UseRowStateRowProps<D> {}
}

export interface TableProps {
  data: any[];
  columns: any[];
  onRowSelection?: (rows) => void;
}

export const Table: FunctionComponent<TableProps> = ({ data, columns, onRowSelection }) => {
  const defaultColumn = useMemo(
    () => ({
      minWidth: 30,
      width: 150,
      maxWidth: 400,
    }),
    []
  );
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,

    selectedFlatRows,

    page, // Instead of using 'rows', we'll use page,
    // // which has only the rows for the active page

    // // The rest of these things are super handy, too ;)
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
  } = useTable(
    { columns, data, defaultColumn, sortTypes: { alphanumeric } },
    useBlockLayout,
    useResizeColumns,
    useSortBy,
    useRowSelect,
    /** usePagination, FIXME: */ (hooks) => {
      hooks.visibleColumns.push((columns) => [
        // Let's make a column for selection
        {
          id: 'selection',
          width: 32,
          minWidth: 32,
          maxWidth: 32,
          Header: (table) => (
            <th {...table.column.getHeaderProps()} className="slds-text-align_right" scope="col">
              <span id="column-group-header" className="slds-assistive-text">
                Choose a row
              </span>
              <div className="slds-th__action slds-th__action_form">
                <div className="slds-checkbox">
                  <input
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...table.getToggleAllRowsSelectedProps({ indeterminate: undefined })}
                    type="checkbox"
                    name="options"
                    id="check-select-all"
                    value="check-select-all"
                    tabIndex={0}
                    aria-labelledby="check-select-all-label column-group-header"
                  />
                  <label className="slds-checkbox__label" htmlFor="check-select-all" id="check-select-all-label">
                    <span className="slds-checkbox_faux"></span>
                    <span className="slds-form-element__label slds-assistive-text">Select All</span>
                  </label>
                </div>
              </div>
            </th>
          ),
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          Cell: (table) => (
            <td {...table.cell.getCellProps()} className="slds-text-align_right" role="gridcell">
              <div className="slds-checkbox">
                <input
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...table.row.getToggleRowSelectedProps({ indeterminate: undefined })}
                  type="checkbox"
                  name="options"
                  id={table.row.id}
                  value={table.row.id}
                  tabIndex={0}
                  aria-labelledby={`check-button-label-${table.row.id} column-group-header`}
                />
                <label className="slds-checkbox__label" htmlFor={table.row.id} id={table.row.id}>
                  <span className="slds-checkbox_faux"></span>
                  <span className="slds-form-element__label slds-assistive-text">Select item {table.row.id}</span>
                </label>
              </div>
            </td>
          ),
        },
        ...columns,
      ]);
    }
  );

  const [selectedRowsLength, setSelectedRowsLength] = useState<number>(null);
  useEffect(() => {
    if (onRowSelection && Array.isArray(selectedFlatRows) && selectedRowsLength !== selectedFlatRows.length) {
      setSelectedRowsLength(selectedFlatRows.length);
      onRowSelection(selectedFlatRows.map((row) => row.original));
    }
  }, [onRowSelection, selectedFlatRows, selectedRowsLength]);

  return (
    // TODO: the table width is only the viewport.... this needs to be set to the width of the first row or something
    <table
      {...getTableProps()}
      aria-multiselectable="true"
      className="slds-table slds-table_bordered slds-table_fixed-layout slds-table_resizable-cols  slds-table_col-bordered"
      role="grid"
    >
      <thead>
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()} className="slds-line-height_reset">
            {headerGroup.headers.map((column) => (
              <Fragment key={column.getHeaderProps().key}>{column.render('Header')}</Fragment>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} aria-selected="false" className="slds-hint-parent">
              {row.cells.map((cell) => (
                <Fragment key={cell.getCellProps().key}>{cell.render('Cell')}</Fragment>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default Table;

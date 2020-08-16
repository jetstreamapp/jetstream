/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Record } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { forwardRef, Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Column, TableToggleAllRowsSelectedProps, useFlexLayout, useRowSelect, useSortBy, useTable } from 'react-table';
import Icon from '../widgets/Icon';

const CHECKBOX_COLUMN_ID = 'selection';

export interface DataTableProps {
  columns: Column<any>[];
  data: Record[];
  allowRowSelection?: boolean;
  onRowSelection?: (rows: Record[]) => void;
}

const RowCheckbox = forwardRef<HTMLInputElement, Partial<TableToggleAllRowsSelectedProps>>(({ checked, onChange, role, title }, ref) => {
  const defaultRef = useRef<HTMLInputElement>();
  const [id] = useState(uniqueId('row-checkbox'));
  const resolvedRef = ref || defaultRef;

  return (
    <div className="slds-checkbox">
      <input ref={resolvedRef} type="checkbox" name="options" role={role} id={id} checked={checked} onChange={onChange} />
      <label className="slds-checkbox__label" htmlFor={id}>
        <span className="slds-checkbox_faux"></span>
        <span className="slds-form-element__label slds-assistive-text">Select Row</span>
      </label>
    </div>
  );
});

export const DataTable: FunctionComponent<DataTableProps> = ({ columns, data, allowRowSelection = false, onRowSelection }) => {
  const { getTableProps, getTableBodyProps, headerGroups, rows, selectedFlatRows, prepareRow } = useTable(
    {
      columns,
      data,
    },
    useSortBy,
    useRowSelect,
    useFlexLayout,
    (hooks) => {
      if (allowRowSelection) {
        hooks.visibleColumns.push((columns) => [
          {
            id: 'selection',
            disableResizing: true,
            minWidth: 35,
            width: 35,
            maxWidth: 35,
            Header: ({ getToggleAllRowsSelectedProps }) => <RowCheckbox {...getToggleAllRowsSelectedProps()} />,
            Cell: ({ row }) => <RowCheckbox {...row.getToggleRowSelectedProps()} />,
          },
          ...columns,
        ]);
      }
    }
  );

  useEffect(() => {
    if (onRowSelection && selectedFlatRows) {
      onRowSelection(selectedFlatRows.map((row) => row.original));
    }
  }, [onRowSelection, selectedFlatRows]);

  return (
    <Fragment>
      <table
        {...getTableProps()}
        aria-multiselectable="true"
        className="slds-table slds-table_bordered slds-table_fixed-layout slds-table_resizable-cols  slds-table_col-bordered"
        role="grid"
      >
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()} className="slds-line-height_reset">
              {headerGroup.headers.map((column) => {
                // Select all column has different structure
                switch (column.id) {
                  case CHECKBOX_COLUMN_ID:
                    return (
                      <th
                        {...column.getHeaderProps()}
                        aria-label={CHECKBOX_COLUMN_ID}
                        scope="col"
                        className="slds-text-align_right"
                        css={css`
                          max-width: 35px;
                        `}
                      >
                        <span id="selection-header" className="slds-assistive-text">
                          Choose a row
                        </span>
                        <div className="slds-th__action slds-th__action_form">{column.render('Header')}</div>
                      </th>
                    );

                  default:
                    return (
                      <th
                        {...column.getHeaderProps()}
                        aria-label={column.id}
                        aria-sort={column.isSorted ? (column.isSortedDesc ? 'descending' : 'ascending') : 'none'}
                        className={classNames('slds-is-sortable', { 'slds-is-sorted': column.isSorted })}
                        scope="col"
                      >
                        <span
                          className="slds-th__action slds-text-link_reset"
                          role="button"
                          tabIndex={0}
                          {...column.getSortByToggleProps()}
                        >
                          <span className="slds-assistive-text">Sort by: </span>
                          <div className="slds-grid slds-grid_vertical-align-center slds-has-flexi-truncate">
                            <div className="slds-truncate" title={column.id}>
                              {column.render('Header')}
                            </div>
                            {column.isSorted && (
                              <Fragment>
                                {column.isSortedDesc ? (
                                  <Icon
                                    type="utility"
                                    icon="arrowdown"
                                    containerClassname="slds-icon_container slds-icon-utility-arrowdown"
                                    className="slds-icon slds-icon-text-default slds-is-sortable__icon"
                                  />
                                ) : (
                                  <Icon
                                    type="utility"
                                    icon="arrowup"
                                    containerClassname="slds-icon_container slds-icon-utility-arrowup"
                                    className="slds-icon slds-icon-text-default slds-is-sortable__icon"
                                  />
                                )}
                              </Fragment>
                            )}
                          </div>
                        </span>
                      </th>
                    );
                }
              })}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row, i) => {
            prepareRow(row);
            return (
              <tr
                {...row.getRowProps()}
                aria-selected={row.isSelected}
                className={classNames('slds-hint-parent table-row', { 'is-selected': row.isSelected })}
              >
                {row.cells.map((cell, i) => {
                  const cellProps = cell.getCellProps();

                  if (cell.column.id === CHECKBOX_COLUMN_ID) {
                    return (
                      <td
                        {...cellProps}
                        className="slds-text-align_right"
                        role="gridcell"
                        css={css`
                          max-width: 35px;
                        `}
                      >
                        {cell.render('Cell')}
                      </td>
                    );
                  } else if (i === (allowRowSelection ? 1 : 0)) {
                    return (
                      <th {...cellProps} scope="row">
                        {cell.render('Cell')}
                      </th>
                    );
                  } else {
                    return (
                      <td {...cellProps} role="gridcell">
                        {cell.render('Cell')}
                      </td>
                    );
                  }
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Fragment>
  );
};

export default DataTable;

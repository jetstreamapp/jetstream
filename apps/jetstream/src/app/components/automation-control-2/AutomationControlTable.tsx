/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useEffect } from 'react';
import { Column, useExpanded, useFlexLayout, useTable } from 'react-table';
import { AutomationControlRow, AutomationControlRowMetadataItem } from './temp-types';

const CHECKBOX_COLUMN_ID = 'selection';

export interface AutomationControlTableProps {
  columns: Column<any>[];
  data: AutomationControlRow[];
  fetchMetadata: (rowsThatNeedData: AutomationControlRowMetadataItem[]) => void;
}

export const AutomationControlTable: FunctionComponent<AutomationControlTableProps> = ({ columns, data, fetchMetadata }) => {
  logger.log({ columns, data });

  const tableData = useTable(
    {
      columns,
      data,
    },
    useFlexLayout,
    useExpanded
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    selectedFlatRows,
    expandedDepth,
    expandedRows,
    expandSubRows,
    rowsById,
    groupedRowsById,
    filteredRowsById,
    toggleRowExpanded,
    prepareRow,
    state: { expanded },
  } = tableData;

  useEffect(() => {
    if (expandedDepth >= 2) {
      // see if any expanded items need to have their data fetched
      const rowsThatNeedData: AutomationControlRowMetadataItem[] = Object.keys(expanded)
        .map((key) => rowsById[key])
        .filter((row) => row.depth === 1) // only metadata children
        .map((row) => row.subRows[0])
        .filter((row) => row && row.values.name === 'SUB_ROW_PLACEHOLDER' && !row.values._loadingData)
        .map((row) => row.original);
      if (rowsThatNeedData.length > 0) {
        logger.log({ rowsThatNeedData });
        fetchMetadata(rowsThatNeedData);
      }
    }
  }, [expanded, expandedDepth, rowsById]);

  useEffect(() => {
    logger.log({ tableData });
  }, [tableData]);

  return (
    <Fragment>
      <table
        {...getTableProps()}
        aria-multiselectable="true"
        className="slds-table slds-table_bordered slds-table_edit slds-table_fixed-layout slds-tree slds-table_tree"
        role="treegrid"
      >
        <thead
        // css={css({
        //   overflowY: 'auto',
        //   overflowX: 'hidden',
        // })}
        >
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()} className="slds-line-height_reset">
              {headerGroup.headers.map((column) => (
                <th {...column.getHeaderProps()} aria-label={column.id} aria-sort="none" scope="col">
                  <div className="slds-truncate" title={column.id}>
                    {column.render('Header')}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          {...getTableBodyProps()}
          // css={css({
          //   overflowY: 'scroll',
          //   overflowX: 'hidden',
          //   height: '250px',
          // })}
        >
          {rows.map((row, i) => {
            prepareRow(row);
            return (
              <tr
                {...row.getRowProps()}
                aria-expanded={row.isExpanded}
                aria-level={row.depth}
                aria-posinset={1}
                aria-selected={false}
                aria-setsize={3 - row.depth}
                className={classNames('slds-hint-parent')}
              >
                {row.cells.map((cell, i) => {
                  const cellProps = cell.getCellProps();
                  if (i === 0) {
                    return (
                      <th
                        {...cellProps}
                        scope="row"
                        className="slds-tree__item"
                        // css={css({
                        // flexGrow: 0,
                        // })}
                      >
                        {cell.render('Cell')}
                      </th>
                    );
                  } else {
                    return (
                      <td
                        {...cellProps}
                        role="gridcell"
                        // css={css({
                        // flexGrow: 0,
                        // })}
                      >
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

export default AutomationControlTable;

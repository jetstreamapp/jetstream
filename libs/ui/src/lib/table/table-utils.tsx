/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import isObjectLike from 'lodash/isObjectLike';
import { Fragment, PropsWithChildren } from 'react';
import { CellProps, Column, HeaderProps } from 'react-table';
import DropDown from '../form/dropdown/DropDown';
import Icon from '../widgets/Icon';

/**
 * TODO: we can probably have one method with options that handles varying configurations
 *
 * @param headers
 */
export function getSortableResizableColumns(headers: string[]) {
  if (!headers) {
    return [];
  }

  const columns = headers.map((header) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableColumn: Column<any> = {
      accessor: header,
      width: 200,
      minWidth: 50,
      maxWidth: 500,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Header: ({ column }: PropsWithChildren<HeaderProps<any>>, columnModel) => {
        return (
          /**
           * TODO:
           * 1. ~~move all this to the table component (or a wrapper around the table component)~~
           * 2. add support for fields that are objects
           * 3. flatten records first to support relationships
           * 4. Add column action to allow wrap vs truncate - slds-cell-wrap
           * 5. Figure out table width issue
           * 6. Add browser pagination
           * 7. Figure out auto-height
           */
          <th
            {...column.getHeaderProps()}
            aria-label={header}
            aria-sort={column.isSorted ? (column.isSortedDesc ? 'descending' : 'ascending') : 'none'}
            className={classNames('slds-is-resizable slds-is-sortable', { 'slds-is-sorted': column.isSorted })}
            scope="col"
          >
            <span {...column.getSortByToggleProps()} className="slds-th__action slds-text-link_reset" role="button" tabIndex={0}>
              <span className="slds-assistive-text">Sort by: </span>
              <div className="slds-grid slds-grid_vertical-align-center slds-has-flexi-truncate">
                <div className="slds-truncate" title={header}>
                  {header}
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
            <div className="slds-resizable">
              <input
                type="range"
                aria-label="Name column width"
                className="slds-resizable__input slds-assistive-text"
                id={`${column.id}-resize`}
                max="1000"
                min="20"
                tabIndex={0}
              />
              <span className="slds-resizable__handle" {...column.getResizerProps()}>
                <span className="slds-resizable__divider"></span>
              </span>
            </div>
          </th>
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Cell: getCellRenderer,
    };
    return tableColumn;
  });

  return [getActionColumn(), ...columns];
}

function getActionColumn() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionColumn: Column<any> = {
    id: 'action',
    width: 32,
    minWidth: 32,
    maxWidth: 32,
    Header: (table) => (
      <th {...table.column.getHeaderProps()} className="slds-text-align_right" scope="col">
        <div className="slds-truncate slds-assistive-text" title="Actions">
          Actions
        </div>
      </th>
    ),
    // The cell can use the individual row's getToggleRowSelectedProps method
    // to the render a checkbox
    Cell: (table) => (
      <td {...table.cell.getCellProps()} role="gridcell">
        <DropDown
          buttonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
          position="left"
          items={[
            { id: '1', value: 'test item 1', metadata: table.row.original },
            { id: '2', value: 'test item 2', metadata: table.row.original },
          ]}
          onSelected={(itemId, row) => {
            console.log({ itemId, row });
          }}
        />
      </td>
    ),
  };
  return actionColumn;
}

function getCellRenderer({ cell, value }: PropsWithChildren<CellProps<any>>) {
  const isObject = isObjectLike(value);
  return (
    <td {...cell.getCellProps()} role="gridcell">
      {!isObject && (
        <div className="slds-truncate" title={`${value}`}>
          {value}
        </div>
      )}
      {/* TODO: */}
      {isObject && (
        <div>
          <button className="slds-button">
            <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
            View Data
          </button>
        </div>
      )}
    </td>
  );
}

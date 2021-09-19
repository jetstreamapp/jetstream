/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 *
 *
 * [DEPRECATED]
 *
 *
 */

import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
import classNames from 'classnames';
import isBoolean from 'lodash/isBoolean';
import isObjectLike from 'lodash/isObjectLike';
import { Fragment, PropsWithChildren, ReactNode } from 'react';
import { CellProps, Column, HeaderProps } from 'react-table';
import Checkbox from '../form/checkbox/Checkbox';
import DropDown from '../form/dropdown/DropDown';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';

/**
 * TODO: we can probably have one method with options that handles varying configurations
 *
 * @param headers
 */
export function getSortableResizableColumns(
  headers: QueryFieldHeader[],
  serverUrl: string,
  org: SalesforceOrgUi,
  onRowAction: (id: string, row: any) => void
) {
  if (!headers) {
    return [];
  }

  const columns = headers.map((header) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableColumn: Column<any> = {
      accessor: header.accessor,

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
            aria-label={header.label}
            aria-sort={column.isSorted ? (column.isSortedDesc ? 'descending' : 'ascending') : 'none'}
            className={classNames('slds-is-resizable slds-is-sortable', { 'slds-is-sorted': column.isSorted })}
            scope="col"
          >
            <span {...column.getSortByToggleProps()} className="slds-th__action slds-text-link_reset" role="button" tabIndex={0}>
              <span className="slds-assistive-text">Sort by: </span>
              <div className="slds-grid slds-grid_vertical-align-center slds-has-flexi-truncate">
                <div className="slds-truncate" title={header.title}>
                  {header.label}
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
      Cell: getCellRenderer(header, serverUrl, org),
    };
    return tableColumn;
  });

  // TODO: Commenting out for now until we find specific use-cases for row dropdowns to have row actions
  // View field details is a bit messy, and deleting one by one records is not that valuable
  // return [getActionColumn(onRowAction), ...columns];
  return columns;
}

// TODO: This is unused for now - but can be used for specific row actions in the future
function getActionColumn(onRowAction: (id: string, row: any) => void) {
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
            {
              id: 'view-record',
              value: 'View record with all fields',
              metadata: table.row.original,
              icon: { type: 'utility', icon: 'record_lookup', description: 'view record' },
            },
            {
              id: 'delete record',
              value: 'Delete record',
              metadata: table.row.original,
              icon: { type: 'utility', icon: 'delete', description: 'delete' },
            },
          ]}
          onSelected={onRowAction}
        />
      </td>
    ),
  };
  return actionColumn;
}

function getCellRenderer(header: QueryFieldHeader, serverUrl: string, org: SalesforceOrgUi) {
  return ({ cell, column, value }: PropsWithChildren<CellProps<any, any>>) => {
    let type: 'other' | 'object' | 'boolean' | 'id' = 'other';
    if (isObjectLike(value)) {
      type = 'object';
    } else if (header.columnMetadata.apexType === 'Boolean' || isBoolean(value)) {
      type = 'boolean';
    } else if (header.columnMetadata.apexType === 'Id') {
      type = 'id';
    }
    // const isObject = isObjectLike(value);
    // const isId = !!value && REGEX.SALESFORCE_ID.test(value);
    let content: ReactNode;
    const celProps = cell.getCellProps();
    switch (type) {
      case 'object':
        content = (
          <div>
            <button className="slds-button">
              <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
              View Data
            </button>
          </div>
        );
        break;
      case 'boolean':
        content = <Checkbox id={celProps.key as string} checked={value} label="value" hideLabel readOnly />;
        break;
      case 'id':
        content = (
          <div className="slds-truncate" title={`${value}`}>
            <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={`/${value}`} omitIcon>
              {value}
            </SalesforceLogin>
          </div>
        );
        break;
      default:
        content = (
          <div className="slds-truncate" title={`${value}`}>
            {value}
          </div>
        );
        break;
    }

    return (
      <td {...celProps} role="gridcell">
        {content}
      </td>
    );
  };
}

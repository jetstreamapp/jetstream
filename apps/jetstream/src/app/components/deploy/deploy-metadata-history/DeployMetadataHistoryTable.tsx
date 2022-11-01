import { ColDef, GetRowIdParams, RowHeightParams } from '@ag-grid-community/core';
import { MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { DataTable, DataTableNew, DateFilterComparator } from '@jetstream/ui';
import { ColumnWithFilter } from 'libs/ui/src/lib/data-table-new/data-table-types';
import { setColumnFromType } from 'libs/ui/src/lib/data-table-new/data-table-utils';
import { FunctionComponent, useContext, useMemo } from 'react';
import { RowHeightArgs } from 'react-data-grid';
import { DeployHistoryTableContext } from '../deploy-metadata.types';
import { ActionRenderer, OrgRenderer, StatusRenderer } from './DeployMetadataHistoryTableRenderers';

const TYPE_MAP = {
  package: 'Package upload',
  delete: 'Delete metadata',
  changeset: 'Add to changeset',
  orgToOrg: 'Org to org',
};

const COLUMNS: ColumnWithFilter<SalesforceDeployHistoryItem>[] = [
  {
    ...setColumnFromType('start', 'date'),
    name: 'Started',
    key: 'start',
    width: 200,
    // valueFormatter: dataTableDateFormatter,
    // getQuickFilterText: dataTableDateFormatter,
    // tooltipField: 'start',
    // filter: 'agDateColumnFilter',
    // filterParams: {
    //   defaultOption: 'greaterThan',
    //   comparator: DateFilterComparator,
    //   buttons: ['clear'],
    // },
    filters: [], // FIXME: does not work in modal
  },
  {
    ...setColumnFromType('type', 'text'),
    name: 'Type',
    key: 'type',
    // valueGetter: ({ data }) => TYPE_MAP[data.type],
    width: 165,
    formatter: ({ column, row }) => TYPE_MAP[row[column.key]],
    filters: [], // FIXME: does not work in modal
  },
  {
    ...setColumnFromType('type', 'text'),
    name: 'Deployed To Org',
    key: 'destinationOrg.label',
    formatter: OrgRenderer,
    width: 350,
    filters: [], // FIXME: does not work in modal
  },
  {
    name: 'Status',
    key: 'status',
    formatter: StatusRenderer,
    width: 150,
    // filterValueGetter: ({ data }) => {
    //   const item = data as SalesforceDeployHistoryItem;
    //   return item.status === 'SucceededPartial' ? 'Partial Success' : item.status;
    // },
    filters: [], // FIXME: does not work in modal
  },
  {
    name: 'Actions',
    key: 'actionRenderer',
    width: 220,
    // filter: false,
    // menuTabs: [],
    sortable: false,
    resizable: false,
    formatter: ActionRenderer,
    filters: [], // FIXME: does not work in modal
  },
];

const getRowHeight =
  (orgsById: MapOf<SalesforceOrgUi>) =>
  ({ row: item, type }: RowHeightArgs<SalesforceDeployHistoryItem>) => {
    const rowHeight = 27.5;
    let numberOfRows = 3;
    if (type === 'ROW') {
      if (item.type === 'orgToOrg') {
        /** we need 3 rows plus a little buffer */
        numberOfRows = 3.5;
      } else if (item.fileKey || (item.sourceOrg && orgsById[item.sourceOrg.uniqueId])) {
        /** we need 3 rows */
        return 27.5 * 3;
      }
    }
    return rowHeight * numberOfRows;
  };
const getRowId = ({ key }: SalesforceDeployHistoryItem) => key;

export interface DeployMetadataHistoryTableProps {
  items: SalesforceDeployHistoryItem[];
  orgsById: MapOf<SalesforceOrgUi>;
  onView: (item: SalesforceDeployHistoryItem) => void;
  onDownload: (item: SalesforceDeployHistoryItem) => void;
}

export const DeployMetadataHistoryTable: FunctionComponent<DeployMetadataHistoryTableProps> = ({ items, orgsById, onView, onDownload }) => {
  const context: DeployHistoryTableContext = useMemo(() => ({ orgsById, onView, onDownload }), [orgsById, onView, onDownload]);
  const getRowHeightFn = useMemo(() => getRowHeight(orgsById), [orgsById]);
  return (
    <DataTableNew
      columns={COLUMNS}
      data={items}
      getRowKey={getRowId}
      context={context}
      rowHeight={getRowHeightFn}
      // defaultMenuTabs={['filterMenuTab']}
      // agGridProps={{
      //   getRowId,
      //   getRowHeight,
      //   context: {
      //     orgsById,
      //     onView,
      //     onDownload,
      //   },
      //   enableRangeSelection: false,
      //   suppressCellFocus: true,
      //   suppressRowClickSelection: true,
      //   enableCellTextSelection: true,
      //   components: {
      //     orgRenderer: OrgRenderer,
      //     actionRenderer: ActionRenderer,
      //     statusRenderer: StatusRenderer,
      //   },
      // }}
    />
  );
};

export default DeployMetadataHistoryTable;

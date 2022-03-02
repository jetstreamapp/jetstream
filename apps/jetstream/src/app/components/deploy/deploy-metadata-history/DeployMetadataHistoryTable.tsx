import { ColDef, RowHeightParams } from '@ag-grid-community/core';
import { MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { DataTable, DateFilterComparator } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { DeployHistoryTableContext } from '../deploy-metadata.types';
import { dataTableDateFormatter } from '../utils/deploy-metadata.utils';
import { ActionRenderer, OrgRenderer, StatusRenderer } from './DeployMetadataHistoryTableRenderers';

const TYPE_MAP = {
  package: 'Uploaded package',
  changeset: 'Add to changeset',
  orgToOrg: 'Org to org',
};

const COLUMNS: ColDef[] = [
  {
    headerName: 'Started',
    colId: 'date',
    field: 'start',
    width: 200,
    valueFormatter: dataTableDateFormatter,
    getQuickFilterText: dataTableDateFormatter,
    tooltipField: 'start',
    filter: 'agDateColumnFilter',
    filterParams: {
      defaultOption: 'greaterThan',
      comparator: DateFilterComparator,
      buttons: ['clear'],
    },
  },
  {
    headerName: 'Type',
    colId: 'type',
    field: 'type',
    valueGetter: ({ data }) => TYPE_MAP[data.type],
    width: 165,
  },
  {
    headerName: 'Deployed To Org',
    colId: 'org',
    field: 'destinationOrg.label',
    cellRenderer: 'orgRenderer',
    width: 350,
  },
  {
    headerName: 'Status',
    colId: 'status',
    field: 'status',
    cellRenderer: 'statusRenderer',
    width: 150,
    filterValueGetter: ({ data }) => {
      const item = data as SalesforceDeployHistoryItem;
      return item.status === 'SucceededPartial' ? 'Partial Success' : item.status;
    },
  },
  {
    headerName: 'Actions',
    colId: 'actions',
    cellRenderer: 'actionRenderer',
    width: 220,
    filter: false,
    menuTabs: [],
    sortable: false,
  },
];

const getRowHeight = ({ data, context }: RowHeightParams) => {
  const item = data as SalesforceDeployHistoryItem;
  const { orgsById } = context as DeployHistoryTableContext;
  const rowHeight = 27.5;
  let numberOfRows = 3;
  if (item.type === 'orgToOrg') {
    /** we need 3 rows plus a little buffer */
    numberOfRows = 3.5;
  } else if (item.fileKey || (item.sourceOrg && orgsById[item.sourceOrg.uniqueId])) {
    /** we need 3 rows */
    return 27.5 * 3;
  }
  return rowHeight * numberOfRows;
};
const getRowNodeId = ({ key }: SalesforceDeployHistoryItem) => key;

export interface DeployMetadataHistoryTableProps {
  items: SalesforceDeployHistoryItem[];
  orgsById: MapOf<SalesforceOrgUi>;
  onView: (item: SalesforceDeployHistoryItem) => void;
  onDownload: (item: SalesforceDeployHistoryItem) => void;
}

export const DeployMetadataHistoryTable: FunctionComponent<DeployMetadataHistoryTableProps> = ({ items, orgsById, onView, onDownload }) => {
  return (
    <DataTable
      columns={COLUMNS}
      data={items}
      defaultMenuTabs={['filterMenuTab']}
      agGridProps={{
        immutableData: true,
        getRowNodeId,
        getRowHeight,
        context: {
          orgsById,
          onView,
          onDownload,
        },
        enableRangeSelection: false,
        suppressCellSelection: true,
        suppressRowClickSelection: true,
        enableCellTextSelection: true,
        frameworkComponents: {
          orgRenderer: OrgRenderer,
          actionRenderer: ActionRenderer,
          statusRenderer: StatusRenderer,
        },
      }}
    />
  );
};

export default DeployMetadataHistoryTable;

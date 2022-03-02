import { ColDef, RowHeightParams } from '@ag-grid-community/core';
import { MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { DataTable, DateFilterComparator } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { DeployHistoryTableContext } from '../deploy-metadata.types';
import { dataTableDateFormatter } from '../utils/deploy-metadata.utils';
import { ActionRenderer, OrgRenderer } from './DeployMetadataHistoryTableRenderers';

const TYPE_MAP = {
  package: 'Uploaded package',
  changeset: 'Add to changeset',
  orgToOrg: 'Org to org',
};

const COLUMNS: ColDef[] = [
  {
    headerName: 'Date',
    colId: 'date',
    field: 'start',
    width: 200,
    valueFormatter: dataTableDateFormatter,
    getQuickFilterText: dataTableDateFormatter,
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
    width: 140,
  },
  {
    headerName: 'Deployed To Org',
    colId: 'org',
    field: 'destinationOrgLabel',
    cellRenderer: 'orgRenderer',
    width: 325,
  },
  {
    headerName: 'Status',
    colId: 'status',
    field: 'status',
    width: 120,
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
  if (item.fileKey || (item.sourceOrgId && orgsById[item.sourceOrgId])) {
    /** 27.5 is normal row height - we need 3 rows */
    return 27.5 * 3;
  }
  return 40; // slightly larger because our action row button is taller
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
        },
      }}
    />
  );
};

export default DeployMetadataHistoryTable;

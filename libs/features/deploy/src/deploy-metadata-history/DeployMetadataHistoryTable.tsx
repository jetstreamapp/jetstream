import { DeployHistoryTableContext, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { ColumnWithFilter, DataTable, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
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
    draggable: true,
  },
  {
    ...setColumnFromType('type', 'text'),
    name: 'Type',
    key: 'type',
    width: 165,
    draggable: true,
    renderCell: ({ column, row }) => TYPE_MAP[row[column.key as keyof SalesforceDeployHistoryItem] as keyof typeof TYPE_MAP],
  },
  {
    ...setColumnFromType('destinationOrg', 'text'),
    name: 'Deployed To Org',
    key: 'destinationOrg',
    draggable: true,
    renderCell: OrgRenderer,
    getValue: ({ row }) => row.destinationOrg?.label,
    width: 350,
  },
  {
    ...setColumnFromType('status', 'text'),
    name: 'Status',
    key: 'status',
    draggable: true,
    renderCell: StatusRenderer,
    width: 150,
  },
  {
    name: 'Actions',
    key: 'actionRenderer',
    width: 220,
    sortable: false,
    resizable: false,
    draggable: true,
    renderCell: ActionRenderer,
  },
];

const getRowHeight = (orgsById: Record<string, SalesforceOrgUi>) => (row: SalesforceDeployHistoryItem) => {
  const rowHeight = 27.5;
  let numberOfRows = 3;
  if (row.type === 'orgToOrg') {
    /** we need 3 rows plus a little buffer */
    numberOfRows = 3.5;
  } else if (row.fileKey || (row.sourceOrg && orgsById[row.sourceOrg.uniqueId])) {
    /** we need 3 rows */
    return 27.5 * 3;
  }
  return rowHeight * numberOfRows;
};
const getRowId = ({ key }: SalesforceDeployHistoryItem) => key;

export interface DeployMetadataHistoryTableProps {
  items: SalesforceDeployHistoryItem[];
  orgsById: Record<string, SalesforceOrgUi>;
  modalRef: React.RefObject<HTMLDivElement>;
  onView: (item: SalesforceDeployHistoryItem) => void;
  onDownload: (item: SalesforceDeployHistoryItem) => void;
}

export const DeployMetadataHistoryTable: FunctionComponent<DeployMetadataHistoryTableProps> = ({
  items,
  orgsById,
  modalRef,
  onView,
  onDownload,
}) => {
  const context: DeployHistoryTableContext = useMemo(
    () => ({ orgsById, portalRefForFilters: modalRef, onView, onDownload }),
    [orgsById, modalRef, onView, onDownload]
  );
  const getRowHeightFn = useMemo(() => getRowHeight(orgsById), [orgsById]);
  return <DataTable columns={COLUMNS} data={items} getRowKey={getRowId} context={context} rowHeight={getRowHeightFn} />;
};

export default DeployMetadataHistoryTable;

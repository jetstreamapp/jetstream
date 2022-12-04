import { MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { ColumnWithFilter, DataTable, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
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
  },
  {
    ...setColumnFromType('type', 'text'),
    name: 'Type',
    key: 'type',
    width: 165,
    formatter: ({ column, row }) => TYPE_MAP[row[column.key]],
  },
  {
    ...setColumnFromType('destinationOrg', 'text'),
    name: 'Deployed To Org',
    key: 'destinationOrg',
    formatter: OrgRenderer,
    getValue: ({ row }) => row.destinationOrg?.label,
    width: 350,
  },
  {
    ...setColumnFromType('status', 'text'),
    name: 'Status',
    key: 'status',
    formatter: StatusRenderer,
    width: 150,
  },
  {
    name: 'Actions',
    key: 'actionRenderer',
    width: 220,
    sortable: false,
    resizable: false,
    formatter: ActionRenderer,
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
  return <DataTable allowReorder columns={COLUMNS} data={items} getRowKey={getRowId} context={context} rowHeight={getRowHeightFn} />;
};

export default DeployMetadataHistoryTable;

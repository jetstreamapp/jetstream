import { DataHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, setColumnFromType, SortColumn } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { DATA_HISTORY_SOURCE_LABELS, DATA_HISTORY_STATUS_LABELS, formatDataHistoryCounts } from './data-history-page.utils';
import { DataHistoryExportTarget } from './data-history-payload-views';
import {
  ActionsCellRenderer,
  OrgCellRenderer,
  PinnedCellRenderer,
  RecordsCellRenderer,
  StatusCellRenderer,
} from './DataHistoryTableRenderers';

/**
 * Row view-model for the history list table: scalar fields per column so the grid's accessor-based
 * sorting and header filters work directly, with the full entry on `item` for the rich renderers.
 */
export interface DataHistoryTableRowItem {
  item: DataHistoryItem;
  createdAt: Date;
  orgLabel: string;
  orgId: string;
  source: string;
  sobjects: string;
  status: string;
  records: number;
  pinned: boolean;
}

export interface DataHistoryTableContext {
  onView: (item: DataHistoryItem) => void;
  onDownload: (item: DataHistoryItem, target: DataHistoryExportTarget) => void;
  onTogglePin: (item: DataHistoryItem) => void;
  onDelete: (item: DataHistoryItem) => void;
}

const COLUMNS: ColumnWithFilter<DataHistoryTableRowItem>[] = [
  {
    ...setColumnFromType('createdAt', 'date'),
    name: 'Date',
    key: 'createdAt',
    width: 190,
    draggable: true,
  },
  {
    ...setColumnFromType('orgLabel', 'text'),
    name: 'Org',
    key: 'orgLabel',
    width: 220,
    draggable: true,
    renderCell: OrgCellRenderer,
  },
  {
    ...setColumnFromType('source', 'text'),
    name: 'Feature',
    key: 'source',
    width: 190,
    draggable: true,
  },
  {
    ...setColumnFromType('sobjects', 'text'),
    name: 'Object(s)',
    key: 'sobjects',
    width: 180,
    draggable: true,
  },
  {
    ...setColumnFromType('status', 'text'),
    name: 'Status',
    key: 'status',
    width: 140,
    draggable: true,
    renderCell: StatusCellRenderer,
  },
  {
    ...setColumnFromType('records', 'number'),
    name: 'Records',
    key: 'records',
    width: 190,
    draggable: true,
    renderCell: RecordsCellRenderer,
    // Filter/search on the text the user sees; sorting stays numeric via the raw `records` accessor
    getValue: ({ row }) => formatDataHistoryCounts(row.item),
  },
  {
    name: 'Pinned',
    key: 'pinned',
    width: 100,
    sortable: true,
    filters: ['BOOLEAN_SET'],
    renderCell: PinnedCellRenderer,
  },
  {
    name: 'Actions',
    key: 'actions',
    width: 210,
    sortable: false,
    resizable: false,
    renderCell: ActionsCellRenderer,
  },
];

const INITIAL_SORT: SortColumn[] = [{ columnKey: 'createdAt', direction: 'DESC' }];

const getRowKey = (row: DataHistoryTableRowItem) => row.item.key;

export interface DataHistoryTableProps {
  items: DataHistoryItem[];
  orgs: SalesforceOrgUi[];
  /** Changes whenever content above the table mounts/unmounts, so the full-height grid re-measures its top edge */
  recalculateKey?: string | number | boolean;
  onView: (item: DataHistoryItem) => void;
  onDownload: (item: DataHistoryItem, target: DataHistoryExportTarget) => void;
  onTogglePin: (item: DataHistoryItem) => void;
  onDelete: (item: DataHistoryItem) => void;
}

export const DataHistoryTable: FunctionComponent<DataHistoryTableProps> = ({
  items,
  orgs,
  recalculateKey,
  onView,
  onDownload,
  onTogglePin,
  onDelete,
}) => {
  // Salesforce org ids for the org column — entries only store the uniqueId + label snapshot
  const orgIdByUniqueId = useMemo(() => new Map(orgs.map(({ uniqueId, organizationId }) => [uniqueId, organizationId])), [orgs]);

  const rows = useMemo<DataHistoryTableRowItem[]>(
    () =>
      items.map((item) => ({
        item,
        createdAt: item.createdAt,
        orgLabel: item.orgLabel,
        orgId: orgIdByUniqueId.get(item.org) || item.org,
        source: DATA_HISTORY_SOURCE_LABELS[item.source],
        sobjects: item.sobjects.join(', '),
        status: DATA_HISTORY_STATUS_LABELS[item.status],
        records: item.counts.total,
        pinned: item.pinned,
      })),
    [items, orgIdByUniqueId],
  );

  const context: DataHistoryTableContext = useMemo(
    () => ({ onView, onDownload, onTogglePin, onDelete }),
    [onView, onDownload, onTogglePin, onDelete],
  );

  return (
    // minHeight keeps the table usable at high zoom / with many banners stacked above — the page
    // scrolls instead of the table collapsing to nothing
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={10} minHeight="300px" recalculateKey={recalculateKey}>
      <DataTable<DataHistoryTableRowItem>
        aria-label="Data history"
        data={rows}
        columns={COLUMNS}
        getRowKey={getRowKey}
        context={context}
        includeQuickFilter
        initialSortColumns={INITIAL_SORT}
        autoRowHeight
      />
    </AutoFullHeightContainer>
  );
};

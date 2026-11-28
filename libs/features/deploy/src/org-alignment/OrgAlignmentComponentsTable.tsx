import { BadgeType, ListItem } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  ColumnWithFilter,
  ComboboxWithItems,
  DataTable,
  dataTableDateFormatter,
  DataTableSelectedContext,
  Grid,
  Icon,
  SearchInput,
  SELECT_COLUMN_KEY,
  SelectColumn,
  setColumnFromType,
  Tooltip,
} from '@jetstream/ui';
import { FunctionComponent, ReactNode, useMemo } from 'react';
import { OrgAlignmentComponentItem, OrgAlignmentDiffStatus } from './orgAlignmentTypes';

export const ALL_TYPES_FILTER = 'ALL';

export const STATUS_LABELS: Record<OrgAlignmentDiffStatus, string> = {
  different: 'Different',
  onlyInSource: 'Only in Source',
  onlyInTarget: 'Only in Target',
  same: 'Same',
  uncomparable: 'Not Compared',
};

const STATUS_BADGE_TYPES: Record<OrgAlignmentDiffStatus, BadgeType> = {
  different: 'warning',
  onlyInSource: 'inverse',
  onlyInTarget: 'inverse',
  same: 'success',
  uncomparable: 'light',
};

interface ComponentRow {
  key: string;
  fullName: string;
  typeLabel: string;
  statusLabel: string;
  sourceModifiedBy: string | null;
  sourceModifiedDate: Date | null;
  targetModifiedBy: string | null;
  targetModifiedDate: Date | null;
  component: OrgAlignmentComponentItem;
}

const getRowKey = ({ key }: ComponentRow) => key;

const toDate = (value: Date | string | null | undefined) => (value ? new Date(value) : null);

function getColumns(onView: (component: OrgAlignmentComponentItem) => void): ColumnWithFilter<ComponentRow>[] {
  return [
    { ...SelectColumn, key: SELECT_COLUMN_KEY, resizable: false },
    {
      key: 'view',
      name: '',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      resizable: false,
      sortable: false,
      frozen: true,
      renderCell: ({ row }) => {
        if (row.component.status === 'uncomparable') {
          return null;
        }
        const isOneSided = row.component.status === 'onlyInSource' || row.component.status === 'onlyInTarget';
        const label = isOneSided ? 'View the content' : 'Compare the content';
        return (
          <div className="slds-grid slds-grid_align-center slds-grid_vertical-align-center h-100 w-100">
            <Tooltip ariaRole="label" content={label}>
              <button type="button" className="slds-button slds-button_icon" onClick={() => onView(row.component)} tabIndex={-1}>
                <Icon type="utility" icon="preview" className="slds-button__icon" omitContainer title={label} />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
    { ...setColumnFromType('fullName', 'text'), name: 'Component', key: 'fullName', frozen: true, width: 320 },
    { ...setColumnFromType('typeLabel', 'text'), name: 'Type', key: 'typeLabel', width: 190 },
    {
      ...setColumnFromType('statusLabel', 'text'),
      name: 'Status',
      key: 'statusLabel',
      width: 150,
      renderCell: ({ row }) => {
        const { key, status, uncomparableReason, isManaged } = row.component;
        const badge = <Badge type={STATUS_BADGE_TYPES[status]}>{row.statusLabel}</Badge>;
        return (
          <div className="slds-grid slds-grid_vertical-align-center h-100">
            {uncomparableReason ? (
              <Tooltip id={`org-alignment-status-${key}`} content={uncomparableReason}>
                {badge}
              </Tooltip>
            ) : (
              badge
            )}
            {isManaged && (
              <Badge type="light" className="slds-m-left_xx-small">
                Managed
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      ...setColumnFromType('sourceModifiedDate', 'date'),
      renderCell: ({ row }) => dataTableDateFormatter(row.sourceModifiedDate),
      name: 'Source Last Modified',
      key: 'sourceModifiedDate',
      width: 190,
    },
    { ...setColumnFromType('sourceModifiedBy', 'text'), name: 'Source Last Modified By', key: 'sourceModifiedBy', width: 190 },
    {
      ...setColumnFromType('targetModifiedDate', 'date'),
      renderCell: ({ row }) => dataTableDateFormatter(row.targetModifiedDate),
      name: 'Target Last Modified',
      key: 'targetModifiedDate',
      width: 190,
    },
    { ...setColumnFromType('targetModifiedBy', 'text'), name: 'Target Last Modified By', key: 'targetModifiedBy', width: 190 },
  ];
}

export interface OrgAlignmentComponentsTableProps {
  /** Components that match the status filter and the type filter */
  components: OrgAlignmentComponentItem[];
  typeFilterItems: ListItem[];
  typeFilter: string;
  /** Set when a filter is hiding components, describes what is being shown */
  filterDescription: string | null;
  searchTerm: string;
  selectedKeys: Set<string>;
  /** Changes whenever content above the table grows or collapses so the table height is measured again */
  layoutKey: string;
  /** Deploy direction, download and deploy actions */
  actions: ReactNode;
  onTypeFilterChange: (metadataType: string) => void;
  onSearchTermChange: (searchTerm: string) => void;
  onClearFilters: () => void;
  onSelectedKeysChange: (selectedKeys: Set<string>) => void;
  onView: (component: OrgAlignmentComponentItem) => void;
}

export const OrgAlignmentComponentsTable: FunctionComponent<OrgAlignmentComponentsTableProps> = ({
  components,
  typeFilterItems,
  typeFilter,
  filterDescription,
  searchTerm,
  selectedKeys,
  layoutKey,
  actions,
  onTypeFilterChange,
  onSearchTermChange,
  onClearFilters,
  onSelectedKeysChange,
  onView,
}) => {
  const columns = useMemo(() => getColumns(onView), [onView]);

  const rows = useMemo(
    () =>
      components.map((component): ComponentRow => ({
        key: component.key,
        fullName: component.fullName,
        typeLabel: component.typeLabel,
        statusLabel: STATUS_LABELS[component.status],
        sourceModifiedBy: component.sourceItem?.lastModifiedByName ?? null,
        sourceModifiedDate: toDate(component.sourceItem?.lastModifiedDate),
        targetModifiedBy: component.targetItem?.lastModifiedByName ?? null,
        targetModifiedDate: toDate(component.targetItem?.lastModifiedDate),
        component,
      })),
    [components],
  );

  return (
    <DataTableSelectedContext.Provider value={{ selectedRowIds: selectedKeys, getRowKey }}>
      <Grid align="spread" verticalAlign="end" wrap className="slds-m-bottom_x-small" gutters={false}>
        <Grid verticalAlign="end" wrap>
          <div className="slds-m-right_x-small slds-m-bottom_xx-small" style={{ width: '16rem' }}>
            <ComboboxWithItems
              comboboxProps={{ label: 'Metadata type', hideLabel: true, placeholder: 'Filter by metadata type', itemLength: 10 }}
              items={typeFilterItems}
              selectedItemId={typeFilter}
              onSelected={({ id }) => onTypeFilterChange(id)}
            />
          </div>
          <div className="slds-m-right_x-small slds-m-bottom_xx-small">
            <SearchInput
              id="org-alignment-component-search"
              placeholder="Search components..."
              value={searchTerm}
              onChange={(value) => onSearchTermChange(value || '')}
            />
          </div>
          {filterDescription && (
            <div className="slds-m-bottom_x-small slds-text-body_small slds-text-color_weak" role="status">
              {filterDescription}
              <button type="button" className="slds-button slds-m-left_x-small" onClick={onClearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </Grid>
        <Grid verticalAlign="center" wrap className="slds-m-bottom_xx-small">
          {actions}
        </Grid>
      </Grid>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} minHeight="22rem" recalculateKey={layoutKey}>
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={getRowKey}
          includeQuickFilter
          quickFilterText={searchTerm}
          selectedRows={selectedKeys}
          onSelectedRowsChange={onSelectedKeysChange}
        />
      </AutoFullHeightContainer>
    </DataTableSelectedContext.Provider>
  );
};

export default OrgAlignmentComponentsTable;

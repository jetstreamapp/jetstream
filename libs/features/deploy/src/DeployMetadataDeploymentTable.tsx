import { formatNumber, isBrowserExtension, isCanvasApp } from '@jetstream/shared/ui-utils';
import { DeployMetadataTableRow } from '@jetstream/types';
import { AutoFullHeightContainer, Checkbox, DataTableSelectedContext, DataTree, Grid, Icon, SearchInput } from '@jetstream/ui';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import { useAtom } from 'jotai';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import {
  getColumnDefinitions,
  getDeploymentTableContextMenuItems,
  handleDeploymentTableContextMenuAction,
  isEmptyMetadataTypeRow,
} from './utils/deploy-metadata.utils';

export interface DeployMetadataDeploymentTableProps {
  rows: DeployMetadataTableRow[];
  hasSelectedRows: boolean;
  onSelectedRows: (selectedRows: Set<DeployMetadataTableRow>) => void;
  onViewOrCompareOpen: () => void;
  onViewItem: (row: DeployMetadataTableRow) => void;
}

function getRowId(row: DeployMetadataTableRow): string {
  return `${row.key}-${row.type}`;
}

const groupedRows = ['typeLabel'] as const;

export const DeployMetadataDeploymentTable: FunctionComponent<DeployMetadataDeploymentTableProps> = ({
  rows,
  hasSelectedRows,
  onSelectedRows,
  onViewOrCompareOpen,
  onViewItem,
}) => {
  const columns = useMemo(() => getColumnDefinitions(onViewItem), [onViewItem]);
  const [isSingleOrgMode] = useState(() => isBrowserExtension() || isCanvasApp());
  const [hideEmptyTypes, setHideEmptyTypes] = useAtom(fromDeployMetadataState.hideEmptyMetadataTypesState);
  const [globalFilter, setGlobalFilter] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<any>());
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set<any>());

  const visibleRows = useMemo(() => (hideEmptyTypes ? rows.filter((row) => !isEmptyMetadataTypeRow(row)) : rows), [hideEmptyTypes, rows]);

  useEffect(() => {
    setExpandedGroupIds(new Set(rows.map(({ typeLabel }) => typeLabel)));
  }, [rows]);

  useEffect(() => {
    onSelectedRows(new Set(rows.filter((row) => selectedRowIds.has(getRowId(row)))));
  }, [onSelectedRows, rows, selectedRowIds]);

  return (
    <DataTableSelectedContext.Provider value={{ selectedRowIds, getRowKey: getRowId }}>
      <Grid align="spread" verticalAlign="end" className="slds-p-top_xx-small slds-p-bottom_x-small slds-m-horizontal_small">
        <Grid verticalAlign="center">
          <button className="slds-button slds-button_brand" disabled={!hasSelectedRows} onClick={onViewOrCompareOpen}>
            <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
            {isSingleOrgMode ? 'View Selected Items' : 'View or Compare Selected Items'}
          </button>
          <Checkbox
            id="deploy-metadata-hide-empty-types"
            className="slds-m-left_small"
            label="Hide Empty Types"
            labelHelp="Hide metadata types that have no components matching your filters."
            checked={hideEmptyTypes}
            onChange={setHideEmptyTypes}
          />
        </Grid>
        <SearchInput id="metadata-filter" placeholder="Search metadata..." onChange={setGlobalFilter} />
        <div>
          Showing {formatNumber(visibleRows.length)} of {formatNumber(rows.length)} objects
        </div>
      </Grid>
      <AutoFullHeightContainer fillHeight setHeightAttr delayForSecondTopCalc bottomBuffer={15}>
        <DataTree
          columns={columns}
          data={visibleRows}
          getRowKey={getRowId}
          includeQuickFilter
          quickFilterText={globalFilter}
          groupBy={groupedRows}
          rowGrouper={groupBy}
          expandedGroupIds={expandedGroupIds}
          onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
          selectedRows={selectedRowIds}
          onSelectedRowsChange={setSelectedRowIds}
          contextMenuItems={getDeploymentTableContextMenuItems}
          contextMenuAction={handleDeploymentTableContextMenuAction}
        />
      </AutoFullHeightContainer>
    </DataTableSelectedContext.Provider>
  );
};

export default DeployMetadataDeploymentTable;

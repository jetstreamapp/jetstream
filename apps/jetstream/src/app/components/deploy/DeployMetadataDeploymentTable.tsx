import { formatNumber } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, DataTableNew, Grid, Icon, SearchInput } from '@jetstream/ui';
import { ColumnWithFilter } from 'libs/ui/src/lib/data-table-new/data-table-types';
import { DataTableSelectedContext } from 'libs/ui/src/lib/data-table-new/data-table-utils';
import groupBy from 'lodash/groupBy';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { DeployMetadataTableRow } from './deploy-metadata.types';
import { getColumnDefinitions } from './utils/deploy-metadata.utils';

export interface DeployMetadataDeploymentTableProps {
  rows: DeployMetadataTableRow[];
  hasSelectedRows: boolean;
  onSelectedRows: (selectedRows: Set<DeployMetadataTableRow>) => void;
  onViewOrCompareOpen: () => void;
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
}) => {
  const [columns, setColumns] = useState<ColumnWithFilter<DeployMetadataTableRow>[]>([]);
  const [visibleRows, setVisibleRows] = useState<DeployMetadataTableRow[]>(rows);
  const [globalFilter, setGlobalFilter] = useState<string>(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<any>());
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set<any>());

  useEffect(() => {
    setVisibleRows(rows);
    setExpandedGroupIds(new Set(rows.map(({ typeLabel }) => typeLabel)));
  }, [rows]);

  useEffect(() => {
    setColumns(getColumnDefinitions());
  }, []);

  useEffect(() => {
    onSelectedRows(new Set(rows.filter((row) => selectedRowIds.has(getRowId(row)))));
  }, [onSelectedRows, selectedRowIds]);

  return (
    <Fragment>
      {rows && visibleRows && (
        <Grid align="spread" verticalAlign="end" className="slds-p-top_xx-small slds-p-bottom_x-small slds-m-horizontal_small">
          <Grid>
            <button className="slds-button slds-button_brand" disabled={!hasSelectedRows} onClick={onViewOrCompareOpen}>
              <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
              View or Compare Selected Items
            </button>
          </Grid>
          <SearchInput id="metadata-filter" placeholder="Search metadata..." onChange={setGlobalFilter} />
          <div>
            Showing {formatNumber(visibleRows.length)} of {formatNumber(rows.length)} objects
          </div>
        </Grid>
      )}
      <AutoFullHeightContainer fillHeight setHeightAttr delayForSecondTopCalc bottomBuffer={15}>
        {/* TODO: loading indicator on grouped rows, will require context */}
        <DataTableSelectedContext.Provider value={{ selectedRowIds, getRowKey: getRowId }}>
          <DataTableNew
            columns={columns}
            data={rows}
            getRowKey={getRowId}
            includeQuickFilter
            quickFilterText={globalFilter}
            groupBy={groupedRows}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
            selectedRows={selectedRowIds}
            onSelectedRowsChange={setSelectedRowIds}
          />
        </DataTableSelectedContext.Provider>
      </AutoFullHeightContainer>
    </Fragment>
  );
};

export default DeployMetadataDeploymentTable;

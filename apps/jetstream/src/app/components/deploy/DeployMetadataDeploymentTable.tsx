import { ColumnEvent, IFilter, IFilterParams, RowNode, SelectionChangedEvent } from '@ag-grid-community/core';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, Checkbox, DataTableNew, getFilteredRows, Grid, Icon, SearchInput } from '@jetstream/ui';
import { ColumnWithFilter } from 'libs/ui/src/lib/data-table-new/data-table-types';
import { DataTableSelectedContext } from 'libs/ui/src/lib/data-table-new/data-table-utils';
import groupBy from 'lodash/groupBy';
import { forwardRef, Fragment, FunctionComponent, useEffect, useImperativeHandle, useState } from 'react';
import { DeployMetadataTableRow } from './deploy-metadata.types';
import { getColumnDefinitions } from './utils/deploy-metadata.utils';

export interface DeployMetadataDeploymentTableProps {
  rows: DeployMetadataTableRow[];
  hasSelectedRows: boolean;
  onSelectedRows: (selectedRows: Set<DeployMetadataTableRow>) => void;
  onViewOrCompareOpen: () => void;
}

function getRowId({ key }: DeployMetadataTableRow): string {
  return key;
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
  const [selectedRows, setSelectedRow] = useState<Set<DeployMetadataTableRow>>(new Set());
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
    onSelectedRows(selectedRows);
  }, [onSelectedRows, selectedRows]);

  function handleSelectionChanged(event: SelectionChangedEvent) {
    setSelectedRow(new Set(event.api.getSelectedRows().filter((row: DeployMetadataTableRow) => row.metadata)));
  }

  // TODO: maybe move to parent?
  function handleFilterChangeOrRowDataUpdated(event: ColumnEvent) {
    setVisibleRows(getFilteredRows(event));
  }

  function handleIsRowSelectable(node: RowNode) {
    if ((node.group && node.allChildrenCount === 1 && !node.allLeafChildren[0].data?.metadata) || (!node.group && !node.data?.metadata)) {
      return false;
    }
    return true;
  }

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
        <DataTableSelectedContext.Provider value={{ selectedRowIds }}>
          <DataTableNew
            columns={columns}
            data={rows}
            getRowKey={getRowId}
            // TODO: metadataFilterItemsWithNoChildren
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

export const MetadataFilterItemsWithNoChildren = forwardRef<any, IFilterParams>(({ filterChangedCallback, colDef, context }, ref) => {
  const [value, setValue] = useState(true);

  useNonInitialEffect(() => {
    filterChangedCallback();
  }, [filterChangedCallback, value]);

  function nodeHasData(node: RowNode) {
    return node.data?.loading || node.data?.metadata;
  }

  useImperativeHandle(ref, () => {
    const filterComp: IFilter = {
      isFilterActive: () => !value,
      doesFilterPass: ({ node }) => {
        if ((node.group && node.allChildrenCount === 1 && !nodeHasData(node.allLeafChildren[0])) || (!node.group && !nodeHasData(node))) {
          return false;
        }
        return true;
      },
      getModel: () => ({ value }),
      setModel: (model) => setValue(model ? model.value : true),
    };
    return filterComp;
  });

  return (
    <div className="slds-p-around_small">
      <Checkbox id={`metadata-filter-${colDef.field}`} checked={value} label="Show metadata types with no items" onChange={setValue} />
    </div>
  );
});

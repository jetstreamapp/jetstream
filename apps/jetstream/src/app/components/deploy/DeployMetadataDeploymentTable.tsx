import {
  ColDef,
  ColumnEvent,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IFilter,
  IFilterParams,
  RowNode,
  SelectionChangedEvent,
} from '@ag-grid-community/core';
import { ListMetadataResultItem } from '@jetstream/connected-ui';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, Checkbox, DataTable, getFilteredRows, Grid, Icon, SearchInput, Spinner } from '@jetstream/ui';
import { forwardRef, Fragment, FunctionComponent, useEffect, useImperativeHandle, useState } from 'react';
import { DeployMetadataTableRow } from './deploy-metadata.types';
import { getColumnDefinitions, getRows } from './utils/deploy-metadata.utils';

export interface DeployMetadataDeploymentTableProps {
  listMetadataItems: MapOf<ListMetadataResultItem>;
  hasSelectedRows: boolean;
  onRows?: (rows: DeployMetadataTableRow[]) => void;
  onSelectedRows: (selectedRows: Set<DeployMetadataTableRow>) => void;
  onViewOrCompareOpen: () => void;
}

function getRowNodeId(data: DeployMetadataTableRow): string {
  return data.key;
}

const ValueOrLoadingRenderer: FunctionComponent<ICellRendererParams> = ({ value, node }) => {
  if (node.group) {
    return <div />;
  }
  const { loading, fullName }: DeployMetadataTableRow = node.data || {};
  if (loading) {
    return <Spinner size={'x-small'} />;
  } else if (!fullName) {
    return <em className="slds-text-color_weak">No matching components</em>;
  }
  return <div>{decodeURIComponent(value || '')}</div>;
};

export const DeployMetadataDeploymentTable: FunctionComponent<DeployMetadataDeploymentTableProps> = ({
  listMetadataItems,
  hasSelectedRows,
  onRows,
  onSelectedRows,
  onViewOrCompareOpen,
}) => {
  const [gridApi, setGridApi] = useState<GridApi>(null);
  const [columns, setColumns] = useState<ColDef[]>();
  const [rows, setRows] = useState<DeployMetadataTableRow[]>();
  const [visibleRows, setVisibleRows] = useState<DeployMetadataTableRow[]>();
  const [globalFilter, setGlobalFilter] = useState<string>(null);
  const [selectedRows, setSelectedRow] = useState<Set<DeployMetadataTableRow>>(new Set());

  useEffect(() => {
    setColumns(getColumnDefinitions());
  }, []);

  useEffect(() => {
    const currRows = getRows(listMetadataItems);
    setRows(currRows);
    setVisibleRows(currRows);
  }, [listMetadataItems]);

  useEffect(() => {
    if (onRows && rows) {
      onRows(rows);
    }
  }, [onRows, rows]);

  useEffect(() => {
    onSelectedRows(selectedRows);
  }, [onSelectedRows, selectedRows]);

  // Hack to ensure that spinners are removed for rows that do not have any child items
  useEffect(() => {
    if (gridApi) {
      const rowsToRefresh = rows
        .filter((row) => (!row.loading && !row.fullName) || row.loading)
        .map((row) => gridApi.getRowNode(row.key))
        .filter((row) => !!row);
      if (rowsToRefresh.length) {
        gridApi.refreshCells({ force: true, columns: ['fullName'], rowNodes: rowsToRefresh });
      }
    }
  }, [gridApi, rows]);

  function handleSelectionChanged(event: SelectionChangedEvent) {
    setSelectedRow(new Set(event.api.getSelectedRows().filter((row: DeployMetadataTableRow) => row.metadata)));
  }

  function handleOnGridReady({ api }: GridReadyEvent) {
    setGridApi(api);
  }

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
        <DataTable
          columns={columns}
          data={rows}
          quickFilterText={globalFilter}
          defaultMenuTabs={['filterMenuTab', 'generalMenuTab']}
          agGridProps={{
            immutableData: true,
            getRowNodeId,
            frameworkComponents: {
              valueOrLoading: ValueOrLoadingRenderer,
              metadataFilterItemsWithNoChildren: MetadataFilterItemsWithNoChildren,
            },
            autoGroupColumnDef: {
              headerName: 'Metadata Type',
              width: 200,
              cellRenderer: 'agGroupCellRenderer',
              // filter: 'agMultiColumnFilter',
              filterParams: {
                filters: [
                  { filter: 'metadataFilterItemsWithNoChildren' },
                  { filter: 'agTextColumnFilter' },
                  { filter: 'agSetColumnFilter' },
                ],
              },
              menuTabs: ['filterMenuTab'],
              filterValueGetter: ({ data }) => data.typeLabel,
              sortable: true,
              resizable: true,
              sort: 'asc',
            },
            showOpenedGroup: true,
            groupDefaultExpanded: 1,
            groupSelectsChildren: true,
            groupSelectsFiltered: true,
            sideBar: {
              toolPanels: [
                {
                  id: 'filters',
                  labelDefault: 'Filters',
                  labelKey: 'filters',
                  iconKey: 'filter',
                  toolPanel: 'agFiltersToolPanel',
                },
                {
                  id: 'columns',
                  labelDefault: 'Columns',
                  labelKey: 'columns',
                  iconKey: 'columns',
                  toolPanel: 'agColumnsToolPanel',
                  toolPanelParams: {
                    suppressRowGroups: true,
                    suppressValues: true,
                    suppressPivots: true,
                    suppressPivotMode: true,
                  },
                },
              ],
            },
            isRowSelectable: handleIsRowSelectable,
            onGridReady: handleOnGridReady,
            onSelectionChanged: handleSelectionChanged,
            onFilterChanged: handleFilterChangeOrRowDataUpdated,
          }}
        />
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

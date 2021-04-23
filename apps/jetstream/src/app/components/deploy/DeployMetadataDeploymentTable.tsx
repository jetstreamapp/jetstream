/** @jsx jsx */
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { ListMetadataResultItem } from '@jetstream/connected-ui';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { DeployMetadataTableRow } from './deploy-metadata.types';
import { getColumnDefinitions, getRows } from './utils/deploy-metadata.utils';

export interface DeployMetadataDeploymentTableProps {
  listMetadataItems: MapOf<ListMetadataResultItem>;
  onRows?: (rows: DeployMetadataTableRow[]) => void;
  onSelectedRows: (selectedRows: Set<DeployMetadataTableRow>) => void;
}

function getRowNodeId({ key }: DeployMetadataTableRow): string {
  return key;
}

const ValueOrLoadingRenderer: FunctionComponent<ICellRendererParams> = ({ value, node }) => {
  const { loading, fullName }: DeployMetadataTableRow = node.data;
  if (loading) {
    return <Spinner size={'x-small'} />;
  } else if (!fullName) {
    return <em className="slds-text-color_weak">No matching components</em>;
  }
  return <div>{decodeURIComponent(value || '')}</div>;
};

export const DeployMetadataDeploymentTable: FunctionComponent<DeployMetadataDeploymentTableProps> = ({
  listMetadataItems,
  onRows,
  onSelectedRows,
}) => {
  const [gridApi, setGridApi] = useState<GridApi>(null);
  const [columns, setColumns] = useState<ColDef[]>();
  const [rows, setRows] = useState<DeployMetadataTableRow[]>();
  const [globalFilter, setGlobalFilter] = useState<string>(null);
  const [selectedRows, setSelectedRow] = useState<Set<DeployMetadataTableRow>>(new Set());

  useEffect(() => {
    setColumns(getColumnDefinitions());
  }, []);

  useEffect(() => {
    setRows(getRows(listMetadataItems));
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
      const rowsToRefresh = rows.filter((row) => !row.loading && !row.fullName).map((row) => gridApi.getRowNode(row.key));
      if (rowsToRefresh.length) {
        gridApi.refreshCells({ force: true, columns: ['fullName'], rowNodes: rowsToRefresh });
      }
      gridApi.forEachNode((row) => {
        if (!row.data.metadata) {
          row.selectable = false;
        }
      });
    }
  }, [gridApi, rows]);

  function handleSelectionChanged(event: SelectionChangedEvent) {
    setSelectedRow(new Set(event.api.getSelectedRows().filter((row: DeployMetadataTableRow) => row.metadata)));
  }

  function handleOnGridReady({ api }: GridReadyEvent) {
    setGridApi(api);
  }

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
      <DataTable
        columns={columns}
        data={rows}
        quickFilterText={globalFilter}
        agGridProps={{
          immutableData: true,
          getRowNodeId,
          suppressMenuHide: true,
          suppressRowClickSelection: true,
          headerHeight: 25,
          frameworkComponents: {
            valueOrLoading: ValueOrLoadingRenderer,
          },
          gridOptions: {
            defaultColDef: {
              filter: true,
              sortable: true,
              resizable: true,
            },
          },
          onGridReady: handleOnGridReady,
          onSelectionChanged: handleSelectionChanged,
        }}
      />
    </AutoFullHeightContainer>
  );
};

export default DeployMetadataDeploymentTable;

import { ColDef, GetRowIdParams, ICellRendererParams, SelectionChangedEvent } from '@ag-grid-community/core';
import { css } from '@emotion/react';
import { ApexLog, ApexLogWithViewed } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  DataTable,
  dataTableDateFormatter,
  dataTableFileSizeFormatter,
  DateFilterComparator,
  Icon,
} from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef } from 'react';

export const LogViewedRenderer: FunctionComponent<ICellRendererParams> = ({ node }) => {
  if (node.data?.viewed) {
    return (
      <Icon
        css={css`
          margin-left: -7px;
        `}
        type="utility"
        icon="preview"
        className="slds-icon slds-icon-text-default slds-icon_xx-small"
        title="You have previously viewed this log"
        description="This log has been viewed"
      />
    );
  }
  return null;
};

const COLUMNS: ColDef[] = [
  {
    headerName: '',
    colId: 'viewed',
    field: 'viewed',
    width: 24,
    cellRenderer: 'logViewedRenderer',
    lockPosition: true,
    lockVisible: true,
  },
  {
    headerName: 'User',
    colId: 'user',
    field: 'LogUser.Name',
    width: 125,
  },
  {
    headerName: 'Application',
    colId: 'Application',
    field: 'Application',
    width: 125,
  },
  {
    headerName: 'Operation',
    colId: 'Operation',
    field: 'Operation',
    width: 125,
  },
  {
    headerName: 'Status',
    colId: 'Status',
    field: 'Status',
    width: 125,
  },
  {
    headerName: 'Size',
    colId: 'Size',
    field: 'LogLength',
    width: 125,
    valueFormatter: dataTableFileSizeFormatter,
  },
  {
    headerName: 'Time',
    colId: 'LastModifiedDate',
    field: 'LastModifiedDate',
    sort: 'desc',
    width: 202,
    valueFormatter: dataTableDateFormatter,
    getQuickFilterText: dataTableDateFormatter,
    filter: 'agDateColumnFilter',
    filterParams: {
      defaultOption: 'greaterThan',
      comparator: DateFilterComparator,
      buttons: ['clear'],
    },
  },
];

function getRowId({ data }: GetRowIdParams): string {
  return data.Id;
}

export interface DebugLogViewerTableProps {
  logs: ApexLogWithViewed[];
  onRowSelection: (log: ApexLog) => void;
}

export const DebugLogViewerTable: FunctionComponent<DebugLogViewerTableProps> = ({ logs, onRowSelection }) => {
  const isMounted = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleSelectionChanged(event: SelectionChangedEvent) {
    const selectedRow: ApexLog = event.api.getSelectedRows()[0];
    if (selectedRow) {
      onRowSelection(selectedRow);
    }
  }

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={75}>
      <DataTable
        columns={COLUMNS}
        data={logs}
        agGridProps={{
          getRowId,
          enableRangeSelection: false,
          suppressCellFocus: true,
          suppressRowClickSelection: false,
          components: { logViewedRenderer: LogViewedRenderer },
          rowSelection: 'single',
          onSelectionChanged: handleSelectionChanged,
        }}
      />
    </AutoFullHeightContainer>
  );
};

export default DebugLogViewerTable;

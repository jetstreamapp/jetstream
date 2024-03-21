import { css } from '@emotion/react';
import { ApexLogWithViewed } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, Icon, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef } from 'react';
import { CellClickArgs, RenderCellProps } from 'react-data-grid';

export const LogViewedRenderer: FunctionComponent<RenderCellProps<ApexLogWithViewed>> = ({ row }) => {
  if (row?.viewed) {
    return (
      <Icon
        css={css`
          margin-left: 8px;
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

const INITIAL_SORT = [{ columnKey: 'LastModifiedDate', direction: 'DESC' } as const];

const COLUMNS: ColumnWithFilter<ApexLogWithViewed>[] = [
  {
    name: '',
    key: 'viewed',
    width: 12,
    renderCell: LogViewedRenderer,
    resizable: false,
  },
  {
    ...setColumnFromType('LogUser.Name', 'text'),
    name: 'User',
    key: 'LogUser.Name',
    width: 125,
    draggable: true,
  },
  {
    ...setColumnFromType('Application', 'text'),
    name: 'Application',
    key: 'Application',
    width: 125,
    draggable: true,
  },
  {
    ...setColumnFromType('Operation', 'text'),
    name: 'Operation',
    key: 'Operation',
    width: 125,
    draggable: true,
  },
  {
    ...setColumnFromType('Status', 'text'),
    name: 'Status',
    key: 'Status',
    width: 125,
    draggable: true,
  },
  {
    ...setColumnFromType('LogLength', 'text'),
    name: 'Size',
    key: 'LogLength',
    width: 125,
    draggable: true,
  },
  {
    ...setColumnFromType('LastModifiedDate', 'date'),
    name: 'Time',
    key: 'LastModifiedDate',
    width: 202,
    draggable: true,
  },
];

function getRowId({ Id }: ApexLogWithViewed): string {
  return Id;
}

export interface DebugLogViewerTableProps {
  logs: ApexLogWithViewed[];
  onRowSelection: (log: ApexLogWithViewed) => void;
}

export const DebugLogViewerTable: FunctionComponent<DebugLogViewerTableProps> = ({ logs, onRowSelection }) => {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleSelectionChanged({ row }: CellClickArgs<ApexLogWithViewed>) {
    if (row) {
      onRowSelection(row);
    }
  }

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={75}>
      <DataTable
        columns={COLUMNS}
        data={logs}
        getRowKey={getRowId}
        initialSortColumns={INITIAL_SORT}
        onCellClick={handleSelectionChanged}
      />
    </AutoFullHeightContainer>
  );
};

export default DebugLogViewerTable;

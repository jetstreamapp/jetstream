import { css } from '@emotion/react';
import { ApexLogWithViewed, ContextMenuItem } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  CellMouseArgs,
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  DataTable,
  Icon,
  RenderCellProps,
  RowWithKey,
  TABLE_CONTEXT_MENU_ITEMS,
  copyGenericTableDataToClipboard,
  setColumnFromType,
} from '@jetstream/ui';
import { FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';

export const LogViewedRenderer = ({ row }: RenderCellProps<ApexLogWithViewed>): ReactNode => {
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
    sortable: false,
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

const FIELDS = COLUMNS.filter((col) => col.key !== 'viewed').map((col) => col.key);

function getRowId({ Id }: ApexLogWithViewed): string {
  return Id;
}

export interface DebugLogViewerTableProps {
  logs: ApexLogWithViewed[];
  /** Id of the log currently shown in the results pane — its row is highlighted. */
  activeLogId?: string | null;
  onRowSelection: (log: ApexLogWithViewed) => void;
}

export const DebugLogViewerTable: FunctionComponent<DebugLogViewerTableProps> = ({ logs, activeLogId, onRowSelection }) => {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleSelectionChanged({ row }: CellMouseArgs<ApexLogWithViewed>) {
    if (row) {
      onRowSelection(row);
    }
  }

  const handleContextMenuAction = useCallback((item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
    copyGenericTableDataToClipboard(item.value, FIELDS, data);
  }, []);

  // Highlight the row whose log is currently displayed in the results pane.
  const rowClass = useCallback(
    (row: ApexLogWithViewed) => (activeLogId && row.Id === activeLogId ? 'jgrid-row-selected' : undefined),
    [activeLogId],
  );

  // The new DataTable has no `onCellClick`. Preserve the legacy "click a row to mark its log viewed"
  // behavior by wrapping each column's rendered cell content in a click handler. `role="button"` (with
  // tabIndex=-1 so it stays out of the page tab order) lets the grid's keyboard activation — Enter/Space
  // on the cell — trigger the same handler as a click.
  const columns = useMemo<ColumnWithFilter<ApexLogWithViewed>[]>(
    () =>
      COLUMNS.map((column) => {
        const renderCell = column.renderCell;
        return {
          ...column,
          renderCell: (props: RenderCellProps<ApexLogWithViewed>) => (
            <div
              role="button"
              tabIndex={-1}
              css={css`
                width: 100%;
                height: 100%;
              `}
              onClick={() => handleSelectionChanged({ row: props.row, column: props.column, rowIdx: props.rowIdx })}
            >
              {renderCell ? renderCell(props) : props.value === null || props.value === undefined ? '' : String(props.value)}
            </div>
          ),
        };
      }),
    // `onRowSelection` is stable for this component; columns only need to be built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={75}>
      <DataTable
        columns={columns}
        data={logs}
        getRowKey={getRowId}
        rowClass={rowClass}
        initialSortColumns={INITIAL_SORT}
        defaultColumnOptions={{ sortable: true }}
        contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
        contextMenuAction={handleContextMenuAction}
      />
    </AutoFullHeightContainer>
  );
};

export default DebugLogViewerTable;

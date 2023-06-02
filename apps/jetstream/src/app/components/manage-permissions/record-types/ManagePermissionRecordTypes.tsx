import { AutoFullHeightContainer, ColumnWithFilter, DataTable } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { forwardRef, useCallback, useState } from 'react';
import { RowHeightArgs, RowsChangeData } from 'react-data-grid';
import { PermissionManagerRecordTypeRow, PermissionTableSummaryRow } from '../utils/permission-manager-types';

const getRowKey = ({ key }: PermissionManagerRecordTypeRow) => key;
function getRowHeight({ type, row }: RowHeightArgs<PermissionManagerRecordTypeRow>) {
  if (type === 'ROW') {
    return 40;
  }
  return 34;
}
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }];
const groupedRows = ['sobject'] as const;

export interface ManagePermissionRecordTypesProps {
  columns: ColumnWithFilter<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>[];
  rows: PermissionManagerRecordTypeRow[];
  loading: boolean; // TODO: do I need this?
  hasError?: boolean;
  onBulkUpdate: (
    rows: PermissionManagerRecordTypeRow[],
    changeData: RowsChangeData<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>
  ) => void;
}

export const ManagePermissionRecordTypes = forwardRef<any, ManagePermissionRecordTypesProps>(
  ({ columns, rows, loading, hasError, onBulkUpdate }, ref) => {
    const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<unknown>(rows.map((row) => row.sobject)));

    const handleRowsChange = useCallback(
      (rows: PermissionManagerRecordTypeRow[], changeData: RowsChangeData<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>) => {
        onBulkUpdate(rows, changeData);
      },
      [onBulkUpdate]
    );

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            // context={
            //   {
            //     type: 'field',
            //     totalCount,
            //     onFilterRows: onFilter,
            //     onColumnAction: handleColumnAction,
            //     onBulkAction: onBulkUpdate,
            //   } as PermissionManagerTableContext
            // }
            rowHeight={getRowHeight}
            summaryRowHeight={38}
            groupBy={groupedRows}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionRecordTypes;

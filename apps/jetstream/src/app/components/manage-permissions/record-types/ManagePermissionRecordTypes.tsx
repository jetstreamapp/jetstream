import { logger } from '@jetstream/shared/client-logger';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { RowHeightArgs } from 'react-data-grid';
import { RecordTypeData } from '../usePermissionRecordTypes';
import { getTableDataForRecordTypes } from '../utils/permission-manager-table-utils';
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
  recordTypeData: RecordTypeData;
  loading: boolean; // TODO: do I need this?
  hasError?: boolean;
}

// FIXME: we need to add in permission sets, which only allow assigning of record types, but nothing else
export const ManagePermissionRecordTypes = forwardRef<any, ManagePermissionRecordTypesProps>(
  ({ recordTypeData, loading, hasError }, ref) => {
    // TODO: this should be moved to parent / store so that dirty tracking and deploy etc.. can happen
    const [rows, setRows] = useState<PermissionManagerRecordTypeRow[]>([]);
    const [columns, setColumns] = useState<ColumnWithFilter<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>[]>([]);
    const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<unknown>(rows.map((row) => row.sobject)));

    useEffect(() => {
      const { columns, objectsWithRecordTypes, rows } = getTableDataForRecordTypes(recordTypeData);
      setExpandedGroupIds(new Set<unknown>(rows.map((row) => row.sobject)));
      setRows(rows);
      setColumns(columns);
      logger.info('[ManagePermissionRecordTypes]', { objectsWithRecordTypes, rows, columns });
    }, [recordTypeData]);

    const handleRowsChange = useCallback((rows: PermissionManagerRecordTypeRow[], { indexes }) => {
      // FIXME: this needs to go to parent
      // TODO: the default is a toogle that should modify all items with same sobject to opposite value
      // cannot be deselected either
      setRows(rows);
      logger.info('[ManagePermissionRecordTypes] handleRowsChange', { rows, indexes });
    }, []);

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

// function getTable

// function getColumnsForProfile(profile: string): ColumnWithFilter<Row, any>[] {
//   return [
//     {
//       name: `${profile} (Profile)`,
//       key: `${profile}-record-type`,
//       width: 100, // TODO:
//       filters: ['TEXT', 'SET'],
//       // cellClass: (row) => {
//       //   const permission = row.permissions[id];
//       //   if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
//       //     return 'active-item-yellow-bg';
//       //   }
//       //   return '';
//       // },
//       colSpan: (args) => (args.type === 'HEADER' ? 4 : undefined),
//       formatter: ({ column, isCellSelected, row, onRowChange }) => {
//         return row.permissions[profile].recordType;
//       },
//       getValue: ({ column, row }) => row.permissions[profile].recordType,
//       summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
//       summaryFormatter: (args) => {
//         if (args.row.type === 'HEADING') {
//           return <SummaryFilterRenderer columnKey={`${profile}-record-type`} label="Record Type" />;
//         }
//         return undefined;
//       },
//     },
//     {
//       name: `${profile} (Profile)`,
//       key: `${profile}-layout-assignment`,
//       width: 100, // TODO:
//       filters: ['TEXT', 'SET'],
//       // cellClass: (row) => {
//       //   const permission = row.permissions[id];
//       //   if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
//       //     return 'active-item-yellow-bg';
//       //   }
//       //   return '';
//       // },
//       formatter: ({ column, isCellSelected, row, onRowChange }) => {
//         return row.permissions[profile].layoutLabel;
//       },
//       getValue: ({ column, row }) => row.permissions[profile].layoutLabel,
//       summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
//       summaryFormatter: (args) => {
//         if (args.row.type === 'HEADING') {
//           return <SummaryFilterRenderer columnKey={`${profile}-layout-assignment`} label="Record Type" />;
//         }
//         return undefined;
//       },
//     },
//     {
//       name: `${profile} (Profile)`,
//       key: `${profile}-assigned-record-type`,
//       width: 100, // TODO:
//       filters: ['BOOLEAN_SET'],
//       // cellClass: (row) => {
//       //   const permission = row.permissions[id];
//       //   if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
//       //     return 'active-item-yellow-bg';
//       //   }
//       //   return '';
//       // },
//       formatter: ({ column, isCellSelected, row, onRowChange }) => {
//         return row.permissions[profile].visible;
//       },
//       getValue: ({ column, row }) => (row.permissions[profile].visible ? 'true' : 'false'),
//       summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
//       summaryFormatter: (args) => {
//         if (args.row.type === 'HEADING') {
//           return <SummaryFilterRenderer columnKey={`${profile}-assigned-record-type`} label="Record Type" />;
//         }
//         return undefined;
//       },
//     },
//     {
//       name: `${profile} (Profile)`,
//       key: `${profile}-default-record-type`,
//       width: 100, // TODO:
//       filters: ['BOOLEAN_SET'], // TODO:
//       // cellClass: (row) => {
//       //   const permission = row.permissions[id];
//       //   if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
//       //     return 'active-item-yellow-bg';
//       //   }
//       //   return '';
//       // },
//       formatter: ({ column, isCellSelected, row, onRowChange }) => {
//         return row.permissions[profile].default;
//       },
//       getValue: ({ column, row }) => (row.permissions[profile].default ? 'true' : 'false'),
//       summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
//       summaryFormatter: (args) => {
//         if (args.row.type === 'HEADING') {
//           return <SummaryFilterRenderer columnKey={`${profile}-default-record-type`} label="Record Type" />;
//         }
//         return undefined;
//       },
//     },
//   ];
// }

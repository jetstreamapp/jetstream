import { css } from '@emotion/react';
import type { ApexTestRunResultRecord } from '@jetstream/types';
import { AutoFullHeightContainer, Badge, ColumnWithFilter, DataTable, RenderCellProps, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo } from 'react';
import { formatTestTime, getRunStatusBadgeType } from './test-run-utils';

type TestRunRow = ApexTestRunResultRecord & { 'User.Name': string | null; progress: string };

const StatusRenderer = ({ row }: RenderCellProps<TestRunRow>) => <Badge type={getRunStatusBadgeType(row.Status)}>{row.Status}</Badge>;

const COLUMNS: ColumnWithFilter<TestRunRow>[] = [
  {
    ...setColumnFromType('Status', 'text'),
    name: 'Status',
    key: 'Status',
    width: 120,
    renderCell: StatusRenderer,
  },
  {
    ...setColumnFromType('progress', 'text'),
    name: 'Methods Run',
    key: 'progress',
    width: 120,
  },
  {
    ...setColumnFromType('MethodsFailed', 'number'),
    name: 'Failures',
    key: 'MethodsFailed',
    width: 100,
  },
  {
    ...setColumnFromType('User.Name', 'text'),
    name: 'Started By',
    key: 'User.Name',
    width: 160,
  },
  {
    ...setColumnFromType('CreatedDate', 'date'),
    name: 'Started',
    key: 'CreatedDate',
    width: 200,
  },
  {
    ...setColumnFromType('TestTime', 'text'),
    name: 'Test Time',
    key: 'TestTime',
    width: 100,
    renderCell: ({ row }: RenderCellProps<TestRunRow>) => <span>{formatTestTime(row.TestTime)}</span>,
  },
];

function getRowId({ Id }: TestRunRow): string {
  return Id;
}

export interface TestRunsTableProps {
  runs: ApexTestRunResultRecord[];
  selectedRunId?: string | null;
  /** Cap the table height when detail content is displayed below it */
  maxHeight?: string;
  onRowSelection: (run: ApexTestRunResultRecord) => void;
}

export const TestRunsTable: FunctionComponent<TestRunsTableProps> = ({ runs, selectedRunId, maxHeight, onRowSelection }) => {
  const rows = useMemo<TestRunRow[]>(
    () =>
      runs.map((run) => ({
        ...run,
        'User.Name': run.User?.Name ?? null,
        progress: run.MethodsEnqueued === null ? '' : `${(run.MethodsCompleted ?? 0) + (run.MethodsFailed ?? 0)} / ${run.MethodsEnqueued}`,
      })),
    [runs],
  );

  const rowClass = useCallback(
    (row: TestRunRow) => (selectedRunId && row.Id === selectedRunId ? 'jgrid-row-selected' : undefined),
    [selectedRunId],
  );

  // The DataTable has no row-click event, so each cell's content is wrapped in a click handler
  const columns = useMemo<ColumnWithFilter<TestRunRow>[]>(
    () =>
      COLUMNS.map((column) => {
        const renderCell = column.renderCell;
        return {
          ...column,
          renderCell: (props: RenderCellProps<TestRunRow>) => (
            <div
              role="button"
              tabIndex={-1}
              css={css`
                width: 100%;
                height: 100%;
              `}
              onClick={() => onRowSelection(props.row)}
            >
              {renderCell ? renderCell(props) : props.value === null || props.value === undefined ? '' : String(props.value)}
            </div>
          ),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} maxHeight={maxHeight} recalculateKey={maxHeight}>
      <DataTable columns={columns} data={rows} getRowKey={getRowId} rowClass={rowClass} defaultColumnOptions={{ sortable: true }} />
    </AutoFullHeightContainer>
  );
};

export default TestRunsTable;

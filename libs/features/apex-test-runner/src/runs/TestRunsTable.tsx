import { css } from '@emotion/react';
import type { ApexTestRunResultRecord } from '@jetstream/types';
import { AutoFullHeightContainer, Badge, ColumnWithFilter, DataTable, RenderCellProps, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo } from 'react';
import { BADGE_ROW_HEIGHT, formatTestTime, getRunStatusBadgeType } from './test-run-utils';

type TestRunRow = ApexTestRunResultRecord & { 'User.Name': string | null; progress: string; testRunId: string };

const StatusRenderer = ({ row }: RenderCellProps<TestRunRow>) => <Badge type={getRunStatusBadgeType(row.Status)}>{row.Status}</Badge>;

const FailuresRenderer = ({ row }: RenderCellProps<TestRunRow>) => {
  if (row.MethodsFailed === null) {
    return null;
  }
  return <span className={row.MethodsFailed > 0 ? 'slds-text-color_error' : 'slds-text-color_success'}>{row.MethodsFailed}</span>;
};

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
    name: 'Tests Run',
    key: 'progress',
    width: 120,
  },
  {
    ...setColumnFromType('testRunId', 'text'),
    name: 'Test Run Id',
    key: 'testRunId',
    width: 160,
  },
  {
    ...setColumnFromType('MethodsFailed', 'number'),
    name: 'Failures',
    key: 'MethodsFailed',
    width: 100,
    renderCell: FailuresRenderer,
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
    width: 120,
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
        // MethodsCompleted includes failed methods, so no need to add MethodsFailed
        progress: run.MethodsEnqueued === null ? '' : `${run.MethodsCompleted ?? 0} / ${run.MethodsEnqueued}`,
        // 15-character form to match what the Developer Console displays
        testRunId: run.Id.startsWith('optimistic-') ? '' : run.AsyncApexJobId.slice(0, 15),
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
                /* The full-height click target defeats the cell's own flex centering — restore it
                   so the Status badge (and text) sit centered in the row */
                display: flex;
                align-items: center;
              `}
              onClick={() => onRowSelection(props.row)}
            >
              {renderCell ? renderCell(props) : props.value === null || props.value === undefined ? '' : String(props.value)}
            </div>
          ),
        };
      }),
    [onRowSelection],
  );

  return (
    // fillHeight sets a viewport-based min-height which beats max-height in CSS, so it must be off when the table is capped
    <AutoFullHeightContainer fillHeight={!maxHeight} setHeightAttr bottomBuffer={25} maxHeight={maxHeight} recalculateKey={maxHeight}>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={getRowId}
        rowClass={rowClass}
        rowHeight={BADGE_ROW_HEIGHT}
        defaultColumnOptions={{ sortable: true }}
      />
    </AutoFullHeightContainer>
  );
};

export default TestRunsTable;

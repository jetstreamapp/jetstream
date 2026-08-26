import { css } from '@emotion/react';
import type { ApexTestResultRecord } from '@jetstream/types';
import { AutoFullHeightContainer, Badge, ColumnWithFilter, DataTable, RenderCellProps, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { formatTestTime, getOutcomeBadgeType } from './test-run-utils';

type TestResultRow = ApexTestResultRecord & { 'ApexClass.Name': string | null };

const OutcomeRenderer = ({ row }: RenderCellProps<TestResultRow>) => <Badge type={getOutcomeBadgeType(row.Outcome)}>{row.Outcome}</Badge>;

const COLUMNS: ColumnWithFilter<TestResultRow>[] = [
  {
    ...setColumnFromType('Outcome', 'text'),
    name: 'Outcome',
    key: 'Outcome',
    width: 120,
    renderCell: OutcomeRenderer,
  },
  {
    ...setColumnFromType('ApexClass.Name', 'text'),
    name: 'Class',
    key: 'ApexClass.Name',
    width: 220,
  },
  {
    ...setColumnFromType('MethodName', 'text'),
    name: 'Method',
    key: 'MethodName',
    width: 220,
  },
  {
    ...setColumnFromType('RunTime', 'text'),
    name: 'Run Time',
    key: 'RunTime',
    width: 100,
    renderCell: ({ row }: RenderCellProps<TestResultRow>) => <span>{formatTestTime(row.RunTime)}</span>,
  },
  {
    ...setColumnFromType('Message', 'text'),
    name: 'Message',
    key: 'Message',
    minWidth: 300,
  },
];

function getRowId({ Id }: TestResultRow): string {
  return Id;
}

export interface TestRunResultsTableProps {
  testResults: ApexTestResultRecord[];
  onRowSelection: (result: ApexTestResultRecord) => void;
}

export const TestRunResultsTable: FunctionComponent<TestRunResultsTableProps> = ({ testResults, onRowSelection }) => {
  const rows = useMemo<TestResultRow[]>(
    () => testResults.map((result) => ({ ...result, 'ApexClass.Name': result.ApexClass?.Name ?? null })),
    [testResults],
  );

  const columns = useMemo<ColumnWithFilter<TestResultRow>[]>(
    () =>
      COLUMNS.map((column) => {
        const renderCell = column.renderCell;
        return {
          ...column,
          renderCell: (props: RenderCellProps<TestResultRow>) => (
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
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
      <DataTable columns={columns} data={rows} getRowKey={getRowId} defaultColumnOptions={{ sortable: true }} />
    </AutoFullHeightContainer>
  );
};

export default TestRunResultsTable;

import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import type { ApexTestResultRecord } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  ColumnWithFilter,
  DataTree,
  ExpandCollapseButton,
  getWrappedTextRowHeight,
  Icon,
  RenderCellProps,
  RenderGroupCellProps,
  setColumnFromType,
} from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { BADGE_ROW_HEIGHT, formatTestTime, getOutcomeBadgeType } from './test-run-utils';

type TestResultRow = ApexTestResultRecord & { 'ApexClass.Name': string };

const MESSAGE_COLUMN_WIDTH = 500;
const FAILURE_OUTCOMES = new Set(['Fail', 'CompileFail']);

const OutcomeRenderer = ({ row }: RenderCellProps<TestResultRow>) => <Badge type={getOutcomeBadgeType(row.Outcome)}>{row.Outcome}</Badge>;

/** Class-level rollup — a single failed method fails the class */
const GroupOutcomeRenderer = ({ childRows }: RenderGroupCellProps<TestResultRow>) => {
  const hasFailure = childRows.some(({ Outcome }) => FAILURE_OUTCOMES.has(Outcome));
  return <Badge type={hasFailure ? 'error' : 'success'}>{hasFailure ? 'Fail' : 'Pass'}</Badge>;
};

/** Group header owns the toggle, the class name, and the per-class counts */
const GroupClassRenderer = ({ groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<TestResultRow>) => {
  const failureCount = childRows.filter(({ Outcome }) => FAILURE_OUTCOMES.has(Outcome)).length;
  return (
    <button
      type="button"
      className="jgrid-group-toggle slds-button_reset slds-grid slds-grid_vertical-align-center"
      onClick={toggleGroup}
      tabIndex={-1}
    >
      <Icon
        type="utility"
        icon={isExpanded ? 'chevrondown' : 'chevronright'}
        className="slds-icon slds-icon-text-default slds-icon_x-small slds-m-right_xx-small"
      />
      <span className="jgrid-group-toggle-label">{String(groupKey ?? '')}</span>
      <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">
        {formatNumber(childRows.length)} {pluralizeFromNumber('test', childRows.length)}
        {failureCount > 0 ? ` · ${formatNumber(failureCount)} failed` : ''}
      </span>
    </button>
  );
};

const MessageRenderer = ({ row }: RenderCellProps<TestResultRow>) => {
  if (!row.Message) {
    return null;
  }
  return (
    <div
      title={row.Message}
      css={css`
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: normal;
        overflow: hidden;
      `}
    >
      {row.Message}
    </div>
  );
};

const LogIndicatorRenderer = ({ row }: RenderCellProps<TestResultRow>) => {
  if (!row.ApexLogId) {
    return null;
  }
  return (
    <Icon
      type="utility"
      icon="file"
      className="slds-icon slds-icon-text-default slds-icon_xx-small"
      title="Debug log captured — click to view"
      description="Debug log available"
    />
  );
};

const COLUMNS: ColumnWithFilter<TestResultRow>[] = [
  {
    ...setColumnFromType('Outcome', 'text'),
    name: 'Outcome',
    key: 'Outcome',
    width: 120,
    renderCell: OutcomeRenderer,
    renderGroupCell: GroupOutcomeRenderer,
  },
  {
    name: '',
    key: 'hasLog',
    width: 40,
    resizable: false,
    sortable: false,
    renderCell: LogIndicatorRenderer,
  },
  {
    ...setColumnFromType('ApexClass.Name', 'text'),
    name: 'Class',
    key: 'ApexClass.Name',
    width: 260,
    renderGroupCell: GroupClassRenderer,
    // The group label reads as a sentence, so let it run across the columns to the right of it
    colSpan: (args) => (args.type === 'GROUP' ? Number.MAX_SAFE_INTEGER : undefined),
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
    width: 110,
    renderCell: ({ row }: RenderCellProps<TestResultRow>) => <span>{formatTestTime(row.RunTime)}</span>,
  },
  {
    ...setColumnFromType('Message', 'text'),
    name: 'Message',
    key: 'Message',
    width: MESSAGE_COLUMN_WIDTH,
    minWidth: 300,
    renderCell: MessageRenderer,
  },
];

function getRowId({ Id }: TestResultRow): string {
  return Id;
}

// Grow rows to fit their wrapped failure message, tracking the live width of the Message column on
// resize. Every row (group Pass/Fail rollups included) carries an outcome Badge, so the floor is the
// badge-friendly height rather than the grid default.
const getRowHeight = ({ type, row, columnWidths }: { type: 'ROW' | 'GROUP'; row: TestResultRow; columnWidths: Record<string, number> }) =>
  type === 'GROUP'
    ? BADGE_ROW_HEIGHT
    : getWrappedTextRowHeight(row.Message, columnWidths?.['Message'] ?? MESSAGE_COLUMN_WIDTH, BADGE_ROW_HEIGHT);

export interface TestRunResultsTableProps {
  testResults: ApexTestResultRecord[];
  onRowSelection: (result: ApexTestResultRecord) => void;
}

export const TestRunResultsTable: FunctionComponent<TestRunResultsTableProps> = ({ testResults, onRowSelection }) => {
  const rows = useMemo<TestResultRow[]>(
    () => testResults.map((result) => ({ ...result, 'ApexClass.Name': result.ApexClass?.Name ?? result.ApexClassId })),
    [testResults],
  );

  const allGroupIds = useMemo(() => Array.from(new Set(rows.map((row) => row['ApexClass.Name']))), [rows]);
  // Groups are expanded by default — collapsed ids are tracked so new classes arriving mid-poll show expanded
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<unknown>>(() => new Set());
  const expandedGroupIds = useMemo(
    () => new Set<unknown>(allGroupIds.filter((groupId) => !collapsedGroupIds.has(groupId))),
    [allGroupIds, collapsedGroupIds],
  );
  const handleExpandedGroupIdsChange = useCallback(
    (expanded: Set<unknown>) => setCollapsedGroupIds(new Set<unknown>(allGroupIds.filter((groupId) => !expanded.has(groupId)))),
    [allGroupIds],
  );
  const toggleAllGroups = useCallback(
    (expand: boolean) => setCollapsedGroupIds(expand ? new Set() : new Set<unknown>(allGroupIds)),
    [allGroupIds],
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
                /* The full-height click target defeats the cell's own flex centering — restore it
                   so the Outcome badge (and text) sit centered in the row */
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
    <div>
      <ExpandCollapseButton isExpanded={expandedGroupIds.size > 0} onToggle={toggleAllGroups} />
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
        <DataTree
          columns={columns}
          data={rows}
          getRowKey={getRowId}
          groupBy={['ApexClass.Name']}
          expandedGroupIds={expandedGroupIds}
          onExpandedGroupIdsChange={handleExpandedGroupIdsChange}
          rowHeight={getRowHeight}
          defaultColumnOptions={{ sortable: true }}
        />
      </AutoFullHeightContainer>
    </div>
  );
};

export default TestRunResultsTable;

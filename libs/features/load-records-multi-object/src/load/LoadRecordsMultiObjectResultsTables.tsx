import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi, UiTabSection } from '@jetstream/types';
import type { ColumnWithFilter, RenderCellProps, RenderGroupCellProps, RowWithKey } from '@jetstream/ui';
import {
  AutoFullHeightContainer,
  Checkbox,
  DataTree,
  ExpandCollapseButton,
  Grid,
  Icon,
  Spinner,
  Tabs,
  getRecordErrorColumn,
  getRecordErrorRowHeight,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, ReactNode, useMemo, useState } from 'react';
import { MIN_GRID_HEIGHT } from '../load-records-multi-object-constants';
import useExpandedGroups from '../useExpandedGroups';
import { RecordResultRow, getGroupSuccess } from './load-results-utils';

const ALL_TAB_ID = '__all__';

export interface LoadRecordsMultiObjectResultsTablesProps {
  rows: RecordResultRow[];
  hasMultipleRuns: boolean;
  /** Shows a spinner (instead of a neutral dash) on rows that have not been processed yet */
  isRunning: boolean;
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
}

function StatusIndicator({ success, isRunning, label }: { success: boolean | null; isRunning: boolean; label: string }) {
  let content: ReactNode;
  if (success === true) {
    content = (
      <Icon
        type="utility"
        icon="success"
        className="slds-icon slds-icon_x-small slds-icon-text-success"
        title={`${label} loaded successfully`}
        description={`${label} loaded successfully`}
      />
    );
  } else if (success === false) {
    content = (
      <Icon
        type="utility"
        icon="error"
        className="slds-icon slds-icon_x-small slds-icon-text-error"
        title={`${label} failed`}
        description={`${label} failed`}
      />
    );
  } else if (isRunning) {
    content = <Spinner size="x-small" inline />;
  } else {
    content = (
      <span className="slds-text-color_weak" title="Not loaded yet">
        Pending
      </span>
    );
  }
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      `}
    >
      {content}
    </div>
  );
}

function SuccessRenderer({ row, isRunning }: RenderCellProps<RowWithKey> & { isRunning: boolean }) {
  return <StatusIndicator success={(row as unknown as RecordResultRow)._success} isRunning={isRunning} label="Record" />;
}

/** Group rows carry the outcome of the group as a whole - all-or-nothing, so one failure fails the group */
function GroupSuccessRenderer({ childRows, isRunning }: RenderGroupCellProps<RowWithKey> & { isRunning: boolean }) {
  return <StatusIndicator success={getGroupSuccess(childRows as unknown as RecordResultRow[])} isRunning={isRunning} label="Group" />;
}

/**
 * Group header label. Once any column provides a group cell the grid stops rendering its own full-width
 * header, so this owns the toggle, the group name, and the per-group counts.
 */
function GroupLabelRenderer({ groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<RowWithKey>) {
  const rows = childRows as unknown as RecordResultRow[];
  const failureCount = rows.filter(({ _success }) => _success === false).length;
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
      <span className="jgrid-group-toggle-label">{groupKey === null || groupKey === undefined ? '—' : String(groupKey)}</span>
      <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">
        {formatNumber(rows.length)} {pluralizeFromNumber('record', rows.length)}
        {failureCount > 0 ? ` · ${formatNumber(failureCount)} failed` : ''}
      </span>
    </button>
  );
}

function getColumns({
  includeWorksheet,
  includeRun,
  isRunning,
}: {
  includeWorksheet: boolean;
  includeRun: boolean;
  isRunning: boolean;
}): ColumnWithFilter<RowWithKey>[] {
  const columns: ColumnWithFilter<RowWithKey>[] = [
    {
      name: '',
      key: '_success',
      width: 90,
      resizable: false,
      sortable: true,
      filters: ['SET'],
      renderCell: (props) => <SuccessRenderer {...props} isRunning={isRunning} />,
      renderGroupCell: (props) => <GroupSuccessRenderer {...props} isRunning={isRunning} />,
      getValue: ({ row }) => {
        const { _success } = row as unknown as RecordResultRow;
        return _success === true ? 'Success' : _success === false ? 'Failed' : 'Pending';
      },
    },
    ...(includeWorksheet
      ? [{ name: 'Worksheet', key: 'worksheet', width: 160, sortable: true, filters: ['SET'] } as ColumnWithFilter<RowWithKey>]
      : []),
    { name: 'Row', key: 'rowNumber', width: 80, sortable: true, filters: ['NUMBER'] },
    {
      name: 'Group',
      key: 'group',
      width: 110,
      sortable: true,
      filters: ['SET'],
      renderGroupCell: GroupLabelRenderer,
      // The group label reads as a sentence, so let it run across the columns to the right of it
      colSpan: (args) => (args.type === 'GROUP' ? Number.MAX_SAFE_INTEGER : undefined),
    },
    { name: 'Reference Id', key: 'referenceId', width: 180, sortable: true, filters: ['TEXT', 'SET'] },
    { name: 'Object', key: 'sobject', width: 130, sortable: true, filters: ['SET'] },
    { name: 'Operation', key: 'operation', width: 110, sortable: true, filters: ['SET'] },
    { name: 'Record Id', key: '_id', width: 180, sortable: true, filters: ['TEXT'] },
    ...(includeRun
      ? [
          {
            name: 'Run',
            key: 'runType',
            width: 90,
            sortable: true,
            filters: ['SET'],
            getValue: ({ row }) => ((row as unknown as RecordResultRow).runType === 'retry' ? 'Retry' : 'Initial'),
            renderCell: ({ row }: RenderCellProps<RowWithKey>) =>
              (row as unknown as RecordResultRow).runType === 'retry' ? <span className="slds-badge">Retry</span> : null,
          } as ColumnWithFilter<RowWithKey>,
        ]
      : []),
    getRecordErrorColumn(),
  ];
  return columns;
}

/** Per-record load results, one tab per worksheet plus a combined view */
export const LoadRecordsMultiObjectResultsTables: FunctionComponent<LoadRecordsMultiObjectResultsTablesProps> = ({
  rows,
  hasMultipleRuns,
  isRunning,
  selectedOrg,
  serverUrl,
}) => {
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);

  const visibleRows = useMemo(
    () => (showFailuresOnly ? rows.filter(({ _success }) => _success === false) : rows),
    [rows, showFailuresOnly],
  );

  const groupIds = useMemo(() => Array.from(new Set(rows.map(({ group }) => group))), [rows]);
  const { expandedGroupIds, setExpandedGroupIds, toggleAllGroups, hasExpandedGroups } = useExpandedGroups(groupIds);

  const tabs = useMemo((): UiTabSection[] => {
    const rowsByWorksheet = groupBy(visibleRows, 'worksheet');

    function buildTable(tableRows: RecordResultRow[], includeWorksheet: boolean) {
      return (
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} bufferIfNotRendered={320} minHeight={MIN_GRID_HEIGHT}>
          <DataTree
            data={tableRows as unknown as RowWithKey[]}
            columns={getColumns({ includeWorksheet, includeRun: hasMultipleRuns, isRunning })}
            getRowKey={(row) => (row as unknown as RecordResultRow)._key}
            groupBy={['group']}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={setExpandedGroupIds}
            org={selectedOrg}
            serverUrl={serverUrl}
            rowHeight={({ row, columnWidths }) => getRecordErrorRowHeight(row, columnWidths)}
            rowClass={(row) => ((row as unknown as RecordResultRow)._success === false ? 'save-error' : undefined)}
          />
        </AutoFullHeightContainer>
      );
    }

    const failureCountByWorksheet = groupBy(
      rows.filter(({ _success }) => _success === false),
      'worksheet',
    );

    return [
      {
        id: ALL_TAB_ID,
        titleText: 'All Worksheets',
        title: <span>All Worksheets</span>,
        content: buildTable(visibleRows, true),
      },
      ...Object.entries(rowsByWorksheet).map(([worksheet, worksheetRows]): UiTabSection => ({
        id: worksheet,
        titleText: worksheet,
        title: (
          <span>
            {worksheet}
            {failureCountByWorksheet[worksheet]?.length > 0 && (
              <span
                className="slds-badge slds-theme_error slds-m-left_x-small"
                title={`${formatNumber(failureCountByWorksheet[worksheet].length)} failed ${pluralizeFromNumber(
                  'record',
                  failureCountByWorksheet[worksheet].length,
                )}`}
              >
                {formatNumber(failureCountByWorksheet[worksheet].length)}
              </span>
            )}
          </span>
        ),
        content: buildTable(worksheetRows, false),
      })),
    ];
  }, [visibleRows, rows, hasMultipleRuns, isRunning, selectedOrg, serverUrl, expandedGroupIds, setExpandedGroupIds]);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="slds-m-top_small">
      <Grid align="spread" verticalAlign="center">
        <ExpandCollapseButton isExpanded={hasExpandedGroups} onToggle={toggleAllGroups} />
        <Checkbox id="show-failures-only" checked={showFailuresOnly} label="Show failures only" onChange={setShowFailuresOnly} />
      </Grid>
      <Tabs tabs={tabs} />
    </div>
  );
};

export default LoadRecordsMultiObjectResultsTables;

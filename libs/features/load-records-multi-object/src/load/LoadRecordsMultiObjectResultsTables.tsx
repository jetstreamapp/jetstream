import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi, UiTabSection } from '@jetstream/types';
import type { ColumnWithFilter, RenderCellProps, RowWithKey } from '@jetstream/ui';
import {
  AutoFullHeightContainer,
  Checkbox,
  DataTable,
  Grid,
  Icon,
  Spinner,
  Tabs,
  getRecordErrorColumn,
  getRecordErrorRowHeight,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, ReactNode, useMemo, useState } from 'react';
import { RecordResultRow } from './load-results-utils';

const ALL_TAB_ID = '__all__';

export interface LoadRecordsMultiObjectResultsTablesProps {
  rows: RecordResultRow[];
  hasMultipleRuns: boolean;
  /** Shows a spinner (instead of a neutral dash) on rows that have not been processed yet */
  isRunning: boolean;
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
}

function SuccessRenderer({ row, isRunning }: RenderCellProps<RowWithKey> & { isRunning: boolean }) {
  const { _success } = row as unknown as RecordResultRow;
  let content: ReactNode;
  if (_success === true) {
    content = (
      <Icon
        type="utility"
        icon="success"
        className="slds-icon slds-icon_x-small slds-icon-text-success"
        title="Loaded successfully"
        description="Loaded successfully"
      />
    );
  } else if (_success === false) {
    content = (
      <Icon type="utility" icon="error" className="slds-icon slds-icon_x-small slds-icon-text-error" title="Failed" description="Failed" />
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
      getValue: ({ row }) => {
        const { _success } = row as unknown as RecordResultRow;
        return _success === true ? 'Success' : _success === false ? 'Failed' : 'Pending';
      },
    },
    ...(includeWorksheet
      ? [{ name: 'Worksheet', key: 'worksheet', width: 160, sortable: true, filters: ['SET'] } as ColumnWithFilter<RowWithKey>]
      : []),
    { name: 'Row', key: 'rowNumber', width: 80, sortable: true, filters: ['NUMBER'] },
    { name: 'Group', key: 'group', width: 110, sortable: true, filters: ['SET'] },
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

  const tabs = useMemo((): UiTabSection[] => {
    const rowsByWorksheet = groupBy(visibleRows, 'worksheet');

    function buildTable(tableRows: RecordResultRow[], includeWorksheet: boolean) {
      return (
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} bufferIfNotRendered={320}>
          <DataTable
            data={tableRows as unknown as RowWithKey[]}
            columns={getColumns({ includeWorksheet, includeRun: hasMultipleRuns, isRunning })}
            getRowKey={(row) => (row as unknown as RecordResultRow)._key}
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
  }, [visibleRows, rows, hasMultipleRuns, isRunning, selectedOrg, serverUrl]);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="slds-m-top_small">
      <Grid align="end">
        <Checkbox id="show-failures-only" checked={showFailuresOnly} label="Show failures only" onChange={setShowFailuresOnly} />
      </Grid>
      <Tabs tabs={tabs} />
    </div>
  );
};

export default LoadRecordsMultiObjectResultsTables;

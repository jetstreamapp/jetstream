import { css } from '@emotion/react';
import { orderStringsBy } from '@jetstream/shared/utils';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useEffect, useState } from 'react';
import { FormatterProps, RowHeightArgs } from 'react-data-grid';
import { MessagesByChannel } from './usePlatformEvent';

export const WrappedTextFormatter: FunctionComponent<FormatterProps<PlatformEventRow>> = ({ column, row }) => {
  const value = row[column.key];
  return (
    <p
      css={css`
        white-space: pre-wrap;
        line-height: normal;
      `}
    >
      {value}
    </p>
  );
};

const columns: ColumnWithFilter<PlatformEventRow>[] = [
  {
    name: 'Event',
    key: 'event',
    width: 230,
    // rowGroup: true,
    // hide: true,
    // lockVisible: true,
    // lockPosition: true,
    // tooltipField: 'event',
    frozen: true,
  },
  {
    name: 'Payload',
    key: 'payload',
    width: 450,
    // wrapText: true,
    // autoHeight: true,
    formatter: WrappedTextFormatter,
    cellClass: 'break-all',
  },
  {
    name: 'UUID',
    key: 'uuid',
    width: 160,
    // tooltipField: 'uuid',
  },
  {
    name: 'Replay Id',
    key: 'replayId',
    width: 120,
    // tooltipField: 'replayId',
  },
];

const groupedRows = ['event'] as const;

function getRowId(data: PlatformEventRow): string {
  return data.uuid;
}

function getRowHeight({ row, type }: RowHeightArgs<PlatformEventRow>) {
  if (type === 'ROW') {
    const numRows = Math.ceil(row.payload.length / 60);
    const lineHeight = 16 * 1.2;
    const maxRowHeight = 12 * lineHeight;
    return Math.min(numRows * lineHeight, maxRowHeight);
  }
  return 24;
}

interface PlatformEventRow {
  event: string;
  payload: string;
  uuid: string;
  replayId: number;
}

export interface PlatformEventMonitorEventsProps {
  messagesByChannel: MessagesByChannel;
}

export const PlatformEventMonitorEvents: FunctionComponent<PlatformEventMonitorEventsProps> = ({ messagesByChannel }) => {
  const [rows, setRows] = useState<PlatformEventRow[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set<any>());

  useEffect(() => {
    setExpandedGroupIds(new Set(rows.map(({ event }) => event)));
  }, [rows]);

  useEffect(() => {
    setRows(
      orderStringsBy(Object.keys(messagesByChannel)).flatMap((channel) =>
        messagesByChannel[channel].messages.map(
          (message): PlatformEventRow => ({
            event: channel,
            payload: JSON.stringify(message.payload),
            uuid: message.event.EventUuid,
            replayId: message.event.replayId,
          })
        )
      )
    );
  }, [messagesByChannel]);

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr delayForSecondTopCalc>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={getRowId}
        groupBy={groupedRows}
        rowGrouper={groupBy}
        expandedGroupIds={expandedGroupIds}
        onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
        rowHeight={getRowHeight}
        // defaultMenuTabs={['filterMenuTab', 'generalMenuTab']}
        // agGridProps={{
        //   getRowId,
        //   enableCellTextSelection: true,
        //   enableRangeSelection: false,
        //   autoGroupColumnDef: {
        //     name: 'Event',
        //     key: 'agGroupCellRenderer',
        //     filterParams: {
        //       filters: [{ filter: 'agTextColumnFilter' }, { filter: 'agSetColumnFilter', filterParams: { showTooltips: true } }],
        //     },
        //     menuTabs: ['filterMenuTab'],
        //     sortable: true,
        //     resizable: true,
        //     sort: 'asc',
        //   },
        //   showOpenedGroup: true,
        //   groupDefaultExpanded: 1,
        // }}
      />
    </AutoFullHeightContainer>
  );
};

export default PlatformEventMonitorEvents;

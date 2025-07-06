import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { orderValues } from '@jetstream/shared/utils';
import { ContextMenuItem } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, ContextMenuActionData, DataTree } from '@jetstream/ui';
import { STORAGE_KEYS } from '@jetstream/ui/app-state';
import copyToClipboard from 'copy-to-clipboard';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { RenderCellProps, RowHeightArgs, SortColumn } from 'react-data-grid';
import { z } from 'zod';
import { MessagesByChannel } from './usePlatformEvent';

type ContextEventAction = 'COPY_CELL' | 'COPY_EVENT' | 'COPY_EVENT_ALL';

const TABLE_CONTEXT_MENU_ITEMS: ContextMenuItem<ContextEventAction>[] = [
  { label: 'Copy cell to clipboard', value: 'COPY_CELL' },
  { label: 'Copy event to clipboard', value: 'COPY_EVENT' },
  { label: 'Copy all events to clipboard', value: 'COPY_EVENT_ALL' },
];

const sortColumnSchema = z.object({
  columnKey: z.string(),
  direction: z.enum(['ASC', 'DESC']),
});

export const WrappedTextFormatter: FunctionComponent<RenderCellProps<PlatformEventRow>> = ({ column, row }) => {
  const value = row[column.key as keyof PlatformEventRow];
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
    frozen: true,
  },
  {
    name: 'Payload',
    key: 'payload',
    width: 450,
    renderCell: WrappedTextFormatter,
    cellClass: 'break-all',
    draggable: true,
  },
  {
    name: 'Replay Id',
    key: 'replayId',
    width: 120,
    draggable: true,
  },
  {
    name: 'UUID',
    key: 'uuid',
    width: 160,
    draggable: true,
  },
];

const groupedRows = ['event'] as const;

function getRowId(data: PlatformEventRow): string {
  return data.uuid || `${data.replayId}` || JSON.stringify(data);
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
  const [initialSortColumns] = useState<SortColumn[]>(() => {
    const sortColumns = localStorage.getItem(STORAGE_KEYS.PLATFORM_EVENT_SORT_COLUMNS);
    if (sortColumns) {
      try {
        return sortColumnSchema.array().parse(JSON.parse(sortColumns));
      } catch (ex) {
        logger.error('Failed to parse platform event sort order from localStorage', ex);
        localStorage.removeItem(STORAGE_KEYS.PLATFORM_EVENT_SORT_COLUMNS);
      }
    }
    return [{ columnKey: 'replayId', direction: 'ASC' }];
  });

  useEffect(() => {
    setExpandedGroupIds(new Set(rows.map(({ event }) => event)));
  }, [rows]);

  useEffect(() => {
    setRows(
      orderValues(Object.keys(messagesByChannel)).flatMap((channel) =>
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

  const handleContextMenuAction = useCallback(
    (item: ContextMenuItem<ContextEventAction>, data: ContextMenuActionData<PlatformEventRow>) => {
      switch (item.value) {
        case 'COPY_CELL':
          copyToClipboard(JSON.stringify(data.row[data.column.key as keyof PlatformEventRow], null, 2), { format: 'text/plain' });
          break;
        case 'COPY_EVENT':
          copyToClipboard(JSON.stringify(data.row, null, 2), { format: 'text/plain' });
          break;
        case 'COPY_EVENT_ALL':
          copyToClipboard(JSON.stringify(data.rows, null, 2), { format: 'text/plain' });
          break;
      }
    },
    []
  );

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr delayForSecondTopCalc bottomBuffer={25}>
      <DataTree
        columns={columns}
        data={rows}
        getRowKey={getRowId}
        groupBy={groupedRows}
        rowGrouper={groupBy}
        expandedGroupIds={expandedGroupIds}
        onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
        rowHeight={getRowHeight}
        initialSortColumns={initialSortColumns}
        contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
        contextMenuAction={(item, data) => handleContextMenuAction(item as ContextMenuItem<ContextEventAction>, data)}
        onSortColumnsChange={(order) => setItemInLocalStorage(STORAGE_KEYS.PLATFORM_EVENT_SORT_COLUMNS, JSON.stringify(order))}
      />
    </AutoFullHeightContainer>
  );
};

export default PlatformEventMonitorEvents;

import { ColDef } from '@ag-grid-community/core';
import { orderStringsBy } from '@jetstream/shared/utils';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { MessagesByChannel } from './usePlatformEvent';

const columns: ColDef[] = [
  {
    headerName: 'Event',
    colId: 'event',
    field: 'event',
    width: 230,
    rowGroup: true,
    hide: true,
    lockVisible: true,
    lockPosition: true,
    tooltipField: 'event',
  },
  {
    headerName: 'Payload',
    colId: 'payload',
    field: 'payload',
    width: 450,
    wrapText: true,
    autoHeight: true,
  },
  {
    headerName: 'UUID',
    colId: 'uuid',
    field: 'uuid',
    width: 160,
    tooltipField: 'uuid',
  },
  {
    headerName: 'Replay Id',
    colId: 'replayId',
    field: 'replayId',
    width: 120,
    tooltipField: 'replayId',
  },
];

function getRowNodeId(data: PlatformEvenRow): string {
  return data.uuid;
}

interface PlatformEvenRow {
  event: string;
  payload: string;
  uuid: string;
  replayId: number;
}

export interface PlatformEventMonitorEventsProps {
  messagesByChannel: MessagesByChannel;
}

export const PlatformEventMonitorEvents: FunctionComponent<PlatformEventMonitorEventsProps> = ({ messagesByChannel }) => {
  const [rows, setRows] = useState<PlatformEvenRow[]>([]);

  useEffect(() => {
    setRows(
      orderStringsBy(Object.keys(messagesByChannel)).flatMap((channel) =>
        messagesByChannel[channel].messages.map(
          (message): PlatformEvenRow => ({
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
        defaultMenuTabs={['filterMenuTab', 'generalMenuTab']}
        agGridProps={{
          immutableData: true,
          getRowNodeId,
          enableCellTextSelection: true,
          enableRangeSelection: false,
          autoGroupColumnDef: {
            headerName: 'Event',
            width: 200,
            cellRenderer: 'agGroupCellRenderer',
            filterParams: {
              filters: [{ filter: 'agTextColumnFilter' }, { filter: 'agSetColumnFilter' }],
            },
            menuTabs: ['filterMenuTab'],
            sortable: true,
            resizable: true,
            sort: 'asc',
          },
          showOpenedGroup: true,
          groupDefaultExpanded: 1,
        }}
      />
    </AutoFullHeightContainer>
  );
};

export default PlatformEventMonitorEvents;

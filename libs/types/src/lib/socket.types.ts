export type RecordSyncEvent = 'RECORD_SYNC';
/** Data-less notification that the user's sync data changed - clients respond by pulling from their own cursor */
export type DataSyncPokeEvent = 'DATA_SYNC_POKE';
export type SocketEvent = RecordSyncEvent | DataSyncPokeEvent;

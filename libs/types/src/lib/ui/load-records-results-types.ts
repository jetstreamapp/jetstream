export type DownloadScope = 'all' | 'batch';
export type DownloadAction = 'view' | 'download';
export type DownloadType = 'results' | 'failures';

export interface PrepareDataResponseError {
  row: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  errors: string[];
}

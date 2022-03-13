export type DownloadAction = 'view' | 'download';
export type DownloadType = 'results' | 'failures';

export interface PrepareDataResponseError {
  row: number;
  record: any;
  errors: string[];
}

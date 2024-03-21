export interface DeleteResult {
  auth0Id: string;
  auth0Success: boolean;
  localDeleteSuccess: boolean;
  orgCount: number | null;
  localDatabaseId: string | null;
}

export interface AmplitudeChartResult {
  data: AmplitudeData;
  timeComputed: number;
  wasCached: boolean;
  cacheFreshness: string;
  novaRuntime: number;
  novaRequestDuration: number;
  novaCost: number;
  throttleTime: number;
  minSampleRate: number;
  transformationIds: any[];
  backend: string;
  realtimeDataMissing: boolean;
  timedOutRealtimeData: boolean;
  missedCacheAndNotComputed: boolean;
  partialMergedAndNewUserInformation: boolean;
  prunedResult: boolean;
  hitChunkGroupByLimit: boolean;
  subcluster: number;
  millisSinceComputed: number;
  earliestServerReceivedTime: number;
  queryIds: string[];
}

export interface AmplitudeData {
  series: AmplitudeSeries[][];
  seriesCollapsed: AmplitudeSeriesCollapsed[][];
  seriesLabels: number[];
  seriesMeta: AmplitudeSeriesMeta[];
  xValues: string[];
}

export interface AmplitudeSeries {
  setId: string;
  value: number;
}

export interface AmplitudeSeriesCollapsed {
  setId: string;
  value: number;
}

export interface AmplitudeSeriesMeta {
  segmentIndex: number;
  eventIndex: number;
}

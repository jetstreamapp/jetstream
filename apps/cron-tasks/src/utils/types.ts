export interface DeleteResult {
  auth0Id: string;
  auth0Success: boolean;
  localDeleteSuccess: boolean;
  orgCount: number | null;
  localDatabaseId: string | null;
}

export interface DailyEventCounts {
  /** yyyy-MM-dd (UTC day) */
  date: string;
  loadRecords: number;
  queryCount: number;
}

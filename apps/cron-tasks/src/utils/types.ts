export interface DeleteResult {
  auth0Id: string;
  auth0Success: boolean;
  localDeleteSuccess: boolean;
  orgCount: number;
  localDatabaseId: string;
}

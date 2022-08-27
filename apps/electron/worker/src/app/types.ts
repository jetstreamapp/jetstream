import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import type * as jsforce from 'jsforce';

export interface SalesforceOrgElectron extends SalesforceOrgUi {
  accessToken: string;
  refreshToken: string;
}
// Multiple type options to make it easier to focus specific params
export type ControllerFnQuery<Query> = ControllerFn<any, Query>;
export type ControllerFnParams<Params> = ControllerFn<any, MapOf<string>, Params>;
export type ControllerFnDataParams<Data, Params> = ControllerFn<Data, MapOf<string>, Params>;
export type ControllerFnQueryParams<Query, Params> = ControllerFn<any, Query, Params>;
export type ControllerFn<Data = any, Query = MapOf<string>, Params = { [k: string]: string | undefined }> = (
  _: never,
  __: never,
  params: Params,
  request: ElectronRequest<Data, Query>
) => void;

export interface ElectronRequest<Data = any, Query = MapOf<string>> {
  resolve: (data?: any) => void;
  reject: (error: Error) => void;
  connection?: jsforce.Connection;
  targetConnection?: jsforce.Connection;
  request: ElectronRequestData<Data, Query>;
}

export interface ElectronRequestData<Data = any, Query = MapOf<string>> {
  method: string;
  headers: MapOf<string>;
  query?: Query;
  data?: Data;
}

import { ExpressionType, ListItemGroup, MapOf, QueryFields } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom } from 'recoil';

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'query.sObjectsState',
  default: null,
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult>({
  key: 'query.selectedSObjectState',
  default: null,
});

export const queryFieldsKey = atom<string>({
  key: 'query.queryFieldsKey',
  default: null,
});

export const queryFieldsMapState = atom<MapOf<QueryFields>>({
  key: 'query.queryFieldsMapState',
  default: {},
});

export const selectedQueryFieldsState = atom<string[]>({
  key: 'query.selectedQueryFieldsState',
  default: [],
});

export const filterQueryFieldsState = atom<ListItemGroup[]>({
  key: 'query.filterQueryFieldsState',
  default: [],
});

export const queryFiltersState = atom<ExpressionType>({
  key: 'query.queryFiltersState',
  default: undefined,
});

export const querySoqlState = atom<string>({
  key: 'query.querySoqlState',
  default: '',
});

// TODO: move to selector
export const queryIsFavoriteState = atom<boolean>({
  key: 'query.queryIsFavoriteState',
  default: false,
});

// TODO: handle org changes (e.x. subscribe to event and then update store I guess?)

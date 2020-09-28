import { ExpressionType, ListItemGroup, MapOf, QueryFields, QueryOrderByClause, QueryHistoryItem } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { orderStringsBy } from '@jetstream/shared/utils';

export const priorSelectedOrg = atom<string>({
  key: 'load.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'load.sObjectsState',
  default: null,
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult>({
  key: 'load.selectedSObjectState',
  default: null,
});

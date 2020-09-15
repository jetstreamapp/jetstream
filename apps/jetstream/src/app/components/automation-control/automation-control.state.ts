import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom } from 'recoil';

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'query.sObjectsState',
  default: null,
});

export const selectedSObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'query.selectedSObjectsState',
  default: [],
});

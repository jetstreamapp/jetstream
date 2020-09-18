import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom } from 'recoil';

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'automationControl.sObjectsState2',
  default: null,
});

export const selectedSObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'automationControl.selectedSObjectsState2',
  default: [],
});

import { InsertUpdateUpsertDelete } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom } from 'recoil';
import { FieldMapping } from './load-records-types';

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

export const loadExistingRecordCount = atom<number>({
  key: 'load.loadExistingRecordCount',
  default: null,
});

export const loadTypeState = atom<InsertUpdateUpsertDelete>({
  key: 'load.loadTypeState',
  default: 'INSERT',
});

export const inputFileDataState = atom<any[]>({
  key: 'load.inputFileDataState',
  default: null,
});

export const inputFileHeaderState = atom<string[]>({
  key: 'load.inputFileHeaderState',
  default: null,
});

export const inputFilenameState = atom<string>({
  key: 'load.inputFilenameState',
  default: null,
});

export const fieldMappingState = atom<FieldMapping>({
  key: 'load.fieldMappingState',
  default: {},
});

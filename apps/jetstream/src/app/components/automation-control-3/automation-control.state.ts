import { atom } from 'recoil';
import { ToolingEntityDefinitionRecord } from './temp-types';

export const sObjectsState = atom<ToolingEntityDefinitionRecord[]>({
  key: 'query.sObjectsState',
  default: null,
});

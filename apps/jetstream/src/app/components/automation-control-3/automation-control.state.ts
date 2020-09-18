import { atom } from 'recoil';
import { ToolingEntityDefinitionRecord } from './temp-types';

export const sObjectsState = atom<ToolingEntityDefinitionRecord[]>({
  key: 'automationControl.sObjectsState3',
  default: null,
});

import { atom } from 'recoil';
import { ToolingEntityDefinitionRecord } from './automation-control-types';

export const sObjectsState = atom<ToolingEntityDefinitionRecord[]>({
  key: 'automationControl.sObjectsState3',
  default: null,
});

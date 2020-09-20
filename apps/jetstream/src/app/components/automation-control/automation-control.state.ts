import { atom } from 'recoil';
import { MapOf, UiTabSection } from '@jetstream/types';
import { AutomationControlParentSobject, ToolingEntityDefinitionRecord } from './automation-control-types';

export const priorSelectedOrg = atom<string>({
  key: 'automationControl.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<ToolingEntityDefinitionRecord[]>({
  key: 'automationControl.sObjectsState',
  default: null,
});

export const itemIds = atom<string[]>({
  key: 'automationControl.itemIds',
  default: [],
});

export const itemsById = atom<MapOf<AutomationControlParentSobject>>({
  key: 'automationControl.itemsById',
  default: {},
});

export const activeItemId = atom<string>({
  key: 'automationControl.activeItemId',
  default: null,
});

export const tabs = atom<UiTabSection[]>({
  key: 'automationControl.tabs',
  default: [],
});

// sobject: [id1, id2]
export const flowDefinitionsBySobject = atom<MapOf<string[]>>({
  key: 'automationControl.flowDefinitionsBySobject',
  default: null,
});

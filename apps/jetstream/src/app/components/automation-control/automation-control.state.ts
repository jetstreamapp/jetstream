import { atom, selector } from 'recoil';
import { MapOf, UiTabSection } from '@jetstream/types';
import {
  AutomationControlParentSobject,
  ToolingEntityDefinitionRecord,
  AutomationControlMetadataType,
  DirtyAutomationItems,
} from './automation-control-types';
import isUndefined from 'lodash/isUndefined';

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

export const flowDefinitionsBySobject = atom<MapOf<string[]>>({
  key: 'automationControl.flowDefinitionsBySobject',
  default: null,
});

export const selectDirtyItems = selector<DirtyAutomationItems>({
  key: 'automationControl.selectDirtyItems',
  get: ({ get }) => {
    const _itemsById = get(itemsById);
    return get(itemIds).reduce(
      (output: DirtyAutomationItems, itemId) => {
        const item = _itemsById[itemId];
        const isDirty = Object.values(item.automationItems).some((automationItem: AutomationControlMetadataType) => {
          return automationItem.items.some((childItem) => {
            if (Array.isArray(childItem.children)) {
              return childItem.children.some((grandChildItem) => grandChildItem.initialValue !== grandChildItem.currentValue);
            }
            return childItem.initialValue !== childItem.currentValue || childItem.initialActiveVersion !== childItem.currentActiveVersion;
          });
        });
        output.itemsById[itemId] = isDirty;
        if (isDirty) {
          output.anyDirty = true;
        }
        return output;
      },
      { anyDirty: false, itemsById: {} }
    );
  },
});

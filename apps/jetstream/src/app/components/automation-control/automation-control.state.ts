import { MapOf, UiTabSection } from '@jetstream/types';
import { atom, selector } from 'recoil';
import {
  AutomationControlMetadataType,
  AutomationItemsChildren,
  AutomationControlParentSobject,
  AutomationItems,
  DirtyAutomationItems,
  ToolingEntityDefinitionRecord,
} from './automation-control-types';

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

export const selectModifiedChildAutomationItems = selector<MapOf<AutomationItemsChildren>>({
  key: 'automationControl.selectChildAutomationItems',
  get: ({ get }) => {
    const _itemsById = get(itemsById);
    const dirtyItems = get(selectDirtyItems);
    return get(itemIds)
      .filter((itemId) => dirtyItems.itemsById[itemId])
      .reduce((output: MapOf<AutomationItemsChildren>, itemId) => {
        const modifiedAutomationItems: AutomationItemsChildren = {
          key: _itemsById[itemId].key,
          sobjectName: _itemsById[itemId].sobjectName,
          sobjectLabel: _itemsById[itemId].sobjectLabel,
          automationItems: {
            ValidationRule: _itemsById[itemId].automationItems.ValidationRule.items
              .filter((item) => item.initialValue !== item.currentValue)
              .map((item) => ({ ...item })),
            WorkflowRule: _itemsById[itemId].automationItems.WorkflowRule.items
              .filter((item) => item.initialValue !== item.currentValue)
              .map((item) => ({ ...item })),
            Flow: _itemsById[itemId].automationItems.Flow.items
              .filter((item) => item.initialValue !== item.currentValue || item.initialActiveVersion !== item.currentActiveVersion)
              .map((item) => ({ ...item })),
            ApexTrigger: _itemsById[itemId].automationItems.ApexTrigger.items.filter((item) => item.initialValue !== item.currentValue),
          },
        };
        output[itemId] = modifiedAutomationItems;
        return output;
      }, {});
  },
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

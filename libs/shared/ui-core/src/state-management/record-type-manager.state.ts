import { groupByFlat } from '@jetstream/shared/utils';
import { ListItem, ListMetadataResult } from '@jetstream/types';
import { atom, selector } from 'recoil';

export const recordTypesState = atom<ListItem<string, ListMetadataResult>[]>({
  key: 'permission-manager.recordTypesState',
  default: [],
});

export const selectedRecordTypeIds = atom<string[]>({
  key: 'record-type-manager.selectedRecordTypeIds',
  default: [],
});

export const hasSelectionsMade = selector({
  key: 'record-type-manager.hasSelectionsMade',
  get: ({ get }) => {
    return !!get(selectedRecordTypeIds)?.length;
  },
});

export const recordTypesByFullName = selector({
  key: 'record-type-manager.recordTypesByFullName',
  get: ({ get }) => {
    const items = (get(recordTypesState) || []).map((item) => item.meta as ListMetadataResult);
    return groupByFlat(items, 'fullName');
  },
});

export const selectedRecordTypes = selector({
  key: 'record-type-manager.selectedRecordTypes',
  get: ({ get }) => {
    const itemsById = get(recordTypesByFullName);
    return get(selectedRecordTypeIds).map((id) => itemsById[id]);
  },
});

import { groupByFlat } from '@jetstream/shared/utils';
import { ListItem, ListMetadataResult } from '@jetstream/types';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export const recordTypesState = atomWithReset<ListItem<string, ListMetadataResult>[]>([]);

export const selectedRecordTypeIds = atomWithReset<string[]>([]);

export const hasSelectionsMade = atom((get) => {
  return !!get(selectedRecordTypeIds)?.length;
});

export const recordTypesByFullName = atom((get) => {
  const items = (get(recordTypesState) || []).map((item) => item.meta as ListMetadataResult);
  return groupByFlat(items, 'fullName');
});

export const selectedRecordTypes = atom((get) => {
  const itemsById = get(recordTypesByFullName);
  return get(selectedRecordTypeIds).map((id) => itemsById[id]);
});

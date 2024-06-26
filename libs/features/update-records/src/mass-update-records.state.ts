import { orderObjectsBy } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Field, ListItem } from '@jetstream/types';
import { MetadataRow } from '@jetstream/ui-core';
import intersectionBy from 'lodash/intersectionBy';
import { atom, selector } from 'recoil';

export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'mass-update-records.sObjectsState',
  default: null,
});

export const selectedSObjectsState = atom<string[]>({
  key: 'mass-update-records.selectedSObjectsState',
  default: [],
});

export const rowsMapState = atom<Map<string, MetadataRow>>({
  key: 'mass-update-records.rowsMapState',
  default: new Map(),
});

export const rowsState = selector<MetadataRow[]>({
  key: 'mass-update-records.rowsState',
  get: ({ get }) => {
    return orderObjectsBy(Array.from(get(rowsMapState).values()), 'sobject');
  },
});

export const isConfigured = selector<boolean>({
  key: 'mass-update-records.isConfigured',
  get: ({ get }) => {
    const rows = get(rowsState);
    return !!rows.length && rows.every((row) => row.isValid && row.validationResults?.isValid);
  },
});

export const commonFields = selector<ListItem[]>({
  key: 'mass-update-records.commonFields',
  get: ({ get }) => {
    const rowsMap = get(rowsMapState);
    return intersectionBy(
      ...Array.from(rowsMap.values()).map((row) => row.fields?.filter((field) => (field.meta as Field).updateable) || []),
      ((item: ListItem) => {
        return item.id;
      }) as any
    ).map((item) => ({ ...item, label: item.value }));
  },
});

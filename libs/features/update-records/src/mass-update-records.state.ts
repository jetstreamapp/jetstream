import { orderObjectsBy } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Field, ListItem } from '@jetstream/types';
import { MetadataRow } from '@jetstream/ui-core';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import intersectionBy from 'lodash/intersectionBy';

export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);

export const selectedSObjectsState = atomWithReset<string[]>([]);

export const rowsMapState = atomWithReset<Map<string, MetadataRow>>(new Map());

export const rowsState = atom<MetadataRow[]>((get) => {
  return orderObjectsBy(Array.from(get(rowsMapState).values()), 'sobject');
});

export const isConfigured = atom<boolean>((get) => {
  const rows = get(rowsState);
  return !!rows.length && rows.every((row) => row.isValid && row.validationResults?.isValid);
});

export const commonFields = atom<ListItem[]>((get) => {
  const rowsMap = get(rowsMapState);
  return intersectionBy(
    ...Array.from(rowsMap.values()).map((row) => row.fields?.filter((field) => (field.meta as Field).updateable) || []),
    ((item: ListItem) => {
      return item.id;
    }) as any
  ).map((item) => ({ ...item, label: item.value }));
});

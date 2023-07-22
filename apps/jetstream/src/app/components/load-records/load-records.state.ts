import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { InsertUpdateUpsertDelete, MapOf } from '@jetstream/types';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import localforage from 'localforage';
import { atom, selector, selectorFamily } from 'recoil';
import { FieldMapping, LocalOrGoogle, SavedFieldMapping } from './load-records-types';
import { STATIC_MAPPING_PREFIX } from './utils/load-records-utils';

const SUPPORTED_ATTACHMENT_OBJECTS = new Map<string, { bodyField: string }>();
SUPPORTED_ATTACHMENT_OBJECTS.set('Attachment', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('Document', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('ContentVersion', { bodyField: 'VersionData' });

export interface LoadSavedMappingItem {
  key: string; // object:createdDate
  name: string;
  sobject: string;
  csvFields: string[];
  sobjectFields: string[];
  mapping: SavedFieldMapping;
  createdDate: Date;
}

const initLoadSavedMapping = async (): Promise<MapOf<MapOf<LoadSavedMappingItem>>> => {
  const results = await localforage.getItem<MapOf<MapOf<LoadSavedMappingItem>>>(INDEXED_DB.KEYS.loadSavedMapping);
  return results || {};
};

export const savedFieldMappingState = atom<MapOf<MapOf<LoadSavedMappingItem>>>({
  key: 'load.savedFieldMappingState',
  default: initLoadSavedMapping(),
  effects: [
    ({ onSet }) => {
      onSet(async (newValue) => {
        try {
          logger.log('Saving loadSavedMapping to localforage', newValue);
          await localforage.setItem<MapOf<MapOf<LoadSavedMappingItem>>>(INDEXED_DB.KEYS.loadSavedMapping, newValue);
        } catch (ex) {
          logger.error('Error saving loadSavedMapping to localforage', ex);
        }
      });
    },
  ],
});

export const selectSavedFieldMappingState = selectorFamily<
  LoadSavedMappingItem[],
  { sobject: string; csvFields: Set<string>; objectFields: Set<string> }
>({
  key: 'load.selectSavedFieldMappingState',
  get:
    ({ sobject, csvFields, objectFields }) =>
    ({ get }) => {
      const savedMappings = Object.values(get(savedFieldMappingState)[sobject] || {});
      return savedMappings.filter(
        (item) =>
          item.csvFields.filter((field) => !field.startsWith(STATIC_MAPPING_PREFIX)).every((field) => csvFields.has(field)) &&
          item.sobjectFields.every((field) => objectFields.has(field))
      );
    },
});

export const priorSelectedOrg = atom<string | null>({
  key: 'load.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'load.sObjectsState',
  default: null,
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult | null>({
  key: 'load.selectedSObjectState',
  default: null,
});

export const loadExistingRecordCount = atom<number | null>({
  key: 'load.loadExistingRecordCount',
  default: null,
});

export const loadTypeState = atom<InsertUpdateUpsertDelete>({
  key: 'load.loadTypeState',
  default: 'INSERT',
});

export const inputFileDataState = atom<any[] | null>({
  key: 'load.inputFileDataState',
  default: null,
});

export const inputFileHeaderState = atom<string[] | null>({
  key: 'load.inputFileHeaderState',
  default: null,
});

export const inputFilenameState = atom<string | null>({
  key: 'load.inputFilenameState',
  default: null,
});

export const inputFilenameTypeState = atom<LocalOrGoogle | null>({
  key: 'load.inputFilenameTypeState',
  default: null,
});

export const inputZipFileDataState = atom<ArrayBuffer | null>({
  key: 'load.inputZipFileDataState',
  default: null,
});

export const inputZipFilenameState = atom<string | null>({
  key: 'load.inputZipFilenameState',
  default: null,
});

export const fieldMappingState = atom<FieldMapping>({
  key: 'load.fieldMappingState',
  default: {},
});

export const selectAllowBinaryAttachment = selector<boolean | null>({
  key: 'load.selectAllowBinaryAttachment',
  get: ({ get }) => {
    const selectedObject = get(selectedSObjectState);
    return selectedObject && SUPPORTED_ATTACHMENT_OBJECTS.has(selectedObject.name) && get(loadTypeState) !== 'DELETE';
  },
});

export const selectBinaryAttachmentBodyField = selector<string | null>({
  key: 'load.selectBinaryAttachmentBodyField',
  get: ({ get }) => {
    const selectedObject = get(selectedSObjectState);
    return (
      (selectedObject &&
        SUPPORTED_ATTACHMENT_OBJECTS.has(selectedObject.name) &&
        SUPPORTED_ATTACHMENT_OBJECTS.get(selectedObject.name)?.bodyField) ||
      null
    );
  },
});

export const isCustomMetadataObject = selector<boolean | null>({
  key: 'load.isCustomMetadataObject',
  get: ({ get }) => {
    const selectedObject = get(selectedSObjectState);
    return selectedObject && selectedObject.name.endsWith('__mdt');
  },
});

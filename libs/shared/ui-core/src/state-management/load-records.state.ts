import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { detectDateFormatForLocale, formatNumber } from '@jetstream/shared/ui-utils';
import {
  ApiMode,
  DescribeGlobalSObjectResult,
  FieldMapping,
  InsertUpdateUpsertDelete,
  LocalOrGoogle,
  Maybe,
  SavedFieldMapping,
} from '@jetstream/types';
import localforage from 'localforage';
import isNumber from 'lodash/isNumber';
import { atom, selector, selectorFamily } from 'recoil';
import {
  BATCH_RECOMMENDED_THRESHOLD,
  MAX_API_CALLS,
  MAX_BULK,
  STATIC_MAPPING_PREFIX,
  getLabelWithOptionalRecommended,
  getMaxBatchSize,
} from '../load/load-records-utils';
// import {
//   BATCH_RECOMMENDED_THRESHOLD,
//   MAX_API_CALLS,
//   MAX_BULK,
//   STATIC_MAPPING_PREFIX,
//   getLabelWithOptionalRecommended,
//   getMaxBatchSize,
// } from '@jetstream/types';

const SUPPORTED_ATTACHMENT_OBJECTS = new Map<string, { bodyField: string }>();
SUPPORTED_ATTACHMENT_OBJECTS.set('Attachment', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('Document', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('ContentVersion', { bodyField: 'VersionData' });
const DATE_FIELDS = new Set(['date', 'datetime']);

export interface LoadSavedMappingItem {
  key: string; // object:createdDate
  name: string;
  sobject: string;
  csvFields: string[];
  sobjectFields: string[];
  mapping: SavedFieldMapping;
  createdDate: Date;
}

const initLoadSavedMapping = async (): Promise<Record<string, Record<string, LoadSavedMappingItem>>> => {
  try {
    return (await localforage.getItem<Record<string, Record<string, LoadSavedMappingItem>>>(INDEXED_DB.KEYS.loadSavedMapping)) || {};
  } catch (ex) {
    logger.error('Error getting loadSavedMapping from localforage', ex);
    return {};
  }
};

export const savedFieldMappingState = atom<Record<string, Record<string, LoadSavedMappingItem>>>({
  key: 'load.savedFieldMappingState',
  default: initLoadSavedMapping(),
  effects: [
    ({ onSet }) => {
      onSet(async (newValue) => {
        try {
          logger.log('Saving loadSavedMapping to localforage', newValue);
          await localforage.setItem<Record<string, Record<string, LoadSavedMappingItem>>>(INDEXED_DB.KEYS.loadSavedMapping, newValue);
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

export const apiModeState = atom<ApiMode>({
  key: 'apiModeState',
  default: 'BATCH',
});

export const batchSizeState = atom<Maybe<number>>({
  key: 'batchSizeState',
  default: MAX_BULK,
});

export const insertNullsState = atom({
  key: 'insertNullsState',
  default: false,
});

export const serialModeState = atom({
  key: 'serialModeState',
  default: false,
});

export const trialRunState = atom({
  key: 'trialRunState',
  default: false,
});

export const trialRunSizeState = atom<Maybe<number>>({
  key: 'trialRunSizeState',
  default: 1,
});

export const dateFormatState = atom({
  key: 'dateFormatState',
  default: detectDateFormatForLocale(),
});

export const selectHasDateFieldMapped = selector({
  key: 'load.selectHasDateFieldMapped',
  get: ({ get }) => Object.values(get(fieldMappingState)).some((item) => item.fieldMetadata && DATE_FIELDS.has(item.fieldMetadata.type)),
});

export const selectBatchSizeError = selector<string | null>({
  key: 'load.selectBatchSizeError',
  get: ({ get }) => {
    const batchSize = get(batchSizeState) || 0;
    const apiMode = get(apiModeState);
    if (!isNumber(batchSize) || batchSize <= 0 || batchSize > getMaxBatchSize(apiMode)) {
      return `The batch size must be between 1 and ${formatNumber(getMaxBatchSize(apiMode))}`;
    }
    return null;
  },
});

export const selectBatchApiLimitError = selector<string | null>({
  key: 'load.selectBatchApiLimitError',
  get: ({ get }) => {
    const inputFileDataLength = get(inputFileDataState)?.length || 0;
    const batchSize = get(batchSizeState) || 1;
    if (inputFileDataLength && batchSize && inputFileDataLength / batchSize > MAX_API_CALLS) {
      const numApiCalls = Math.round(inputFileDataLength / batchSize);
      return (
        `Either your batch size is too low or you are loading in too many records. ` +
        `Your configuration would require ${formatNumber(numApiCalls)} calls to Salesforce, which exceeds the limit of ${MAX_API_CALLS}. ` +
        `Increase your batch size or reduce the number of records in your file.`
      );
    }
    return null;
  },
});

export const selectTrialRunSizeError = selector<string | null>({
  key: 'load.selectTrialRunSizeError',
  get: ({ get }) => {
    const inputLength = get(inputFileDataState)?.length || 1;
    const trialRunSize = get(trialRunSizeState) || 1;
    if (!isNumber(trialRunSize) || trialRunSize <= 0 || trialRunSize >= inputLength) {
      return `Must be between 1 and ${formatNumber(inputLength - 1)}`;
    }
    return null;
  },
});

export const selectBulkApiModeLabel = selector<string | JSX.Element>({
  key: 'load.selectBulkApiModeLabel',
  get: ({ get }) => {
    const inputFileDataLength = get(inputFileDataState)?.length || 0;
    return getLabelWithOptionalRecommended('Bulk API', inputFileDataLength > BATCH_RECOMMENDED_THRESHOLD, false);
  },
});

export const selectBatchApiModeLabel = selector<string | JSX.Element>({
  key: 'load.selectBatchApiModeLabel',
  get: ({ get }) => {
    const inputFileDataLength = get(inputFileDataState)?.length || 0;
    const hasZipAttachment = !!get(inputZipFileDataState);
    return getLabelWithOptionalRecommended('Batch API', inputFileDataLength <= BATCH_RECOMMENDED_THRESHOLD, hasZipAttachment);
  },
});

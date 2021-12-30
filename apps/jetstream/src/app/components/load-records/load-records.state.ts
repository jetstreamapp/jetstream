import { InsertUpdateUpsertDelete } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { FieldMapping, LocalOrGoogle } from './load-records-types';

const SUPPORTED_ATTACHMENT_OBJECTS = new Map<string, { bodyField: string }>();
SUPPORTED_ATTACHMENT_OBJECTS.set('Attachment', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('Document', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('ContentVersion', { bodyField: 'VersionData' });

export const priorSelectedOrg = atom<string>({
  key: 'load.priorSelectedOrg',
  default: null,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'load.sObjectsState',
  default: null,
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult>({
  key: 'load.selectedSObjectState',
  default: null,
});

export const loadExistingRecordCount = atom<number>({
  key: 'load.loadExistingRecordCount',
  default: null,
});

export const loadTypeState = atom<InsertUpdateUpsertDelete>({
  key: 'load.loadTypeState',
  default: 'INSERT',
});

export const inputFileDataState = atom<any[]>({
  key: 'load.inputFileDataState',
  default: null,
});

export const inputFileHeaderState = atom<string[]>({
  key: 'load.inputFileHeaderState',
  default: null,
});

export const inputFilenameState = atom<string>({
  key: 'load.inputFilenameState',
  default: null,
});

export const inputFilenameTypeState = atom<LocalOrGoogle>({
  key: 'load.inputFilenameTypeState',
  default: null,
});

export const inputZipFileDataState = atom<ArrayBuffer>({
  key: 'load.inputZipFileDataState',
  default: null,
});

export const inputZipFilenameState = atom<string>({
  key: 'load.inputZipFilenameState',
  default: null,
});

export const fieldMappingState = atom<FieldMapping>({
  key: 'load.fieldMappingState',
  default: {},
});

export const selectAllowBinaryAttachment = selector<boolean>({
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
        SUPPORTED_ATTACHMENT_OBJECTS.get(selectedObject.name).bodyField) ||
      null
    );
  },
});

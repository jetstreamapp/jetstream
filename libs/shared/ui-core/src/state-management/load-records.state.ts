import { detectDateFormatForLocale, formatNumber, isBrowserExtension, isDesktop } from '@jetstream/shared/ui-utils';
import { ApiMode, DescribeGlobalSObjectResult, FieldMapping, InsertUpdateUpsertDelete, LocalOrGoogle, Maybe } from '@jetstream/types';
import { hasPaidPlanState } from '@jetstream/ui/app-state';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import isNumber from 'lodash/isNumber';
import { BATCH_RECOMMENDED_THRESHOLD, MAX_BULK, getLabelWithOptionalRecommended, getMaxBatchSize } from '../load/load-records-utils';

const SUPPORTED_ATTACHMENT_OBJECTS = new Map<string, { bodyField: string }>();
SUPPORTED_ATTACHMENT_OBJECTS.set('Attachment', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('Document', { bodyField: 'Body' });
SUPPORTED_ATTACHMENT_OBJECTS.set('ContentVersion', { bodyField: 'VersionData' });
const DATE_FIELDS = new Set(['date', 'datetime']);

export const priorSelectedOrg = atom<string | null>(null);

export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);

export const selectedSObjectState = atomWithReset<DescribeGlobalSObjectResult | null>(null);

export const loadExistingRecordCount = atomWithReset<number | null>(null);

export const loadTypeState = atomWithReset<InsertUpdateUpsertDelete>('INSERT');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inputFileDataState = atomWithReset<any[] | null>(null);

export const inputFileHeaderState = atomWithReset<string[] | null>(null);

export const inputFilenameState = atomWithReset<string | null>(null);

export const inputFilenameTypeState = atomWithReset<LocalOrGoogle | null>(null);

export const inputGoogleFileState = atomWithReset<Maybe<google.picker.DocumentObject>>(null);

export const inputZipFileDataState = atomWithReset<ArrayBuffer | null>(null);

export const inputZipFilenameState = atomWithReset<string | null>(null);

export const fieldMappingState = atomWithReset<FieldMapping>({});

export const selectAllowBinaryAttachment = atom<boolean | null>((get) => {
  const selectedObject = get(selectedSObjectState);
  const loadType = get(loadTypeState);
  const isDelete = loadType === 'DELETE' || loadType === 'HARD_DELETE';
  return selectedObject && SUPPORTED_ATTACHMENT_OBJECTS.has(selectedObject.name) && !isDelete;
});

export const selectBinaryAttachmentBodyField = atom<string | null>((get) => {
  const selectedObject = get(selectedSObjectState);
  return (
    (selectedObject &&
      SUPPORTED_ATTACHMENT_OBJECTS.has(selectedObject.name) &&
      SUPPORTED_ATTACHMENT_OBJECTS.get(selectedObject.name)?.bodyField) ||
    null
  );
});

export const isCustomMetadataObject = atom<boolean | null>((get) => {
  const selectedObject = get(selectedSObjectState);
  return selectedObject && selectedObject.name.endsWith('__mdt');
});

export const apiModeState = atomWithReset<ApiMode>('BATCH');

export const batchSizeState = atomWithReset<Maybe<number>>(MAX_BULK);

export const insertNullsState = atomWithReset(false);

export const serialModeState = atomWithReset(false);

export const trialRunState = atomWithReset(false);

export const trialRunSizeState = atomWithReset<Maybe<number>>(1);

export const dateFormatState = atom(detectDateFormatForLocale());

export const selectHasDateFieldMapped = atom((get) =>
  Object.values(get(fieldMappingState)).some((item) => item.fieldMetadata && DATE_FIELDS.has(item.fieldMetadata.type)),
);

export const selectBatchSizeError = atom<string | null>((get) => {
  const batchSize = get(batchSizeState) || 0;
  const apiMode = get(apiModeState);
  if (!isNumber(batchSize) || batchSize <= 0 || batchSize > getMaxBatchSize(apiMode)) {
    return `The batch size must be between 1 and ${formatNumber(getMaxBatchSize(apiMode))}`;
  }
  return null;
});

const loadApiLimitsState = atom((get) => {
  const API_WARNING_CALLS = 250;
  const API_MAX_CALLS_FREE = 1000;
  const API_MAX_CALLS_PAID = 5000;

  if (isDesktop() || isBrowserExtension()) {
    return {
      warningApiCalls: API_WARNING_CALLS,
      maxApiCalls: Infinity,
    };
  }

  const hasPaidPlan = get(hasPaidPlanState);
  if (hasPaidPlan) {
    return {
      warningApiCalls: API_WARNING_CALLS,
      maxApiCalls: API_MAX_CALLS_PAID,
    };
  }

  return {
    warningApiCalls: API_WARNING_CALLS,
    maxApiCalls: API_MAX_CALLS_FREE,
  };
});

export const selectBatchApiLimitWarning = atom<string | null>((get) => {
  const { warningApiCalls } = get(loadApiLimitsState);
  const inputFileDataLength = get(inputFileDataState)?.length || 0;
  const batchSize = get(batchSizeState) || 1;

  if (inputFileDataLength && batchSize && inputFileDataLength / batchSize > warningApiCalls) {
    const numApiCalls = Math.round(inputFileDataLength / batchSize);
    return `Your configuration requires ${formatNumber(numApiCalls)} calls to Salesforce which will contribute to your API call limits.`;
  }
  return null;
});

export const selectBatchApiLimitError = atom<string | null>((get) => {
  const { maxApiCalls } = get(loadApiLimitsState);
  const inputFileDataLength = get(inputFileDataState)?.length || 0;
  const batchSize = get(batchSizeState) || 1;

  if (inputFileDataLength && batchSize && inputFileDataLength / batchSize > maxApiCalls) {
    const numApiCalls = Math.round(inputFileDataLength / batchSize);
    return (
      `Either your batch size is too low or you are loading in too many records. ` +
      `Your configuration would require ${formatNumber(numApiCalls)} calls to Salesforce, which exceeds the limit of ${formatNumber(maxApiCalls)}. ` +
      `Increase your batch size or reduce the number of records in your file.`
    );
  }
  return null;
});

export const selectTrialRunSizeError = atom<string | null>((get) => {
  const inputLength = get(inputFileDataState)?.length || 1;
  const trialRunSize = get(trialRunSizeState) || 1;
  if (!isNumber(trialRunSize) || trialRunSize <= 0 || trialRunSize >= inputLength) {
    return `Must be between 1 and ${formatNumber(inputLength - 1)}`;
  }
  return null;
});

export const selectBulkApiModeLabel = atom<string | React.ReactNode>((get) => {
  const inputFileDataLength = get(inputFileDataState)?.length || 0;
  const loadType = get(loadTypeState);
  return getLabelWithOptionalRecommended('Bulk API', inputFileDataLength > BATCH_RECOMMENDED_THRESHOLD, loadType === 'HARD_DELETE');
});

export const selectBatchApiModeLabel = atom<string | React.ReactNode>((get) => {
  const inputFileDataLength = get(inputFileDataState)?.length || 0;
  const hasZipAttachment = !!get(inputZipFileDataState);
  const loadType = get(loadTypeState);
  return getLabelWithOptionalRecommended(
    'Batch API',
    loadType !== 'HARD_DELETE' && inputFileDataLength <= BATCH_RECOMMENDED_THRESHOLD,
    hasZipAttachment,
  );
});

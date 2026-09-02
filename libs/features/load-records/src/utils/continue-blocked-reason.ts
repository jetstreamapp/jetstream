import { DescribeGlobalSObjectResult, FieldMapping, InsertUpdateUpsertDelete, Maybe } from '@jetstream/types';

/**
 * Builds the human-readable reason the "Continue" button on a Load Records step is disabled.
 *
 * Each step function returns `null` once every condition is satisfied, so callers derive the
 * disabled flag from the reason (`reason !== null`) — the message and the gate can never disagree.
 */

export interface SelectObjectAndFileStepState {
  selectedSObject: Maybe<Pick<DescribeGlobalSObjectResult, 'name'>>;
  inputFileData: Maybe<unknown[]>;
  loadType: Maybe<InsertUpdateUpsertDelete>;
  externalId: Maybe<string>;
  loadingFields: boolean;
}

export interface FieldMappingStepState {
  fieldMapping: Maybe<FieldMapping>;
  loadType: InsertUpdateUpsertDelete;
  externalId: Maybe<string>;
  isCustomMetadataObject: boolean;
  allowBinaryAttachment: boolean;
  inputZipFilename: Maybe<string>;
  binaryAttachmentBodyField: Maybe<string>;
}

/** The final step has no next step; the button stays disabled with this explanation. */
export const LAST_STEP_BLOCKED_REASON = 'This is the last step. Use Start Over to load another file.';

export function getSelectObjectAndFileBlockedReason({
  selectedSObject,
  inputFileData,
  loadType,
  externalId,
  loadingFields,
}: SelectObjectAndFileStepState): string | null {
  const requiredActions: string[] = [];
  if (!selectedSObject) {
    requiredActions.push('select an object');
  }
  if (!inputFileData) {
    requiredActions.push('upload a file');
  } else if (inputFileData.length === 0) {
    // Empty rows are stripped on parse, so a header-only file ends up here
    requiredActions.push('upload a file with at least one data row');
  }
  if (!loadType) {
    requiredActions.push('choose a load type');
  }
  if (loadType === 'UPSERT' && !externalId) {
    requiredActions.push('select an external Id field');
  }
  if (loadingFields) {
    requiredActions.push("wait for the object's fields to finish loading");
  }
  return toContinueSentence(requiredActions);
}

export function getFieldMappingBlockedReason({
  fieldMapping,
  loadType,
  externalId,
  isCustomMetadataObject,
  allowBinaryAttachment,
  inputZipFilename,
  binaryAttachmentBodyField,
}: FieldMappingStepState): string | null {
  const mappingItems = Object.values(fieldMapping || {});
  const isTargetFieldMapped = (targetField: Maybe<string>) => mappingItems.some((item) => item.targetField === targetField);
  const requiredActions: string[] = [];

  if (!mappingItems.some((item) => !!item.targetField)) {
    requiredActions.push('map at least one field');
  } else {
    // Custom metadata forces an upsert on DeveloperName, so a missing DeveloperName is reported once
    // here rather than again as the external Id below
    const missingRequiredFields: string[] = [];
    if (isCustomMetadataObject) {
      missingRequiredFields.push(...['DeveloperName', 'Label'].filter((requiredField) => !isTargetFieldMapped(requiredField)));
    }
    if (missingRequiredFields.length > 0) {
      requiredActions.push(`map the ${missingRequiredFields.join(' and ')} ${missingRequiredFields.length === 1 ? 'field' : 'fields'}`);
    }
    if (loadType === 'UPSERT' && !externalId) {
      requiredActions.push('select an external Id field on the previous step');
    } else if (loadType === 'UPSERT' && externalId && !missingRequiredFields.includes(externalId) && !isTargetFieldMapped(externalId)) {
      requiredActions.push(`map the external Id field ${externalId}`);
    }
    if (allowBinaryAttachment && inputZipFilename && !isTargetFieldMapped(binaryAttachmentBodyField)) {
      requiredActions.push(`map the ${binaryAttachmentBodyField || 'Body'} field for the attachments zip file`);
    }
  }

  const errorCount = countFieldMappingErrors(fieldMapping);
  if (errorCount > 0) {
    requiredActions.push(`resolve ${errorCount} mapping ${errorCount === 1 ? 'error' : 'errors'}`);
  }

  const incompleteLookupCount = mappingItems.filter((item) => item.mappedToLookup && !item.targetLookupField).length;
  if (incompleteLookupCount > 0) {
    requiredActions.push(
      `select a related field for ${incompleteLookupCount} lookup ${incompleteLookupCount === 1 ? 'mapping' : 'mappings'}`,
    );
  }

  return toContinueSentence(requiredActions);
}

/** Rows showing an error message (duplicate target field, record Id in an upsert) */
export function countFieldMappingErrors(fieldMapping: Maybe<FieldMapping>): number {
  return Object.values(fieldMapping || {}).filter((item) => !!item.fieldErrorMsg).length;
}

/**
 * Live-region text for the field mapping step. Empty when there is nothing to resolve so the
 * region stays mounted and only the message changes.
 */
export function getFieldMappingErrorStatusMessage(errorCount: number): string {
  if (errorCount === 0) {
    return '';
  }
  return `${errorCount} field mapping ${errorCount === 1 ? 'error' : 'errors'} to resolve`;
}

/** "select an object" + "upload a file" -> "Select an object and upload a file to continue" */
function toContinueSentence(requiredActions: string[]): string | null {
  if (requiredActions.length === 0) {
    return null;
  }
  let actionList: string;
  if (requiredActions.length <= 2) {
    actionList = requiredActions.join(' and ');
  } else {
    actionList = `${requiredActions.slice(0, -1).join(', ')}, and ${requiredActions[requiredActions.length - 1]}`;
  }
  return `${actionList.charAt(0).toUpperCase()}${actionList.slice(1)} to continue`;
}

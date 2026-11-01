import { FieldMapping, FieldMappingItemCsv } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  countFieldMappingErrors,
  FieldMappingStepState,
  getFieldMappingBlockedReason,
  getFieldMappingErrorStatusMessage,
  getSelectObjectAndFileBlockedReason,
  SelectObjectAndFileStepState,
} from '../continue-blocked-reason';

function csvMapping(csvField: string, overrides: Partial<FieldMappingItemCsv> = {}): FieldMappingItemCsv {
  return {
    type: 'CSV',
    csvField,
    targetField: null,
    mappedToLookup: false,
    fieldMetadata: undefined,
    lookupOptionUseFirstMatch: 'FIRST',
    lookupOptionNullIfNoMatch: false,
    isBinaryBodyField: false,
    ...overrides,
  };
}

describe('getSelectObjectAndFileBlockedReason', () => {
  const completeState: SelectObjectAndFileStepState = {
    selectedSObject: { name: 'Account' },
    inputFileData: [{ Name: 'Acme' }],
    loadType: 'INSERT',
    externalId: '',
    loadingFields: false,
  };

  it('returns null once an object is selected and a file with data is uploaded', () => {
    expect(getSelectObjectAndFileBlockedReason(completeState)).toBeNull();
  });

  it('asks for both the object and the file when neither is present', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, selectedSObject: null, inputFileData: null })).toBe(
      'Select an object and upload a file to continue',
    );
  });

  it('narrows to the object when only the object is missing', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, selectedSObject: undefined })).toBe('Select an object to continue');
  });

  it('narrows to the file when only the file is missing', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, inputFileData: null })).toBe('Upload a file to continue');
  });

  it('explains that a parsed file without data rows is not enough', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, inputFileData: [] })).toBe(
      'Upload a file with at least one data row to continue',
    );
  });

  it('asks for a load type when none is chosen', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, loadType: null })).toBe('Choose a load type to continue');
  });

  it('asks for an external Id only for an upsert without one', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, loadType: 'UPSERT', externalId: '' })).toBe(
      'Select an external Id field to continue',
    );
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, loadType: 'UPSERT', externalId: 'External_Id__c' })).toBeNull();
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, loadType: 'UPDATE', externalId: '' })).toBeNull();
  });

  it('asks the user to wait while the fields for the object are loading', () => {
    expect(getSelectObjectAndFileBlockedReason({ ...completeState, loadingFields: true })).toBe(
      "Wait for the object's fields to finish loading to continue",
    );
  });

  it('lists three or more outstanding conditions with an Oxford comma', () => {
    expect(
      getSelectObjectAndFileBlockedReason({
        ...completeState,
        selectedSObject: null,
        inputFileData: null,
        loadType: 'UPSERT',
        externalId: '',
      }),
    ).toBe('Select an object, upload a file, and select an external Id field to continue');
  });
});

describe('getFieldMappingBlockedReason', () => {
  const mappedName = csvMapping('Name', { targetField: 'Name' });
  const completeState: FieldMappingStepState = {
    fieldMapping: { Name: mappedName },
    loadType: 'INSERT',
    externalId: '',
    isCustomMetadataObject: false,
    allowBinaryAttachment: false,
    inputZipFilename: null,
    binaryAttachmentBodyField: null,
  };

  it('returns null once at least one field is mapped without errors', () => {
    expect(getFieldMappingBlockedReason(completeState)).toBeNull();
  });

  it('requires at least one mapped field', () => {
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: undefined })).toBe('Map at least one field to continue');
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: {} })).toBe('Map at least one field to continue');
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: { Name: csvMapping('Name') } })).toBe(
      'Map at least one field to continue',
    );
  });

  it('counts mapping errors with singular and plural wording', () => {
    const oneError: FieldMapping = {
      Name: mappedName,
      Id: csvMapping('Id', { targetField: 'Id', fieldErrorMsg: 'Including a Record Id in an upsert will cause the load to fail' }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: oneError })).toBe('Resolve 1 mapping error to continue');

    const twoErrors: FieldMapping = {
      Name: csvMapping('Name', { targetField: 'Name', fieldErrorMsg: 'Each Salesforce field should only be mapped once' }),
      'Account Name': csvMapping('Account Name', {
        targetField: 'Name',
        fieldErrorMsg: 'Each Salesforce field should only be mapped once',
      }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: twoErrors })).toBe('Resolve 2 mapping errors to continue');
  });

  it('combines the mapped-field requirement with mapping errors', () => {
    const fieldMapping: FieldMapping = { Name: csvMapping('Name', { fieldErrorMsg: 'Some error' }) };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping })).toBe(
      'Map at least one field and resolve 1 mapping error to continue',
    );
  });

  it('requires a related field for every lookup mapping that has none', () => {
    const oneLookup: FieldMapping = {
      Name: mappedName,
      Owner: csvMapping('Owner', { targetField: 'OwnerId', mappedToLookup: true, targetLookupField: undefined }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: oneLookup })).toBe(
      'Select a related field for 1 lookup mapping to continue',
    );

    const twoLookups: FieldMapping = {
      ...oneLookup,
      Parent: csvMapping('Parent', { targetField: 'ParentId', mappedToLookup: true }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: twoLookups })).toBe(
      'Select a related field for 2 lookup mappings to continue',
    );

    const configuredLookup: FieldMapping = {
      Name: mappedName,
      Owner: csvMapping('Owner', { targetField: 'OwnerId', mappedToLookup: true, targetLookupField: 'Username' }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping: configuredLookup })).toBeNull();
  });

  describe('custom metadata', () => {
    const customMetadataState: FieldMappingStepState = {
      ...completeState,
      isCustomMetadataObject: true,
      loadType: 'UPSERT',
      externalId: 'DeveloperName',
    };

    it('requires both DeveloperName and Label', () => {
      expect(getFieldMappingBlockedReason({ ...customMetadataState, fieldMapping: { Name: mappedName } })).toBe(
        'Map the DeveloperName and Label fields to continue',
      );
    });

    it('narrows to the missing field', () => {
      const missingLabel: FieldMapping = { DeveloperName: csvMapping('DeveloperName', { targetField: 'DeveloperName' }) };
      expect(getFieldMappingBlockedReason({ ...customMetadataState, fieldMapping: missingLabel })).toBe('Map the Label field to continue');

      const missingDeveloperName: FieldMapping = { Label: csvMapping('Label', { targetField: 'Label' }) };
      expect(getFieldMappingBlockedReason({ ...customMetadataState, fieldMapping: missingDeveloperName })).toBe(
        'Map the DeveloperName field to continue',
      );
    });

    it('returns null once both are mapped', () => {
      const fieldMapping: FieldMapping = {
        DeveloperName: csvMapping('DeveloperName', { targetField: 'DeveloperName' }),
        Label: csvMapping('Label', { targetField: 'Label' }),
      };
      expect(getFieldMappingBlockedReason({ ...customMetadataState, fieldMapping })).toBeNull();
    });
  });

  describe('upsert', () => {
    const upsertState: FieldMappingStepState = { ...completeState, loadType: 'UPSERT', externalId: 'External_Id__c' };

    it('requires the external Id field to be mapped', () => {
      expect(getFieldMappingBlockedReason(upsertState)).toBe('Map the external Id field External_Id__c to continue');
    });

    it('returns null once the external Id field is mapped', () => {
      const fieldMapping: FieldMapping = { ...upsertState.fieldMapping, ExtId: csvMapping('ExtId', { targetField: 'External_Id__c' }) };
      expect(getFieldMappingBlockedReason({ ...upsertState, fieldMapping })).toBeNull();
    });

    it('points back to the previous step when no external Id was chosen', () => {
      expect(getFieldMappingBlockedReason({ ...upsertState, externalId: '' })).toBe(
        'Select an external Id field on the previous step to continue',
      );
    });
  });

  describe('binary attachments', () => {
    const attachmentState: FieldMappingStepState = {
      ...completeState,
      allowBinaryAttachment: true,
      inputZipFilename: 'attachments.zip',
      binaryAttachmentBodyField: 'Body',
    };

    it('requires the body field once a zip file is provided', () => {
      expect(getFieldMappingBlockedReason(attachmentState)).toBe('Map the Body field for the attachments zip file to continue');
    });

    it('does not require the body field without a zip file', () => {
      expect(getFieldMappingBlockedReason({ ...attachmentState, inputZipFilename: null })).toBeNull();
    });

    it('returns null once the body field is mapped', () => {
      const fieldMapping: FieldMapping = { ...attachmentState.fieldMapping, Path: csvMapping('Path', { targetField: 'Body' }) };
      expect(getFieldMappingBlockedReason({ ...attachmentState, fieldMapping })).toBeNull();
    });
  });

  it('combines every outstanding condition into one sentence', () => {
    const fieldMapping: FieldMapping = {
      Name: csvMapping('Name', { targetField: 'Name', fieldErrorMsg: 'Each Salesforce field should only be mapped once' }),
      'Account Name': csvMapping('Account Name', {
        targetField: 'Name',
        fieldErrorMsg: 'Each Salesforce field should only be mapped once',
      }),
      Owner: csvMapping('Owner', { targetField: 'OwnerId', mappedToLookup: true }),
    };
    expect(getFieldMappingBlockedReason({ ...completeState, fieldMapping, loadType: 'UPSERT', externalId: 'External_Id__c' })).toBe(
      'Map the external Id field External_Id__c, resolve 2 mapping errors, and select a related field for 1 lookup mapping to continue',
    );
  });
});

describe('field mapping error status', () => {
  it('counts only rows with an error message', () => {
    expect(countFieldMappingErrors(undefined)).toBe(0);
    expect(countFieldMappingErrors({ Name: csvMapping('Name', { targetField: 'Name' }) })).toBe(0);
    expect(
      countFieldMappingErrors({
        Name: csvMapping('Name', { targetField: 'Name', fieldErrorMsg: 'Duplicate' }),
        Other: csvMapping('Other', { targetField: 'Name', fieldErrorMsg: 'Duplicate' }),
        Clean: csvMapping('Clean', { targetField: 'Clean__c' }),
      }),
    ).toBe(2);
  });

  it('builds an empty message when there is nothing to resolve', () => {
    expect(getFieldMappingErrorStatusMessage(0)).toBe('');
  });

  it('pluralizes the announcement', () => {
    expect(getFieldMappingErrorStatusMessage(1)).toBe('1 field mapping error to resolve');
    expect(getFieldMappingErrorStatusMessage(2)).toBe('2 field mapping errors to resolve');
  });
});

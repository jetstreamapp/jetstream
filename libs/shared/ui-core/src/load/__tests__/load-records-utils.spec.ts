import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import * as clientData from '@jetstream/shared/data';
import { sfdcFieldsFactory } from '@jetstream/test-utils';
import {
  EntityParticleRecord,
  FieldMapping,
  FieldMappingItem,
  FieldMappingItemCsv,
  LoadSavedMappingItem,
  PrepareDataPayload,
  QueryResults,
  SalesforceOrgUi,
} from '@jetstream/types';
import { vi } from 'vitest';
import {
  ADDITIONAL_MAPPING_PREFIX,
  autoMapFields,
  checkForDuplicateFieldMappings,
  initAdditionalFieldMappingItem,
  isAdditionalMapping,
  isStaticValuePlaceholder,
  loadFieldMappingFromSavedMapping,
  SavedFieldMapping,
  STATIC_MAPPING_PREFIX,
  transformData,
} from '../load-records-utils';

vi.mock('@jetstream/shared/data');

describe('autoMapFields', () => {
  test('should map fields based on exact header matches, ignoring extra fields', async () => {
    const org = { id: 'org1' } as unknown as SalesforceOrgUi;
    const fields = sfdcFieldsFactory.buildFieldsWithRelated();
    const inputHeader = ['ExtraField1', ...fields.map((field) => field.name), 'Extra Field 2'];

    const fieldMapping = await autoMapFields(org, inputHeader, fields, undefined, 'INSERT', undefined);

    expect(Object.keys(fieldMapping)).toEqual(inputHeader);
    expect(Object.keys(fieldMapping).length).toBe(inputHeader.length);
    expect(fieldMapping['Account']).toEqual(expect.objectContaining({ csvField: 'Account', targetField: 'Account' }));
    expect(fieldMapping['Account__c']).toEqual(expect.objectContaining({ csvField: 'Account__c', targetField: 'Account__c' }));
    expect(fieldMapping['Name']).toEqual(expect.objectContaining({ csvField: 'Name', targetField: 'Name' }));
    expect(fieldMapping['External_Id__c']).toEqual(expect.objectContaining({ csvField: 'External_Id__c', targetField: 'External_Id__c' }));
    expect(fieldMapping['Size']).toEqual(expect.objectContaining({ csvField: 'Size', targetField: 'Size' }));
    expect(fieldMapping['IsActive']).toEqual(expect.objectContaining({ csvField: 'IsActive', targetField: 'IsActive' }));
    expect(fieldMapping['CurrencyIsoCode']).toEqual(
      expect.objectContaining({ csvField: 'CurrencyIsoCode', targetField: 'CurrencyIsoCode' }),
    );
    expect(fieldMapping['ExtraField1']).toEqual(expect.objectContaining({ targetField: null, fieldMetadata: undefined }));
    expect(fieldMapping['Extra Field 2']).toEqual(expect.objectContaining({ targetField: null, fieldMetadata: undefined }));
  });

  test('should map based on field labels and API names', async () => {
    const org = { id: 'org1' } as unknown as SalesforceOrgUi;
    const fields = [
      sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
        label: 'Name',
        name: 'Name',
        type: 'string',
        field: { ...sfdcFieldsFactory.buildStringField('Name'), typeLabel: 'test' },
      }),
      sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
        label: 'LAST NAME',
        name: 'LAST_NAME',
        type: 'string',
        field: { ...sfdcFieldsFactory.buildStringField('LAST_NAME'), typeLabel: 'test' },
      }),
      sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
        label: 'first     name',
        name: 'first_n_a_m_e',
        type: 'string',
        field: { ...sfdcFieldsFactory.buildStringField('first_n_a_m_e'), typeLabel: 'test' },
      }),
    ];

    const inputHeader = ['nAME', 'Last! Name!', 'FIRST_NAME'];

    const fieldMapping = await autoMapFields(org, inputHeader, fields, undefined, 'INSERT', undefined);

    expect(Object.keys(fieldMapping)).toEqual(inputHeader);
    expect(Object.keys(fieldMapping).length).toBe(inputHeader.length);
    expect(fieldMapping['nAME']).toEqual(expect.objectContaining({ csvField: 'nAME', targetField: 'Name' }));
    expect(fieldMapping['Last! Name!']).toEqual(expect.objectContaining({ csvField: 'Last! Name!', targetField: 'LAST_NAME' }));
    expect(fieldMapping['FIRST_NAME']).toEqual(expect.objectContaining({ csvField: 'FIRST_NAME', targetField: 'first_n_a_m_e' }));
  });

  describe('Relationship Fields', () => {
    test('Basic related fields', async () => {
      const queryResultsAccount: QueryResults<EntityParticleRecord> = {
        queryResults: {
          done: true,
          totalSize: 5,
          records: [
            sfdcFieldsFactory.sfdcEntityParticleRecordFactory.build({ EntityDefinitionId: 'Account', Name: 'Id' }),
            sfdcFieldsFactory.sfdcEntityParticleRecordFactory.build({ EntityDefinitionId: 'Account', Name: 'Name' }),
            sfdcFieldsFactory.sfdcEntityParticleRecordFactory.build({ EntityDefinitionId: 'Account', Name: 'Foo__c' }),
          ],
        },
      };
      const queryResultsContact: QueryResults<EntityParticleRecord> = {
        queryResults: {
          done: true,
          totalSize: 5,
          records: [
            sfdcFieldsFactory.sfdcEntityParticleRecordFactory.build({ EntityDefinitionId: 'Contact', Name: 'Id' }),
            sfdcFieldsFactory.sfdcEntityParticleRecordFactory.build({ EntityDefinitionId: 'Contact', Name: 'Name' }),
          ],
        },
      };

      (clientData.queryAllWithCacheUsingOffset as any)
        .mockResolvedValue(queryResultsAccount)
        // Account.Name
        .mockResolvedValueOnce(queryResultsAccount)
        // Account__c.Foo__c
        .mockResolvedValueOnce(queryResultsAccount)
        // Random__r.Id
        .mockResolvedValueOnce(queryResultsContact);

      const org = { id: 'org1' } as unknown as SalesforceOrgUi;
      const fields = [
        sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
          label: 'Account',
          name: 'Account',
          type: 'reference',
          referenceTo: ['Account'],
          relationshipName: 'Account',
          field: { ...sfdcFieldsFactory.buildLookupField('Account'), typeLabel: 'Lookup(Account)' },
        }),
        sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
          label: 'Account (2)',
          name: 'Account__c',
          type: 'reference',
          referenceTo: ['Account'],
          relationshipName: 'Account__r',
          field: { ...sfdcFieldsFactory.buildLookupField('Account'), typeLabel: 'Lookup(Account)' },
        }),
        sfdcFieldsFactory.sfdcFieldWithRelatedTypesFactory.build({
          label: 'My Fancy Contact',
          name: 'Random__c',
          type: 'reference',
          referenceTo: ['Contact'],
          relationshipName: 'Random__r',
          field: { ...sfdcFieldsFactory.buildLookupField('Contact'), typeLabel: 'Lookup(Contact)' },
        }),
      ];

      const inputHeader = ['Account.Name', 'Account__c.Foo__c', 'Random__r.Id', 'Unknown__r.Field'];

      const fieldMapping = await autoMapFields(org, inputHeader, fields, undefined, 'INSERT', undefined);

      expect(Object.keys(fieldMapping)).toEqual(inputHeader);
      expect(Object.keys(fieldMapping).length).toBe(inputHeader.length);

      expect(fieldMapping['Account.Name']).toEqual(
        expect.objectContaining({
          csvField: 'Account.Name',
          targetField: 'Account',
          mappedToLookup: true,
          targetLookupField: 'Name',
          relationshipName: 'Account',
          selectedReferenceTo: 'Account',
        }),
      );

      expect(fieldMapping['Account__c.Foo__c']).toEqual(
        expect.objectContaining({
          csvField: 'Account__c.Foo__c',
          targetField: 'Account__c',
          mappedToLookup: true,
          targetLookupField: 'Foo__c',
          relationshipName: 'Account__r',
          selectedReferenceTo: 'Account',
        }),
      );

      expect(fieldMapping['Random__r.Id']).toEqual(
        expect.objectContaining({
          csvField: 'Random__r.Id',
          targetField: 'Random__c',
          mappedToLookup: true,
          targetLookupField: 'Id',
          relationshipName: 'Random__r',
          selectedReferenceTo: 'Contact',
        }),
      );

      expect(fieldMapping['Unknown__r.Field']).toEqual(
        expect.objectContaining({
          csvField: 'Unknown__r.Field',
          targetField: null,
          fieldMetadata: undefined,
        }),
      );
    });
  });
});

function buildCsvMappingItem(overrides: Partial<FieldMappingItemCsv> & { csvField: string }): FieldMappingItemCsv {
  return {
    type: 'CSV',
    targetField: null,
    mappedToLookup: false,
    fieldMetadata: undefined,
    selectedReferenceTo: undefined,
    lookupOptionUseFirstMatch: 'ERROR_IF_MULTIPLE',
    lookupOptionNullIfNoMatch: false,
    isBinaryBodyField: false,
    ...overrides,
  };
}

function getPayload(overrides: Partial<PrepareDataPayload>): PrepareDataPayload {
  return {
    org: { id: 'org1' } as unknown as SalesforceOrgUi,
    data: [],
    fieldMapping: {},
    sObject: 'Account',
    dateFormat: 'MM-DD-YYYY',
    apiMode: 'BATCH',
    ...overrides,
  };
}

describe('transformData', () => {
  const [accountField, , nameField, externalIdField] = sfdcFieldsFactory.buildFieldsWithRelated();

  test('should read values from csvField instead of the mapping key', async () => {
    const fieldMapping: FieldMapping = {
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'Name',
        fieldMetadata: nameField,
      }),
    };

    const [record] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping }));

    expect(record.Name).toBe('Acme Corp');
  });

  test('should map one file column to multiple Salesforce fields', async () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'External_Id__c',
        fieldMetadata: externalIdField,
      }),
    };

    const [batchRecord] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping }));
    expect(batchRecord).toEqual(expect.objectContaining({ Name: 'Acme Corp', External_Id__c: 'Acme Corp' }));

    const [bulkRecord] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping, apiMode: 'BULK' }));
    expect(bulkRecord).toEqual(expect.objectContaining({ Name: 'Acme Corp', External_Id__c: 'Acme Corp' }));
  });

  test('should set the batch api attributes exactly once', async () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'External_Id__c',
        fieldMetadata: externalIdField,
      }),
    };

    const [record] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping }));

    expect(record.attributes).toEqual({ type: 'Account' });
  });

  test('should use the static value for static mappings and the row value for csv mappings', async () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${STATIC_MAPPING_PREFIX}1`]: {
        type: 'STATIC',
        csvField: `${STATIC_MAPPING_PREFIX}1`,
        staticValue: 'Imported',
        targetField: 'External_Id__c',
        mappedToLookup: false,
        fieldMetadata: externalIdField,
        lookupOptionUseFirstMatch: 'ERROR_IF_MULTIPLE',
        lookupOptionNullIfNoMatch: false,
        isBinaryBodyField: false,
      },
    };

    const [record] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping }));

    expect(record).toEqual(expect.objectContaining({ Name: 'Acme Corp', External_Id__c: 'Imported' }));
  });

  test('should emit a nested relationship object for an additional mapping to an external id lookup using the batch api', async () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'Account',
        fieldMetadata: accountField,
        mappedToLookup: true,
        relationshipName: 'Account',
        targetLookupField: 'External_Id__c',
        selectedReferenceTo: 'Account',
        relatedFieldMetadata: { name: 'External_Id__c', label: 'External Id', type: 'string', isExternalId: true },
      }),
    };

    const [record] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping }));

    expect(record.Name).toBe('Acme Corp');
    expect(record.Account).toEqual({ External_Id__c: 'Acme Corp' });
  });

  test('should emit a flattened relationship column for an additional mapping to an external id lookup using the bulk api', async () => {
    const fieldMapping: FieldMapping = {
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'Account',
        fieldMetadata: accountField,
        mappedToLookup: true,
        relationshipName: 'Account',
        targetLookupField: 'External_Id__c',
        selectedReferenceTo: 'Account',
        relatedFieldMetadata: { name: 'External_Id__c', label: 'External Id', type: 'string', isExternalId: true },
      }),
    };

    const [record] = await transformData(getPayload({ data: [{ Company: 'Acme Corp' }], fieldMapping, apiMode: 'BULK' }));

    expect(record['Account.External_Id__c']).toBe('Acme Corp');
  });

  test('should apply insertNulls per target field when one column maps to both a text field and a checkbox', async () => {
    const checkboxField = sfdcFieldsFactory.buildFieldsWithRelated().find((field) => field.type === 'boolean');
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'IsActive',
        fieldMetadata: checkboxField,
      }),
    };

    const [batchRecord] = await transformData(getPayload({ data: [{ Company: '' }], fieldMapping, insertNulls: true }));
    expect(batchRecord.Name).toBeNull();
    expect(batchRecord.IsActive).toBe(false);

    const [bulkRecord] = await transformData(getPayload({ data: [{ Company: '' }], fieldMapping, insertNulls: true, apiMode: 'BULK' }));
    expect(bulkRecord.Name).toBe(SFDC_BULK_API_NULL_VALUE);
    expect(bulkRecord.IsActive).toBe(false);
  });

  test('should omit blank values entirely for the batch api when insertNulls is false', async () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name', fieldMetadata: nameField }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'External_Id__c',
        fieldMetadata: externalIdField,
      }),
    };

    const [record] = await transformData(getPayload({ data: [{ Company: '' }], fieldMapping }));

    expect(record).not.toHaveProperty('Name');
    expect(record).not.toHaveProperty('External_Id__c');
  });
});

describe('checkForDuplicateFieldMappings', () => {
  test('should not flag two rows that share a file column but map to different Salesforce fields', () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name' }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({ csvField: 'Company', targetField: 'External_Id__c' }),
    };

    const result = checkForDuplicateFieldMappings(fieldMapping);

    expect(result['Company'].isDuplicateMappedField).toBe(false);
    expect(result[`${ADDITIONAL_MAPPING_PREFIX}1`].isDuplicateMappedField).toBe(false);
    expect(result['Company'].fieldErrorMsg).toBeUndefined();
  });

  test('should still flag two rows that map to the same Salesforce field', () => {
    const fieldMapping: FieldMapping = {
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name' }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name' }),
    };

    const result = checkForDuplicateFieldMappings(fieldMapping);

    expect(result['Company'].isDuplicateMappedField).toBe(true);
    expect(result[`${ADDITIONAL_MAPPING_PREFIX}1`].isDuplicateMappedField).toBe(true);
    expect(result['Company'].fieldErrorMsg).toBe('Each Salesforce field should only be mapped once');
  });
});

describe('initAdditionalFieldMappingItem', () => {
  test('should mint a unique synthetic key that points at the real file column', () => {
    const first = initAdditionalFieldMappingItem('Company');
    const second = initAdditionalFieldMappingItem('Company');

    expect(first.mappingKey).toMatch(ADDITIONAL_MAPPING_PREFIX);
    expect(first.mappingKey).not.toEqual(second.mappingKey);
    expect(first.fieldMappingItem).toEqual(expect.objectContaining({ type: 'CSV', csvField: 'Company', targetField: null }));
    expect(isAdditionalMapping(first.mappingKey, first.fieldMappingItem)).toBe(true);
  });
});

describe('isStaticValuePlaceholder', () => {
  test('should only match the placeholder static rows store in csvField', () => {
    expect(isStaticValuePlaceholder(`${STATIC_MAPPING_PREFIX}1`)).toBe(true);
    expect(isStaticValuePlaceholder('Company')).toBe(false);
    // additional mappings record the real column, so they must stay in the column-availability check
    expect(isStaticValuePlaceholder(initAdditionalFieldMappingItem('Company').fieldMappingItem.csvField)).toBe(false);
  });
});

describe('loadFieldMappingFromSavedMapping', () => {
  const fields = sfdcFieldsFactory.buildFieldsWithRelated();

  function getSavedMapping(mapping: SavedFieldMapping): LoadSavedMappingItem {
    return { mapping } as unknown as LoadSavedMappingItem;
  }

  test('should restore an additional mapping when the file still has its column', () => {
    const savedMapping = getSavedMapping({
      Company: buildCsvMappingItem({ csvField: 'Company', targetField: 'Name' }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({ csvField: 'Company', targetField: 'External_Id__c' }),
    });

    const result = loadFieldMappingFromSavedMapping(savedMapping, ['Company'], fields, undefined);

    const additional = Object.entries(result).filter(([key]) => key.startsWith(ADDITIONAL_MAPPING_PREFIX));
    expect(additional).toHaveLength(1);
    expect(additional[0][1]).toEqual(expect.objectContaining({ type: 'CSV', csvField: 'Company', targetField: 'External_Id__c' }));
    expect(additional[0][1].fieldMetadata).toEqual(expect.objectContaining({ name: 'External_Id__c' }));
    expect(result['Company'].targetField).toBe('Name');
  });

  test('should drop an additional mapping when the file no longer has its column', () => {
    const savedMapping = getSavedMapping({
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({ csvField: 'Company', targetField: 'External_Id__c' }),
    });

    const result = loadFieldMappingFromSavedMapping(savedMapping, ['SomethingElse'], fields, undefined);

    expect(Object.keys(result).filter((key) => key.startsWith(ADDITIONAL_MAPPING_PREFIX))).toHaveLength(0);
  });

  test('should re-key synthetic rows so a later uniqueId cannot overwrite them', () => {
    const savedMapping = getSavedMapping({
      [`${STATIC_MAPPING_PREFIX}1`]: {
        ...buildCsvMappingItem({ csvField: `${STATIC_MAPPING_PREFIX}1`, targetField: 'Name' }),
        type: 'STATIC',
        staticValue: 'Imported',
      },
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({ csvField: 'Company', targetField: 'External_Id__c' }),
    });

    const result = loadFieldMappingFromSavedMapping(savedMapping, ['Company'], fields, undefined);

    const [staticKey, staticItem] = Object.entries(result).find(([key]) => key.startsWith(STATIC_MAPPING_PREFIX)) as [
      string,
      FieldMappingItem,
    ];
    const [duplicateKey] = Object.entries(result).find(([key]) => key.startsWith(ADDITIONAL_MAPPING_PREFIX)) as [string, FieldMappingItem];

    expect(staticKey).not.toBe(`${STATIC_MAPPING_PREFIX}1`);
    expect(duplicateKey).not.toBe(`${ADDITIONAL_MAPPING_PREFIX}1`);
    // static rows use their key as the csvField placeholder, so both must move together
    expect(staticItem.csvField).toBe(staticKey);
  });

  test('should clear validation state so a mapping saved while in an error state is not permanently broken', () => {
    const savedMapping = getSavedMapping({
      Company: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'Name',
        fieldErrorMsg: 'Including a Record Id in an upsert will cause the load to fail',
        isDuplicateMappedField: true,
      }),
      [`${ADDITIONAL_MAPPING_PREFIX}1`]: buildCsvMappingItem({
        csvField: 'Company',
        targetField: 'External_Id__c',
        fieldErrorMsg: 'This field is mapped more than once',
        isDuplicateMappedField: true,
      }),
    });

    const result = loadFieldMappingFromSavedMapping(savedMapping, ['Company'], fields, undefined);

    const [, additionalItem] = Object.entries(result).find(([key]) => key.startsWith(ADDITIONAL_MAPPING_PREFIX)) as [
      string,
      FieldMappingItem,
    ];

    expect(result['Company'].fieldErrorMsg).toBeUndefined();
    expect(result['Company'].isDuplicateMappedField).toBe(false);
    expect(additionalItem.fieldErrorMsg).toBeUndefined();
    expect(additionalItem.isDuplicateMappedField).toBe(false);
  });

  test('should force csvField to the header so a stale saved value cannot redirect the transform', () => {
    const savedMapping = getSavedMapping({
      Company: buildCsvMappingItem({ csvField: 'SomethingStale', targetField: 'Name' }),
    });

    const result = loadFieldMappingFromSavedMapping(savedMapping, ['Company'], fields, undefined);

    expect(result['Company'].csvField).toBe('Company');
  });
});

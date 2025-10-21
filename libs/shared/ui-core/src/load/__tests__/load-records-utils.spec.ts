import * as clientData from '@jetstream/shared/data';
import { sfdcFieldsFactory } from '@jetstream/test-utils';
import { EntityParticleRecord, QueryResults, SalesforceOrgUi } from '@jetstream/types';
import { autoMapFields } from '../load-records-utils';

jest.mock('@jetstream/shared/data');

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

import { Field, FieldType, PicklistFieldValues } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { convertMetadataToEditableFields, removeUnavailablePicklistValues } from '../ui-record-form-utils';

function getField(name: string, type: FieldType): Field {
  return { name, type, label: `${name} label` } as Field;
}

function getPicklistValues(fieldName: string, values: string[]): PicklistFieldValues {
  return {
    [fieldName]: {
      eTag: '',
      url: '',
      controllerValues: {},
      defaultValue: null,
      values: values.map((value) => ({ attributes: null, label: value, value, validFor: null })),
    },
  };
}

describe('convertMetadataToEditableFields', () => {
  it('should sort Id, Name and RecordTypeId to the top, followed by the remaining fields', () => {
    const fields = [
      getField('Amount__c', 'currency'),
      getField('Name', 'string'),
      getField('RecordTypeId', 'reference'),
      getField('Description', 'textarea'),
      getField('Id', 'id'),
    ];

    const editableFields = convertMetadataToEditableFields(fields, {}, 'edit', {});

    expect(editableFields.map(({ name }) => name)).toEqual(['Id', 'Name', 'RecordTypeId', 'Amount__c', 'Description']);
  });

  it('should sort RecordTypeId to the top for objects without a Name field', () => {
    const fields = [getField('Amount__c', 'currency'), getField('RecordTypeId', 'reference'), getField('Id', 'id')];

    const editableFields = convertMetadataToEditableFields(fields, {}, 'edit', {});

    expect(editableFields.map(({ name }) => name)).toEqual(['Id', 'RecordTypeId', 'Amount__c']);
  });

  it('should leave the sort order alone when there is no RecordTypeId field', () => {
    const fields = [getField('Amount__c', 'currency'), getField('Name', 'string'), getField('Id', 'id')];

    const editableFields = convertMetadataToEditableFields(fields, {}, 'edit', {});

    expect(editableFields.map(({ name }) => name)).toEqual(['Id', 'Name', 'Amount__c']);
  });
});

describe('removeUnavailablePicklistValues', () => {
  const fields = [
    getField('Name', 'string'),
    getField('Description', 'textarea'),
    getField('IsActive', 'boolean'),
    getField('Status__c', 'picklist'),
    getField('Categories__c', 'multipicklist'),
  ];

  it('should retain all non-picklist values', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(fields, getPicklistValues('Status__c', ['New']), {
      Name: 'Test Record',
      Description: 'Some description',
      IsActive: true,
    });

    expect(record).toEqual({ Name: 'Test Record', Description: 'Some description', IsActive: true });
    expect(fieldsWithClearedValues).toEqual([]);
  });

  it('should retain picklist values that are still available', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(
      fields,
      getPicklistValues('Status__c', ['New', 'Working']),
      { Name: 'Test Record', Status__c: 'Working' },
    );

    expect(record).toEqual({ Name: 'Test Record', Status__c: 'Working' });
    expect(fieldsWithClearedValues).toEqual([]);
  });

  it('should remove picklist values that are not available and keep everything else', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(fields, getPicklistValues('Status__c', ['New']), {
      Name: 'Test Record',
      IsActive: false,
      Status__c: 'Working',
    });

    expect(record).toEqual({ Name: 'Test Record', IsActive: false });
    expect(fieldsWithClearedValues.map(({ name }) => name)).toEqual(['Status__c']);
  });

  it('should remove picklist values for fields that have no available values', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(fields, {}, { Name: 'Test Record', Status__c: 'Working' });

    expect(record).toEqual({ Name: 'Test Record' });
    expect(fieldsWithClearedValues.map(({ name }) => name)).toEqual(['Status__c']);
  });

  it('should retain the available portion of a multi-select picklist', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(
      fields,
      getPicklistValues('Categories__c', ['One', 'Three']),
      { Categories__c: 'One;Two;Three' },
    );

    expect(record).toEqual({ Categories__c: 'One;Three' });
    expect(fieldsWithClearedValues.map(({ name }) => name)).toEqual(['Categories__c']);
  });

  it('should not modify empty or undefined values', () => {
    const { record, fieldsWithClearedValues } = removeUnavailablePicklistValues(fields, getPicklistValues('Status__c', ['New']), {
      Name: '',
      Status__c: '',
      Categories__c: undefined,
    });

    expect(record).toEqual({ Name: '', Status__c: '', Categories__c: undefined });
    expect(fieldsWithClearedValues).toEqual([]);
  });
});

import { ReadMetadataRecordTypeExtended } from '@jetstream/types';
import { getObjectWithRecordTypesXml } from '../record-types.utils';

const TEST_DATA: { 'Contact.Record_Type_1': ReadMetadataRecordTypeExtended; 'Contact.Record_Type_2': ReadMetadataRecordTypeExtended } = {
  'Contact.Record_Type_1': {
    sobject: 'Contact',
    recordType: 'Record_Type_1',
    '@xsi:type': 'RecordType',
    fullName: 'Contact.Record_Type_1',
    active: true,
    description: '123',
    label: 'Record Type 1',
    picklistValues: [
      {
        fieldName: 'LeadSource',
        picklist: 'LeadSource',
        values: [
          {
            fullName: 'Other',
            default: 'false',
          },
          {
            fullName: 'Partner Referral',
            default: 'false',
          },
          {
            fullName: 'Phone Inquiry',
            default: 'false',
          },
          {
            fullName: 'Purchased List',
            default: 'false',
          },
          {
            fullName: 'Web',
            default: 'false',
          },
        ],
      },
      {
        fieldName: 'Level__c',
        picklist: 'Level__c',
        values: [
          {
            fullName: 'Primary',
            default: 'false',
          },
          {
            fullName: 'Secondary',
            default: 'false',
          },
          {
            fullName: 'Tertiary',
            default: 'false',
          },
        ],
      },
    ],
  },
  'Contact.Record_Type_2': {
    sobject: 'Contact',
    recordType: 'Record_Type_2',
    '@xsi:type': 'RecordType',
    fullName: 'Contact.Record_Type_2',
    active: true,
    label: 'Record Type 2',
    picklistValues: [
      {
        fieldName: 'LeadSource',
        picklist: 'LeadSource',
        values: [
          {
            fullName: 'Other',
            default: 'false',
          },
          {
            fullName: 'Partner Referral',
            default: 'false',
          },
          {
            fullName: 'Phone Inquiry',
            default: 'false',
          },
          {
            fullName: 'Purchased List',
            default: 'false',
          },
          {
            fullName: 'Web',
            default: 'false',
          },
        ],
      },
    ],
  },
};

describe('getObjectWithRecordTypesXml', () => {
  it('should work', () => {
    const recordTypeXml = getObjectWithRecordTypesXml(Object.values(TEST_DATA));
    expect(recordTypeXml).toEqual(
      [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">`,
        generateRecordTypeXml(TEST_DATA['Contact.Record_Type_1']),
        generateRecordTypeXml(TEST_DATA['Contact.Record_Type_2']),
        `</CustomObject>`,
      ].join(''),
    );
  });
});

function generateRecordTypeXml({ active, recordType, label, picklistValues, description }: ReadMetadataRecordTypeExtended) {
  let output = '<recordTypes>';
  output += `<fullName>${recordType}</fullName>`;
  output += `<active>${active}</active>`;
  if (description) {
    output += `<description>${description}</description>`;
  }
  output += `<label>${label}</label>`;
  picklistValues.forEach(({ fieldName, picklist, values }) => {
    output += `<picklistValues>`;
    output += `<picklist>${picklist}</picklist>`;
    values.forEach(({ fullName, default: isDefault }) => {
      output += `<values>`;
      output += `<fullName>${fullName}</fullName>`;
      output += `<default>${isDefault}</default>`;
      output += `</values>`;
    });
    output += `</picklistValues>`;
  });
  output += `</recordTypes>`;
  return output;
}

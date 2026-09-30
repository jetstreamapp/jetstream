import { ReadMetadataRecordTypeExtended } from '@jetstream/types';
import JSZip from 'jszip';
import { RecordTypePicklistSummary } from '../../types/record-types.types';
import { getObjectWithRecordTypesXml, prepareRecordTypeMetadataPackage } from '../record-types.utils';

const TEST_DATA: { 'Contact.Record_Type_1': ReadMetadataRecordTypeExtended; 'Contact.Record_Type_2': ReadMetadataRecordTypeExtended } = {
  'Contact.Record_Type_1': {
    sobject: 'Contact',
    recordType: 'Record_Type_1',
    '@_type': 'RecordType',
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
    '@_type': 'RecordType',
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

/**
 * The output is indented, the expected value is built without whitespace between tags
 */
function removeIndentation(xml: string) {
  return xml.replace(/>\s*\n\s*</g, '><').trim();
}

describe('getObjectWithRecordTypesXml', () => {
  it('should work', () => {
    const recordTypeXml = removeIndentation(getObjectWithRecordTypesXml(Object.values(TEST_DATA)));
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

describe('prepareRecordTypeMetadataPackage', () => {
  const modifiedValues: RecordTypePicklistSummary[] = [
    {
      sobject: 'Contact',
      sobjectLabel: 'Contact',
      field: 'LeadSource',
      fieldLabel: 'Lead Source',
      recordType: 'Record_Type_2',
      recordTypeFullName: 'Contact.Record_Type_2',
      recordTypeLabel: 'Record Type 2',
      values: new Set(['Other', 'Web']),
      defaultValue: 'Web',
      isValid: true,
    },
  ];

  it('should produce a package.xml and object file for the modified record types only', async () => {
    const file = await prepareRecordTypeMetadataPackage({
      apiVersion: 'v66.0',
      recordTypesByFullName: TEST_DATA,
      modifiedValues,
    });
    const zip = await JSZip.loadAsync(file);

    expect(Object.keys(zip.files).filter((name) => !zip.files[name].dir)).toEqual(['package.xml', 'objects/Contact.object']);
    expect(removeIndentation(await zip.file('package.xml')!.async('string'))).toEqual(
      [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`,
        `<types><members>Contact.Record_Type_2</members><name>RecordType</name></types>`,
        `<version>66.0</version>`,
        `</Package>`,
      ].join(''),
    );
  });

  it('should only include the modified values and their default, without any extra properties', async () => {
    const file = await prepareRecordTypeMetadataPackage({
      apiVersion: 'v66.0',
      recordTypesByFullName: TEST_DATA,
      modifiedValues,
    });
    const zip = await JSZip.loadAsync(file);
    const objectXml = removeIndentation(await zip.file('objects/Contact.object')!.async('string'));

    expect(objectXml).toContain(
      `<picklistValues><picklist>LeadSource</picklist>` +
        `<values><fullName>Other</fullName><default>false</default></values>` +
        `<values><fullName>Web</fullName><default>true</default></values>` +
        `</picklistValues>`,
    );
    expect(objectXml).not.toContain('<fieldName');
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

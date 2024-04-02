import { DATE_FORMATS } from '@jetstream/shared/constants';
import { buildDateFromString, getExcelSafeSheetName, getFullNameFromListMetadata, nullifyEmptyStrings } from '../utils';

describe('utils.getExcelSafeSheetName', () => {
  it('should handle simple cases', () => {
    expect(getExcelSafeSheetName('')).toEqual('Sheet0');
    expect(getExcelSafeSheetName('records')).toEqual('records');
  });

  it('should handle truncation cases', () => {
    expect(getExcelSafeSheetName('recordsrecordsrecordsrecordsrecordsrecords')).toEqual('recordsrecordsrecordsrecordsrec');
  });

  it('should handle duplicate cases', () => {
    expect(getExcelSafeSheetName('Accounts', ['Accounts'])).toEqual('Accounts1');
    expect(getExcelSafeSheetName('Accounts', ['Accounts', 'Accounts1'])).toEqual('Accounts2');
  });

  it('should handle truncation and duplicate cases', () => {
    expect(getExcelSafeSheetName('recordsrecordsrecordsrecordsrecordsrecords', ['recordsrecordsrecordsrecordsrec'])).toEqual(
      'recordsrecordsrecordsrecordsre1'
    );
    expect(
      getExcelSafeSheetName('recordsrecordsrecordsrecordsrecordsrecords', [
        'recordsrecordsrecordsrecordsrec',
        'recordsrecordsrecordsrecordsre1',
        'recordsrecordsrecordsrecordsre2',
        'recordsrecordsrecordsrecordsre3',
        'recordsrecordsrecordsrecordsre5',
        'recordsrecordsrecordsrecordsre6',
        'recordsrecordsrecordsrecordsre7',
        'recordsrecordsrecordsrecordsre8',
        'recordsrecordsrecordsrecordsre9',
        'recordsrecordsrecordsrecordsr10',
        'recordsrecordsrecordsrecordsr11',
        'recordsrecordsrecordsrecordsr12',
      ])
    ).toEqual('recordsrecordsrecordsrecordsr13');
  });
});

describe('utils.getFullNameFromListMetadata', () => {
  it('Should convert layout name', () => {
    expect(
      getFullNameFromListMetadata({
        fullName: 'SBQQ__AttributeSet__c-Attribute Set Layout',
        metadataType: 'Layout',
        namespace: 'SBQQ',
      })
    ).toEqual('SBQQ__AttributeSet__c-SBQQ__Attribute Set Layout');
  });
  it('Should not double add namespace if already correct', () => {
    expect(
      getFullNameFromListMetadata({
        fullName: 'SBQQ__AttributeSet__c-SBQQ__Attribute Set Layout',
        metadataType: 'Layout',
        namespace: 'SBQQ',
      })
    ).toEqual('SBQQ__AttributeSet__c-SBQQ__Attribute Set Layout');
  });
  it('Should not add namespace if non-managed', () => {
    expect(
      getFullNameFromListMetadata({
        fullName: 'AttributeSet__c-Attribute Set Layout',
        metadataType: 'Layout',
        namespace: null,
      })
    ).toEqual('AttributeSet__c-Attribute Set Layout');
  });
  it('Should not apply to other managed package types', () => {
    expect(
      getFullNameFromListMetadata({
        fullName: 'AttributeSet__c-Attribute Set Layout',
        metadataType: 'ApexClass',
        namespace: 'TEST',
      })
    ).toEqual('AttributeSet__c-Attribute Set Layout');
  });
});

describe('utils.nullifyEmptyStrings', () => {
  it('should nullify empty strings in a map', () => {
    const input = {
      name: 'John',
      age: '',
      address: {
        street: '123 Main St',
        city: '',
        postalCode: '      ',
        state: 'CA',
      },
    };

    const expectedOutput = {
      name: 'John',
      age: null,
      address: {
        street: '123 Main St',
        city: null,
        postalCode: null,
        state: 'CA',
      },
    };

    expect(nullifyEmptyStrings(input)).toEqual(expectedOutput);
  });

  it('should nullify empty strings in a map without trimming', () => {
    const input = {
      name: 'John',
      age: '',
      address: {
        street: '123 Main St',
        city: '',
        postalCode: '      ',
        state: 'CA',
      },
    };

    const expectedOutput = {
      name: 'John',
      age: null,
      address: {
        street: '123 Main St',
        city: null,
        postalCode: '      ',
        state: 'CA',
      },
    };

    expect(nullifyEmptyStrings(input, false)).toEqual(expectedOutput);
  });

  it('should return the same map if it is null or undefined', () => {
    expect(nullifyEmptyStrings(null as any)).toBeNull();
    expect(nullifyEmptyStrings(undefined as any)).toBeUndefined();
  });
});

describe('utils.buildDateFromString', () => {
  it('should correctly build date from string in MM-DD-YYYY format', () => {
    const date = buildDateFromString('01-31-2022', DATE_FORMATS.MM_DD_YYYY, 'date');
    expect(date).toEqual('2022-01-31');
  });

  it('should correctly build date from string in DD-MM-YYYY format', () => {
    const date = buildDateFromString('31-01-2022', DATE_FORMATS.DD_MM_YYYY, 'date');
    expect(date).toEqual('2022-01-31');
  });

  it('should correctly build date from string in YYYY-MM-DD format', () => {
    const date = buildDateFromString('2022-01-31', DATE_FORMATS.YYYY_MM_DD, 'date');
    expect(date).toEqual('2022-01-31');
  });

  it('should return null for invalid date string', () => {
    const date = buildDateFromString('invalid-date', DATE_FORMATS.MM_DD_YYYY, 'date');
    expect(date).toBeNull();
  });

  it('should return null for invalid date format', () => {
    const date = buildDateFromString('01-31-2022', 'invalid-format', 'date');
    expect(date).toBeNull();
  });

  it('should correctly build date from string with complete representation', () => {
    const date = buildDateFromString('01-31-2022', DATE_FORMATS.MM_DD_YYYY, 'complete');
    expect(date).toMatch(/2022-01-31T00:00:00(\+|-)\d{2}:\d{2}/);
  });

  it('should be generous for dates not perfectly formatted', () => {
    const date = buildDateFromString('2024-07-24 1:00', DATE_FORMATS.MM_DD_YYYY, 'date');
    expect(date).toEqual('2024-07-24');
  });
});

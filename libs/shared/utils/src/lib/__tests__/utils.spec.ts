import { getExcelSafeSheetName, getFullNameFromListMetadata } from '../utils';

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

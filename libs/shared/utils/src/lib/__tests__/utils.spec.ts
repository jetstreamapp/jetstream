import { getExcelSafeSheetName } from '../utils';

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

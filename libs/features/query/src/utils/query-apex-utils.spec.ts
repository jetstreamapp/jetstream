import { recordToApex } from './query-apex-utils';

const record = {
  attributes: {
    type: 'A_Custom_Obj__c',
    url: '/services/data/v49.0/sobjects/A_Custom_Obj__c/a006g00000EwgrfAAB',
  },
  Id: 'a006g00000EwgrfAAB',
  OwnerId: '0056g000004tCpaAAE',
  IsDeleted: false,
  Name: 'Name is optional: 😱',
  RecordTypeId: null,
  CreatedDate: '2020-11-08T17:23:15.000+0000',
  CreatedById: '0056g000004tCpaAAE',
  LastModifiedDate: '2021-05-27T03:46:58.000+0000',
  LastModifiedById: '0056g000004tCpaAAE',
  SystemModstamp: '2021-05-27T03:46:58.000+0000',
  LastActivityDate: null,
  LastViewedDate: '2021-05-28T00:11:50.000+0000',
  LastReferencedDate: '2021-05-28T00:11:50.000+0000',
  Date__c: '2021-05-28',
  Test_Field__c: '11/4/20',
  test_currency_field__c: 100,
  test_number_field__c: 1,
  Michael_Jordan_clone__c: '0',
  Test__c: '100',
  Account__c: '0016g00000ETu0HAAT',
  My_Percent__c: 75,
  my_time__c: '00:30:00.000Z',
  my_url__c: 'https://google.com',
  my_phone__c: '4065551234',
  my_geo__Latitude__s: 49.0123,
  my_geo__Longitude__s: -123,
  my_geo__c: {
    latitude: 49.0123,
    longitude: -123,
  },
  my_autonum__c: 'auto-0007',
  Single_Select_Picklist__c: null,
  Multi_Select_Picklist__c: 'Valie 10;Value 20;Value 30',
  My_Picklist_from_Global_VS__c: null,
  My_Master_Picklist__c: null,
  My_Formula__c: true,
  Self_Lookup__c: null,
  My_Currency__c: 500,
  My_Date_Field__c: '2020-11-01',
  Fancy_Date_Time__c: '2020-11-01T06:00:00.000+0000',
  Email__c: 'test@example.com',
  My_Numbers_Are_Good__c: null,
  Geolocation_fields_are_dumb__Latitude__s: -49,
  Geolocation_fields_are_dumb__Longitude__s: -49,
  Geolocation_fields_are_dumb__c: {
    latitude: -49,
    longitude: -49,
  },
  Textarea_long__c: 'TEXT - LONG',
  Textarea_RICH__c: 'TEXT <b>RICH</b>',
  Text_Encrypted__c: null,
  Time_Field__c: null,
  Url__c: null,
  A_NEW_FIELD__c: null,
};

const smallRecord = {
  Id: 'a006g00000EwgrfAAB',
  IsDeleted: false,
  test_currency_field__c: 100,
};

describe('recordToApex', () => {
  it('should handle inline spaces', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account' });
    let expected = 'Account account = new Account(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  IsDeleted = false,\n`;
    expected += `  test_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should handle inline tabs', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', indentation: 'tabs' });
    let expected = 'Account account = new Account(\n';
    expected += `\tId = 'a006g00000EwgrfAAB',\n`;
    expected += `\tIsDeleted = false,\n`;
    expected += `\ttest_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should handle overridden inline spaces', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', inline: true, tabSize: 4 });
    let expected = 'Account account = new Account(\n';
    expected += `    Id = 'a006g00000EwgrfAAB',\n`;
    expected += `    IsDeleted = false,\n`;
    expected += `    test_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should handle overridden tabs', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', inline: true, indentation: 'tabs', tabSize: 4 });
    let expected = 'Account account = new Account(\n';
    expected += `\t\t\t\tId = 'a006g00000EwgrfAAB',\n`;
    expected += `\t\t\t\tIsDeleted = false,\n`;
    expected += `\t\t\t\ttest_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should handle inline with insert statement', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', insertStatement: true });
    let expected = 'Account account = new Account(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  IsDeleted = false,\n`;
    expected += `  test_currency_field__c = 100\n`;
    expected += ');\n\n';
    expected += 'insert account;';
    expect(apex).toEqual(expected);
  });

  it('should handle non-inline', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', inline: false });
    let expected = `Account account = new Account();\n`;
    expected += `account.Id = 'a006g00000EwgrfAAB';\n`;
    expected += `account.IsDeleted = false;\n`;
    expected += `account.test_currency_field__c = 100;`;
    expect(apex).toEqual(expected);
  });

  it('should handle non-inline with insert statement', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', inline: false, insertStatement: true });
    let expected = `Account account = new Account();\n`;
    expected += `account.Id = 'a006g00000EwgrfAAB';\n`;
    expected += `account.IsDeleted = false;\n`;
    expected += `account.test_currency_field__c = 100;\n\n`;
    expected += 'insert account;';
    expect(apex).toEqual(expected);
  });

  it('should handle complex name', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'NAm3_spACe__Account__c' });
    let expected = 'NAm3_spACe__Account__c account = new NAm3_spACe__Account__c(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  IsDeleted = false,\n`;
    expected += `  test_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should limit returned record to the fields provided', () => {
    const apex = recordToApex(record, { sobjectName: 'Account', fields: ['Id', 'IsDeleted', 'test_currency_field__c'] });
    let expected = 'Account account = new Account(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  IsDeleted = false,\n`;
    expected += `  test_currency_field__c = 100\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should be wrapped in method', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', wrapInMethod: true });
    let expected = 'public Account getAccount() {\n';
    expected += '  Account account = new Account(\n';
    expected += `    Id = 'a006g00000EwgrfAAB',\n`;
    expected += `    IsDeleted = false,\n`;
    expected += `    test_currency_field__c = 100\n`;
    expected += '  );\n\n';
    expected += '  return account;\n';
    expected += '}';
    expect(apex).toEqual(expected);
  });

  it('should be wrapped in method with insert statement', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', wrapInMethod: true, insertStatement: true });
    let expected = 'public Account getAccount() {\n';
    expected += '  Account account = new Account(\n';
    expected += `    Id = 'a006g00000EwgrfAAB',\n`;
    expected += `    IsDeleted = false,\n`;
    expected += `    test_currency_field__c = 100\n`;
    expected += '  );\n\n';
    expected += '  insert account;\n\n';
    expected += '  return account;\n';
    expected += '}';
    expect(apex).toEqual(expected);
  });

  it('should be wrapped in static method', () => {
    const apex = recordToApex(smallRecord, { sobjectName: 'Account', wrapInMethod: true, wrapInMethodStatic: true });
    let expected = 'public static Account getAccount() {\n';
    expected += '  Account account = new Account(\n';
    expected += `    Id = 'a006g00000EwgrfAAB',\n`;
    expected += `    IsDeleted = false,\n`;
    expected += `    test_currency_field__c = 100\n`;
    expected += '  );\n\n';
    expected += '  return account;\n';
    expected += '}';
    expect(apex).toEqual(expected);
  });

  it('should handle date and datetime conversions', () => {
    const apex = recordToApex(record, {
      sobjectName: 'Account',
      fields: ['Id', 'LastReferencedDate', 'Date__c'],
      fieldMetadata: {
        LastReferencedDate: 'datetime',
        Date__c: 'date',
      },
    });
    let expected = 'Account account = new Account(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  LastReferencedDate = JSON.deserialize('"2021-05-28T00:11:50.000+0000"', Datetime.class),\n`;
    expected += `  Date__c = JSON.deserialize('"2021-05-28"', Date.class)\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });

  it('should handle date and datetime when replaceDateWithToday is true', () => {
    const apex = recordToApex(record, {
      sobjectName: 'Account',
      fields: ['Id', 'LastReferencedDate', 'Date__c'],
      replaceDateWithToday: true,
      fieldMetadata: {
        LastReferencedDate: 'datetime',
        Date__c: 'date',
      },
    });
    let expected = 'Account account = new Account(\n';
    expected += `  Id = 'a006g00000EwgrfAAB',\n`;
    expected += `  LastReferencedDate = Datetime.now(),\n`;
    expected += `  Date__c = Date.today()\n`;
    expected += ');';
    expect(apex).toEqual(expected);
  });
});

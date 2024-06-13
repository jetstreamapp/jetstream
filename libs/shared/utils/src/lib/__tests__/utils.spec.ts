import { DATE_FORMATS } from '@jetstream/shared/constants';
import { QueryResults, QueryResultsColumn, SalesforceRecord } from '@jetstream/types';
import {
  alwaysResolve,
  buildDateFromString,
  dateFromTimestamp,
  flattenRecord,
  getErrorMessage,
  getExcelSafeSheetName,
  getFullNameFromListMetadata,
  getIdAndObjFromRecordUrl,
  getIdFromRecordUrl,
  getMapFromObj,
  getRecordIdFromAttributes,
  getSObjectFromRecordUrl,
  getSObjectNameFromAttributes,
  groupByFlat,
  multiWordObjectFilter,
  multiWordStringFilter,
  nullifyEmptyStrings,
  orderObjectsBy,
  orderValues,
  pluralizeFromNumber,
  populateFromMapOf,
  queryResultColumnToTypeLabel,
  replaceSubqueryQueryResultsWithRecords,
  splitArrayToMaxSize,
  toBoolean,
  toNumber,
  truncate,
} from '../utils';

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
    expect(date).toMatch(/2022-01-31T00:00:00((\+|-)\d{2}:\d{2}|Z)/);
  });

  it('should be generous for dates not perfectly formatted', () => {
    const date = buildDateFromString('2024-07-24 1:00', DATE_FORMATS.MM_DD_YYYY, 'date');
    expect(date).toEqual('2024-07-24');
  });
});

describe('utils.getErrorMessage', () => {
  it('should return the error message if the input is an instance of Error', () => {
    const error = new Error('Test error');
    expect(getErrorMessage(error)).toEqual('Test error');
  });

  it('should return the JSON string representation of the error if the input is not an instance of Error', () => {
    const error = { message: 'Test error' };
    expect(getErrorMessage(error)).toEqual('{"message":"Test error"}');
  });
});

describe('utils.dateFromTimestamp', () => {
  it('should return the correct date from a timestamp', () => {
    const timestamp = 1640995200; // January 1, 2022 00:00:00 UTC
    const expectedDate = new Date(2022, 0, 1, 0, 0, 0);
    expect(dateFromTimestamp(timestamp)).toEqual(expectedDate);
  });
});

describe('alwaysResolve', () => {
  it('should resolve with the original value if the promise resolves', async () => {
    const promise = Promise.resolve('original value');
    const result = await alwaysResolve(promise, 'error value');
    expect(result).toEqual('original value');
  });

  it('should resolve with the valueIfError if the promise rejects', async () => {
    const promise = Promise.reject(new Error('test error'));
    const result = await alwaysResolve(promise, 'error value');
    expect(result).toEqual('error value');
  });

  it('should resolve with the valueIfError if the promise throws an error', async () => {
    const promise = Promise.resolve().then(() => {
      throw new Error('test error');
    });
    const result = await alwaysResolve(promise, 'error value');
    expect(result).toEqual('error value');
  });
});

describe('utils.multiWordObjectFilter', () => {
  it('should return true for empty value', () => {
    const filter = multiWordObjectFilter(['name'], '');
    const item = { name: 'John Doe' };
    expect(filter(item, 0, [item])).toBe(true);
  });

  it('should return true if item is null or undefined', () => {
    const filter = multiWordObjectFilter(['name'], 'John');
    expect(filter(null as any, 0, [])).toBe(true);
    expect(filter(undefined as any, 0, [])).toBe(true);
  });

  it('should return true if item matches the search value', () => {
    const filter = multiWordObjectFilter(['name'], 'John');
    const item = { name: 'John Doe' };
    expect(filter(item, 0, [item])).toBe(true);
  });

  it('should return true if item matches all search words', () => {
    const filter = multiWordObjectFilter(['name'], 'John Doe');
    const item = { name: 'John Doe' };
    expect(filter(item, 0, [item])).toBe(true);
  });

  it('should return false if item does not match any search word', () => {
    const filter = multiWordObjectFilter(['name'], 'John');
    const item = { name: 'Jane Doe' };
    expect(filter(item, 0, [item])).toBe(false);
  });

  it('should return true if optionalExtraCondition returns true', () => {
    const optionalExtraCondition = (item: any) => item.age > 18;
    const filter = multiWordObjectFilter(['name'], 'John1', optionalExtraCondition);
    const item = { name: 'John Doe', age: 25 };
    expect(filter(item, 0, [item])).toBe(true);
  });

  it('should return false if optionalExtraCondition returns false', () => {
    const optionalExtraCondition = (item: any) => item.age > 18;
    const filter = multiWordObjectFilter(['name'], 'John1', optionalExtraCondition);
    const item = { name: 'John Doe', age: 15 };
    expect(filter(item, 0, [item])).toBe(false);
  });
});

describe('multiWordStringFilter', () => {
  it('should return true when value is empty', () => {
    const filter = multiWordStringFilter('');
    expect(filter('test', 0, ['test'])).toBe(true);
  });

  it('should return true when item is empty', () => {
    const filter = multiWordStringFilter('test');
    expect(filter('', 0, ['test'])).toBe(true);
  });

  it('should return true when value and item are empty', () => {
    const filter = multiWordStringFilter('');
    expect(filter('', 0, ['test'])).toBe(true);
  });

  it('should return true when value and item are null', () => {
    const filter = multiWordStringFilter(null as any);
    expect(filter(null as any, 0, ['test'])).toBe(true);
  });

  it('should return true when value and item are undefined', () => {
    const filter = multiWordStringFilter(undefined as any);
    expect(filter(undefined as any, 0, ['test'])).toBe(true);
  });

  it('should return true when value matches item', () => {
    const filter = multiWordStringFilter('test');
    expect(filter('test', 0, ['test'])).toBe(true);
  });

  it('should return true when value matches item case-insensitively', () => {
    const filter = multiWordStringFilter('TEST');
    expect(filter('test', 0, ['test'])).toBe(true);
  });

  it('should return true when value matches multiple words in item', () => {
    const filter = multiWordStringFilter('hello world');
    expect(filter('hello world', 0, ['hello world'])).toBe(true);
  });

  it('should return false when value does not match item', () => {
    const filter = multiWordStringFilter('test');
    expect(filter('example', 0, ['example'])).toBe(false);
  });

  it('should return false when value does not match any word in item', () => {
    const filter = multiWordStringFilter('hello world');
    expect(filter('example', 0, ['example'])).toBe(false);
  });
});

describe('orderObjectsBy', () => {
  it('should order objects in ascending order by a single field', () => {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Alice' },
      { id: 3, name: 'Bob' },
    ];
    const expectedOrder = [
      { id: 2, name: 'Alice' },
      { id: 3, name: 'Bob' },
      { id: 1, name: 'John' },
    ];
    const result = orderObjectsBy(items, 'name');
    expect(result).toEqual(expectedOrder);
  });

  it('should order objects in descending order by a single field', () => {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Alice' },
      { id: 3, name: 'Bob' },
    ];
    const expectedOrder = [
      { id: 1, name: 'John' },
      { id: 3, name: 'Bob' },
      { id: 2, name: 'Alice' },
    ];
    const result = orderObjectsBy(items, 'name', 'desc');
    expect(result).toEqual(expectedOrder);
  });

  it('should order objects in ascending order by multiple fields', () => {
    const items = [
      { id: 1, name: 'John', age: 25 },
      { id: 2, name: 'Alice', age: 30 },
      { id: 3, name: 'Bob', age: 20 },
    ];
    const expectedOrder = [
      { id: 3, name: 'Bob', age: 20 },
      { id: 1, name: 'John', age: 25 },
      { id: 2, name: 'Alice', age: 30 },
    ];
    const result = orderObjectsBy(items, ['age', 'name']);
    expect(result).toEqual(expectedOrder);
  });

  it('should order objects in descending order by multiple fields', () => {
    const items = [
      { id: 1, name: 'John', age: 25 },
      { id: 2, name: 'Alice', age: 30 },
      { id: 3, name: 'Bob', age: 20 },
    ];
    const expectedOrder = [
      { id: 2, name: 'Alice', age: 30 },
      { id: 1, name: 'John', age: 25 },
      { id: 3, name: 'Bob', age: 20 },
    ];
    const result = orderObjectsBy(items, ['age', 'name'], 'desc');
    expect(result).toEqual(expectedOrder);
  });
});

describe('orderValues', () => {
  it('should order values in ascending order by default', () => {
    const items = [3, 1, 2];
    const expectedOutput = [1, 2, 3];
    expect(orderValues(items)).toEqual(expectedOutput);
  });

  it('should order values in descending order', () => {
    const items = [3, 1, 2];
    const expectedOutput = [3, 2, 1];
    expect(orderValues(items, 'desc')).toEqual(expectedOutput);
  });

  it('should order string values in ascending order', () => {
    const items = ['c', 'a', 'B'];
    const expectedOutput = ['a', 'B', 'c'];
    expect(orderValues(items)).toEqual(expectedOutput);
  });

  it('should order string values in descending order', () => {
    const items = ['C', 'a', 'B'];
    const expectedOutput = ['C', 'B', 'a'];
    expect(orderValues(items, 'desc')).toEqual(expectedOutput);
  });

  it('should order boolean values in ascending order', () => {
    const items = [true, false, true];
    const expectedOutput = [false, true, true];
    expect(orderValues(items)).toEqual(expectedOutput);
  });

  it('should order boolean values in descending order', () => {
    const items = [true, false, true];
    const expectedOutput = [true, true, false];
    expect(orderValues(items, 'desc')).toEqual(expectedOutput);
  });
});

describe('groupByFlat', () => {
  it('should group items by the specified property', () => {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 3, name: 'John' },
    ];

    const result = groupByFlat(items, 'name');

    expect(result).toEqual({
      John: { id: 3, name: 'John' },
      Jane: { id: 2, name: 'Jane' },
    });
  });

  it('should handle empty input array', () => {
    const items: any[] = [];
    const result = groupByFlat(items, 'name');
    expect(result).toEqual({});
  });

  it('should handle empty property value', () => {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: '' },
      { id: 3, name: 'Jane' },
    ];

    const result = groupByFlat(items, 'name');

    expect(result).toEqual({
      John: { id: 1, name: 'John' },
      '': { id: 2, name: '' },
      Jane: { id: 3, name: 'Jane' },
    });
  });

  it('should handle non-existent property', () => {
    const items = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }, { id: 3 }];

    const result = groupByFlat(items, 'name');

    expect(result).toEqual({
      John: { id: 1, name: 'John' },
      Jane: { id: 2, name: 'Jane' },
      undefined: { id: 3 },
    });
  });
});

describe('getMapFromObj', () => {
  it('should return an empty map when given an empty array', () => {
    const items: any[] = [];
    const prop = 'id';
    const result = getMapFromObj(items, prop);
    expect(result.size).toEqual(0);
  });

  it('should return a map with the correct key-value pairs', () => {
    const items = [
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' },
      { id: '3', name: 'Bob' },
    ];
    const prop = 'id';
    const result = getMapFromObj(items, prop);
    expect(result.size).toEqual(3);
    expect(result.get('1')).toEqual(items[0]);
    expect(result.get('2')).toEqual(items[1]);
    expect(result.get('3')).toEqual(items[2]);
  });

  it('should handle duplicate keys by overwriting the previous value', () => {
    const items = [
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' },
      { id: '1', name: 'Bob' },
    ];
    const prop = 'id';
    const result = getMapFromObj(items, prop);
    expect(result.size).toEqual(2);
    expect(result.get('1')).toEqual(items[2]);
    expect(result.get('2')).toEqual(items[1]);
  });
});

describe('populateFromMapOf', () => {
  it('should return an array of values from the map based on the given items', () => {
    const mapOf = {
      item1: 'Value 1',
      item2: 'Value 2',
      item3: 'Value 3',
    };
    const items = ['item1', 'item3'];

    const result = populateFromMapOf(mapOf, items);

    expect(result).toEqual(['Value 1', 'Value 3']);
  });

  it('should filter out undefined or null values from the result array', () => {
    const mapOf = {
      item1: 'Value 1',
      item2: null,
      item3: undefined,
    };
    const items = ['item1', 'item2', 'item3'];

    const result = populateFromMapOf(mapOf, items);

    expect(result).toEqual(['Value 1']);
  });

  it('should return an empty array if no items are provided', () => {
    const mapOf = {
      item1: 'Value 1',
      item2: 'Value 2',
      item3: 'Value 3',
    };
    const items: string[] = [];

    const result = populateFromMapOf(mapOf, items);

    expect(result).toEqual([]);
  });

  it('should return an empty array if the map is empty', () => {
    const mapOf: Record<string, string> = {};
    const items = ['item1', 'item2', 'item3'];

    const result = populateFromMapOf(mapOf, items);

    expect(result).toEqual([]);
  });

  it('should return an empty array if the map does not contain any matching items', () => {
    const mapOf = {
      item1: 'Value 1',
      item2: 'Value 2',
      item3: 'Value 3',
    };
    const items = ['item4', 'item5'];

    const result = populateFromMapOf(mapOf, items);

    expect(result).toEqual([]);
  });
});

describe('flattenRecord', () => {
  const record: SalesforceRecord = {
    id: '123',
    name: 'John Doe',
    email: 'john.doe@example.com',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
    },
  };

  it('should flatten the record with default options', () => {
    const fields = ['id', 'name', 'email', 'address'];
    const expectedOutput = {
      id: '123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: '{"street":"123 Main St","city":"New York","state":"NY"}',
    };
    expect(flattenRecord(record, fields)).toEqual(expectedOutput);
  });

  it('should flatten the record without flattening nested objects', () => {
    const fields = ['id', 'name', 'email', 'address'];
    const expectedOutput = {
      id: '123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
      },
    };
    expect(flattenRecord(record, fields, false)).toEqual(expectedOutput);
  });

  it('should flatten the record with flattening nested subquery records', () => {
    const fields = ['id', 'name', 'email', 'address'];
    const subqueryRecord = {
      records: [
        { id: '1', name: 'Subrecord 1' },
        { id: '2', name: 'Subrecord 2' },
      ],
    };
    const recordWithSubquery = {
      ...record,
      address: subqueryRecord,
    };
    const expectedOutput = {
      id: '123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: '[{"id":"1","name":"Subrecord 1"},{"id":"2","name":"Subrecord 2"}]',
    };
    expect(flattenRecord(recordWithSubquery, fields)).toEqual(expectedOutput);
  });

  it('should flatten the record with flattening nested subquery records and ignoring leading/trailing quotes', () => {
    const fields = ['id', 'name', 'email', 'address'];
    const subqueryRecord = {
      records: [
        { id: '1', name: 'Subrecord 1' },
        { id: '2', name: 'Subrecord 2' },
      ],
    };
    const recordWithSubquery = {
      ...record,
      address: subqueryRecord,
    };
    const expectedOutput = {
      id: '123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: '[{"id":"1","name":"Subrecord 1"},{"id":"2","name":"Subrecord 2"}]',
    };
    expect(flattenRecord(recordWithSubquery, fields, true)).toEqual(expectedOutput);
  });
});

describe('splitArrayToMaxSize', () => {
  it('should split the array into subarrays of maximum size', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const maxSize = 3;
    const expectedOutput = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]];
    expect(splitArrayToMaxSize(items, maxSize)).toEqual(expectedOutput);
  });

  it('should return an empty subarray if the input array is empty', () => {
    const items: number[] = [];
    const maxSize = 5;
    const expectedOutput: number[][] = [[]];
    expect(splitArrayToMaxSize(items, maxSize)).toEqual(expectedOutput);
  });

  it('should throw an error if maxSize is less than 1', () => {
    const items = [1, 2, 3, 4, 5];
    const maxSize = 0;
    expect(() => splitArrayToMaxSize(items, maxSize)).toThrow('maxSize must be greater than 0');
  });
});

describe('toBoolean', () => {
  it('should return the boolean value if it is already a boolean', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });

  it('should return true if the string value starts with "t" (case-insensitive)', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('True')).toBe(true);
    expect(toBoolean('TRUE')).toBe(true);
    expect(toBoolean('t')).toBe(true);
    expect(toBoolean('T')).toBe(true);
  });

  it('should return false if the string value does not start with "t" (case-insensitive)', () => {
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('False')).toBe(false);
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('f')).toBe(false);
    expect(toBoolean('F')).toBe(false);
  });

  it('should return the default value if the input is neither a boolean nor a string', () => {
    expect(toBoolean(null)).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean(1)).toBe(false);
    expect(toBoolean({})).toBe(false);
    expect(toBoolean([])).toBe(false);
    expect(toBoolean(0, true)).toBe(true);
    expect(toBoolean(1, true)).toBe(true);
    expect(toBoolean({}, true)).toBe(true);
    expect(toBoolean([], true)).toBe(true);
  });

  it('should return the default value if the input is an empty string', () => {
    expect(toBoolean('')).toBe(false);
  });

  it('should return the default value if the input is a string that does not start with "t" (case-insensitive)', () => {
    expect(toBoolean('foo')).toBe(false);
    expect(toBoolean('bar')).toBe(false);
  });

  it('should return the default value if the input is a string that starts with "t" but has additional characters', () => {
    expect(toBoolean('true123')).toBe(true);
    expect(toBoolean('True123')).toBe(true);
    expect(toBoolean('TRUE123')).toBe(true);
    expect(toBoolean('t123')).toBe(true);
    expect(toBoolean('T123')).toBe(true);
  });

  it('should return the default value if the input is a string that starts with "t" but has additional characters', () => {
    expect(toBoolean('true123')).toBe(true);
    expect(toBoolean('True123')).toBe(true);
    expect(toBoolean('TRUE123')).toBe(true);
    expect(toBoolean('t123')).toBe(true);
    expect(toBoolean('T123')).toBe(true);
  });
});

describe('utils.toNumber', () => {
  it('should return the number value if the input is a number', () => {
    expect(toNumber(123)).toEqual(123);
    expect(toNumber(0)).toEqual(0);
    expect(toNumber(-456)).toEqual(-456);
  });

  it('should parse the string value and return the number if the input is a string representing a valid number', () => {
    expect(toNumber('123')).toEqual(123);
    expect(toNumber('0')).toEqual(0);
    expect(toNumber('-456')).toEqual(-456);
  });

  it('should return the input value if it is not a number or a string representing a valid number', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber('abc')).toEqual('abc');
    expect(toNumber(true)).toEqual(true);
    expect(toNumber(false)).toEqual(false);
    expect(toNumber({})).toEqual({});
    expect(toNumber([])).toEqual([]);
  });
});

describe('truncate', () => {
  it('should return the original value if it is shorter than or equal to the maxLength', () => {
    const value = 'Hello, World!';
    const maxLength = 13;
    expect(truncate(value, maxLength)).toEqual(value);
  });

  it('should truncate the value and append the trailingChar if it is longer than the maxLength', () => {
    const value = 'Hello, World!';
    const maxLength = 10;
    const trailingChar = '...';
    const expectedOutput = 'Hello, Wor...';
    expect(truncate(value, maxLength, trailingChar)).toEqual(expectedOutput);
  });

  it('should return an empty string if the value is empty', () => {
    const value = '';
    const maxLength = 10;
    expect(truncate(value, maxLength)).toEqual('');
  });

  it('should return an empty string if the value is null', () => {
    const value = null as any;
    const maxLength = 10;
    expect(truncate(value, maxLength)).toEqual(value);
  });

  it('should return an empty string if the value is undefined', () => {
    const value = undefined as any;
    const maxLength = 10;
    expect(truncate(value, maxLength)).toEqual(value);
  });
});

describe('utils.pluralizeFromNumber', () => {
  it('should return the plural form of the value when num is not 1', () => {
    expect(pluralizeFromNumber('apple', 0)).toEqual('apples');
    expect(pluralizeFromNumber('apple', 2)).toEqual('apples');
    expect(pluralizeFromNumber('book', 0)).toEqual('books');
    expect(pluralizeFromNumber('book', 5)).toEqual('books');
  });

  it('should return the singular form of the value when num is 1', () => {
    expect(pluralizeFromNumber('apple', 1)).toEqual('apple');
    expect(pluralizeFromNumber('book', 1)).toEqual('book');
  });

  it('should use the provided plural suffix', () => {
    expect(pluralizeFromNumber('child', 2, 'ren')).toEqual('children');
    expect(pluralizeFromNumber('mouse', 0, 's')).toEqual('mouses');
    expect(pluralizeFromNumber('person', 5, 's')).toEqual('persons');
  });
});

describe('utils.getIdAndObjFromRecordUrl', () => {
  it('should return the id and sobject from a valid record URL', () => {
    const url = 'https://example.com/record/Account/001R00000123456';
    const [id, sobject] = getIdAndObjFromRecordUrl(url);
    expect(id).toEqual('001R00000123456');
    expect(sobject).toEqual('Account');
  });

  it('should return an empty string for id and sobject if the URL is empty', () => {
    const url = '';
    const [id, sobject] = getIdAndObjFromRecordUrl(url);
    expect(id).toEqual('');
    expect(sobject).toEqual(undefined);
  });

  it('should return an empty string for id and sobject if the URL does not contain a valid record URL', () => {
    const url = 'https://example.com';
    const [id, sobject] = getIdAndObjFromRecordUrl(url);
    expect(id).toEqual('example.com');
    expect(sobject).toEqual('');
  });

  it('should return an empty string for id and sobject if the URL is null or undefined', () => {
    const url = null as any;
    const [id, sobject] = getIdAndObjFromRecordUrl(url);
    expect(id).toEqual(undefined);
    expect(sobject).toEqual(undefined);

    const undefinedUrl = undefined as any;
    const [undefinedId, undefinedSobject] = getIdAndObjFromRecordUrl(undefinedUrl);
    expect(undefinedId).toEqual(undefined);
    expect(undefinedSobject).toEqual(undefined);
  });
});

describe('getSObjectFromRecordUrl', () => {
  it('should return the sobject from the record url', () => {
    const url = 'https://example.com/sobjects/Account/001R00000123456';
    const sobject = getSObjectFromRecordUrl(url);
    expect(sobject).toEqual('Account');
  });

  it('should return an empty string if the url is invalid', () => {
    const url = 'https://example.com/invalid-url';
    const sobject = getSObjectFromRecordUrl(url);
    expect(sobject).toEqual('example.com');
  });
});

describe('getIdFromRecordUrl', () => {
  it('should return the ID from the record URL', () => {
    const url = 'https://example.com/001R00000123456';
    const id = getIdFromRecordUrl(url);
    expect(id).toEqual('001R00000123456');
  });
});

describe('nullifyEmptyStrings', () => {
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

describe('replaceSubqueryQueryResultsWithRecords', () => {
  it('should replace subquery query results with records', () => {
    const results: QueryResults<any> = {
      parsedQuery: {
        fields: [
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField1' } },
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField2' } },
        ],
      },
      queryResults: {
        records: [
          { subqueryField1: { records: ['record1'] }, subqueryField2: { records: ['record2'] } },
          { subqueryField1: { records: ['record3'] }, subqueryField2: { records: ['record4'] } },
        ],
        done: true,
        totalSize: 2,
      },
    };

    const expectedResults: QueryResults<any> = {
      parsedQuery: {
        fields: [
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField1' } },
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField2' } },
        ],
      },
      queryResults: {
        records: [
          { subqueryField1: ['record1'], subqueryField2: ['record2'] },
          { subqueryField1: ['record3'], subqueryField2: ['record4'] },
        ],
        done: true,
        totalSize: 2,
      },
    };

    const actualResults = replaceSubqueryQueryResultsWithRecords(results);
    expect(actualResults).toEqual(expectedResults);
  });

  it('should handle empty parsedQuery', () => {
    const results: QueryResults<any> = {
      queryResults: {
        records: [
          { subqueryField1: { records: ['record1'] }, subqueryField2: { records: ['record2'] } },
          { subqueryField1: { records: ['record3'] }, subqueryField2: { records: ['record4'] } },
        ],
        done: true,
        totalSize: 2,
      },
    };

    const expectedResults: QueryResults<any> = {
      queryResults: {
        records: [
          { subqueryField1: { records: ['record1'] }, subqueryField2: { records: ['record2'] } },
          { subqueryField1: { records: ['record3'] }, subqueryField2: { records: ['record4'] } },
        ],
        done: true,
        totalSize: 2,
      },
    };

    const actualResults = replaceSubqueryQueryResultsWithRecords(results);
    expect(actualResults).toEqual(expectedResults);
  });

  it('should handle empty queryResults', () => {
    const results: QueryResults<any> = {
      parsedQuery: {
        fields: [
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField1' } },
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField2' } },
        ],
      },
      queryResults: {
        records: [],
        done: true,
        totalSize: 0,
      },
    };

    const expectedResults: QueryResults<any> = {
      parsedQuery: {
        fields: [
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField1' } },
          { type: 'FieldSubquery', subquery: { relationshipName: 'subqueryField2' } },
        ],
      },
      queryResults: {
        records: [],
        done: true,
        totalSize: 0,
      },
    };

    const actualResults = replaceSubqueryQueryResultsWithRecords(results);
    expect(actualResults).toEqual(expectedResults);
  });
});

describe('queryResultColumnToTypeLabel', () => {
  it('should return "Text" for column with textType', () => {
    const column: QueryResultsColumn = { textType: true } as any;
    const result = queryResultColumnToTypeLabel(column);
    expect(result).toEqual('Text');
  });

  it('should return "Checkbox" for column with booleanType', () => {
    const column: QueryResultsColumn = { booleanType: true } as any;
    const result = queryResultColumnToTypeLabel(column);
    expect(result).toEqual('Checkbox');
  });

  it('should return "Number" for column with numberType', () => {
    const column: QueryResultsColumn = { numberType: true } as any;
    const result = queryResultColumnToTypeLabel(column);
    expect(result).toEqual('Number');
  });

  it('should return "Child Records" for column with childColumnPaths', () => {
    const column: QueryResultsColumn = { childColumnPaths: ['path1', 'path2'] } as any;
    const result = queryResultColumnToTypeLabel(column);
    expect(result).toEqual('Child Records');
  });

  it('should return apexType if column does not match any type', () => {
    const column: QueryResultsColumn = { apexType: 'CustomType' } as any;
    const result = queryResultColumnToTypeLabel(column);
    expect(result).toEqual('CustomType');
  });

  it('should return fallback if column is undefined', () => {
    const result = queryResultColumnToTypeLabel(undefined as any, 'FallbackType');
    expect(result).toEqual('FallbackType');
  });
});

describe('utils.getRecordIdFromAttributes', () => {
  it('should return the record ID from the attributes URL', () => {
    const record = {
      attributes: {
        url: 'https://example.com/api/records/12345',
      },
    };

    const recordId = getRecordIdFromAttributes(record);

    expect(recordId).toEqual('12345');
  });

  it('should return an empty string if the attributes URL is empty', () => {
    const record = {
      attributes: {
        url: '',
      },
    };

    const recordId = getRecordIdFromAttributes(record);

    expect(recordId).toEqual('');
  });

  it('should return an empty string if the attributes URL does not contain a record ID', () => {
    const record = {
      attributes: {
        url: 'https://example.com/api/records/',
      },
    };

    const recordId = getRecordIdFromAttributes(record);

    expect(recordId).toEqual('');
  });
});

describe('utils.getRecordIdFromAttributes', () => {
  it('gets record id from attributes', () => {
    expect(
      getRecordIdFromAttributes({
        attributes: { type: 'Opportunity', url: '/services/data/v60.0/sobjects/Opportunity/0068c00000lbXugAAE' },
      })
    ).toBe('0068c00000lbXugAAE');
  });

  it('returns empty string if no url', () => {
    expect(
      getRecordIdFromAttributes({
        attributes: { type: 'Opportunity', url: null },
      })
    ).toBe('');
  });
});

describe('utils.getSObjectNameFromAttributes', () => {
  it('gets sobject name from type if available', () => {
    expect(
      getSObjectNameFromAttributes({
        attributes: { type: 'Opportunity', url: null },
      })
    ).toBe('Opportunity');
  });
  it('gets sobject name from attribute url', () => {
    expect(
      getSObjectNameFromAttributes({
        attributes: { url: '/services/data/v60.0/sobjects/Opportunity/0068c00000lbXugAAE' },
      })
    ).toBe('Opportunity');
  });
  it('returns empty string if no match', () => {
    expect(getSObjectNameFromAttributes({})).toBe('');
  });
});

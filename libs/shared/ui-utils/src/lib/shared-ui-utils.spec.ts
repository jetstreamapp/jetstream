import React from 'react';
import { render } from '@testing-library/react';

import { transformTabularDataToExcelStr } from './shared-ui-utils';

describe('transformTabularDataToExcelStr', () => {
  it('should work with standard data', () => {
    const data = [
      { a: 'a', b: 'b', c: 'c' },
      { a: 'a\na', b: 'be "yourself"', c: '"c"' },
    ];

    const result = transformTabularDataToExcelStr(data);

    expect(result).toEqual(`a\tb\tc\na\tb\tc\n"a\na"\t"be ""yourself"""\t"""c"""`);
  });

  it('should return empty string if there is no data', () => {
    expect('').toEqual(transformTabularDataToExcelStr('data' as any));
    expect('').toEqual(transformTabularDataToExcelStr([]));
    expect('').toEqual(transformTabularDataToExcelStr(null));
  });

  it('should use fields if provided', () => {
    const data = [
      { a: 'a', b: 'b', c: 'c' },
      { a: 'a', b: 'b', c: 'c' },
    ];

    const result = transformTabularDataToExcelStr(data, ['a']);

    expect(result).toEqual(`a\na\na`);
  });

  it('should handle fields that are missing from data', () => {
    const data = [
      { a: 'a', b: 'b', c: 'c' },
      { a: 'a', b: 'b', c: 'c' },
    ];

    const result = transformTabularDataToExcelStr(data, ['a', 'z']);

    expect(result).toEqual(`a\tz\na\t\na\t`);
  });
});

import { DescribeSObjectResult, Field } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { ExportOptions, SobjectFetchResult } from '../sobject-export-types';
import { prepareExport } from '../sobject-export-utils';

const OPTIONS: ExportOptions = {
  worksheetLayout: 'split',
  headerOption: 'name',
  includesStandardFields: true,
  includeObjectAttributes: false,
  saveAsDefaultSelection: false,
};

function getSobject(sobject: string): SobjectFetchResult {
  return {
    sobject,
    metadata: {
      name: sobject,
      label: sobject,
      fields: [{ name: 'Id', label: 'Record Id', custom: false } as Field],
    } as DescribeSObjectResult,
  };
}

function prepareSplitExport(sobjects: string[], options: Partial<ExportOptions> = {}) {
  return prepareExport(sobjects.map(getSobject), {}, {}, ['name'], { ...OPTIONS, ...options });
}

describe('prepareExport worksheet names', () => {
  test('uses the object api name when it fits inside Excel limits', () => {
    expect(Object.keys(prepareSplitExport(['Account', 'Contact']))).toEqual(['Account', 'Contact']);
  });

  /**
   * The bug this covers: names were truncated to 31 characters with no de-duplication, so two objects sharing a
   * long prefix wrote to the same key and only the last one made it into the file.
   */
  test('de-duplicates object names that collide once truncated to 31 characters', () => {
    const output = prepareSplitExport(['A_Very_Long_Custom_Object_Name_One__c', 'A_Very_Long_Custom_Object_Name_Two__c']);

    const sheetNames = Object.keys(output);
    expect(sheetNames).toHaveLength(2);
    expect(new Set(sheetNames).size).toBe(2);
    sheetNames.forEach((sheetName) => expect(sheetName.length).toBeLessThanOrEqual(31));
  });

  test('replaces characters Excel does not allow in a worksheet name', () => {
    expect(Object.keys(prepareSplitExport(['Bad:Name/Object']))).toEqual(['Bad_Name_Object']);
  });

  /** The errors and object metadata sheets are added first, so an object with the same name cannot overwrite them */
  test('keeps the errors worksheet when an object has the same name', () => {
    const output = prepareExport(
      [{ sobject: 'Broken', error: 'Something went wrong', metadata: null }, getSobject('ERRORS')],
      {},
      {},
      ['name'],
      OPTIONS,
    );

    expect(Object.keys(output)).toEqual(['ERRORS', 'ERRORS (2)']);
    expect(output['ERRORS']).toEqual([{ sobject: 'Broken', error: 'Something went wrong' }]);
  });
});

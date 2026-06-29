import { Field } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { buildFieldMetadataRows } from '../FieldMetadataModal';

function makeField(overrides: Partial<Field>): Field {
  return {
    name: 'TestField__c',
    label: 'Test Field',
    type: 'string',
    length: 0,
    precision: 0,
    scale: 0,
    custom: false,
    calculated: false,
    nillable: false,
    createable: false,
    updateable: false,
    ...overrides,
  } as Field;
}

function rowById(rows: ReturnType<typeof buildFieldMetadataRows>, id: string) {
  return rows.find((row) => row.id === id);
}

describe('buildFieldMetadataRows', () => {
  test('includes the API name row and all boolean flag rows', () => {
    const rows = buildFieldMetadataRows(
      makeField({ name: 'Account.Name', custom: true, calculated: false, nillable: true, createable: false, updateable: true }),
    );

    expect(rowById(rows, 'fm-name')?.value).toBe('Account.Name');
    expect(rowById(rows, 'fm-custom')?.value).toBe(true);
    expect(rowById(rows, 'fm-calculated')?.value).toBe(false);
    expect(rowById(rows, 'fm-nillable')?.value).toBe(true);
    expect(rowById(rows, 'fm-createable')?.value).toBe(false);
    expect(rowById(rows, 'fm-updateable')?.value).toBe(true);
  });

  test('includes length for string and textarea types', () => {
    const stringRows = buildFieldMetadataRows(makeField({ type: 'string', length: 255 }));
    expect(rowById(stringRows, 'fm-length')?.value).toBe(255);

    const textareaRows = buildFieldMetadataRows(makeField({ type: 'textarea', length: 32768 }));
    expect(rowById(textareaRows, 'fm-length')?.value).toBe(32768);

    // string-like fields are not numeric, so precision/scale are omitted
    expect(rowById(stringRows, 'fm-precision')).toBeUndefined();
    expect(rowById(stringRows, 'fm-scale')).toBeUndefined();
  });

  test('includes precision and scale for numeric types', () => {
    const rows = buildFieldMetadataRows(makeField({ type: 'currency', precision: 18, scale: 2 }));
    expect(rowById(rows, 'fm-precision')?.value).toBe(18);
    expect(rowById(rows, 'fm-scale')?.value).toBe(2);
    // numeric fields are not string-like, so length is omitted
    expect(rowById(rows, 'fm-length')).toBeUndefined();
  });

  test('omits length/precision/scale for an unrelated type (boolean)', () => {
    const rows = buildFieldMetadataRows(makeField({ type: 'boolean' }));
    expect(rowById(rows, 'fm-length')).toBeUndefined();
    expect(rowById(rows, 'fm-precision')).toBeUndefined();
    expect(rowById(rows, 'fm-scale')).toBeUndefined();
  });

  test('does not attach inlineHelpText to the API name row (shown via the Label tooltip and Help Text section instead)', () => {
    const withHelp = buildFieldMetadataRows(makeField({ inlineHelpText: 'Helpful description' }));
    expect(rowById(withHelp, 'fm-name')?.labelHelp).toBeUndefined();
  });
});

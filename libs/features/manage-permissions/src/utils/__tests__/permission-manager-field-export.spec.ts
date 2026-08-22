import { PermissionSetWithProfileRecord, PermissionTableFieldCell } from '@jetstream/types';
import { parse } from 'papaparse';
import { describe, expect, it } from 'vitest';
import { generateFieldCsv, generateFieldWorksheet } from '../permission-manager-export-utils';
import { getFieldColumns } from '../permission-manager-table-utils';

const PROFILE_ID = '0PS1t000000Profile';
const profilesById = {
  [PROFILE_ID]: { Label: 'System Administrator', Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord,
};

/** Object, Field Api Name, Field Label + the four audit columns */
const PREFIX_COLUMN_COUNT = 7;

const columns = getFieldColumns([PROFILE_ID], [], profilesById, {});

function buildRow(overrides: Partial<PermissionTableFieldCell>): PermissionTableFieldCell {
  return {
    key: `Account.${overrides.apiName}`,
    sobject: 'Account',
    apiName: 'Custom__c',
    label: 'Custom',
    tableLabel: 'Custom (Custom__c)',
    type: 'string',
    allowEditPermission: true,
    permissions: {
      [PROFILE_ID]: { read: true, edit: false } as any,
    },
    ...overrides,
  };
}

const customFieldRow = buildRow({
  createdDate: '2020-04-22T14:48:23.000+0000',
  createdBy: 'Austin Turner',
  lastModifiedDate: '2022-05-15T19:44:02.000+0000',
  lastModifiedBy: 'Someone Else',
});
// Standard fields have no audit data in Salesforce
const standardFieldRow = buildRow({ apiName: 'Name', label: 'Account Name' });

describe('generateFieldCsv', () => {
  it('should include the audit columns in the header, before the permission groups', () => {
    const [header1, header2] = parse<string[]>(generateFieldCsv(columns, [customFieldRow])).data;

    expect(header2.slice(0, PREFIX_COLUMN_COUNT)).toEqual([
      'Object',
      'Field Api Name',
      'Field Label',
      'Created Date',
      'Created By',
      'Last Modified Date',
      'Last Modified By',
    ]);
    // The profile group header sits above its Read/Edit pair, after the prefix
    expect(header1.slice(0, PREFIX_COLUMN_COUNT)).toEqual(Array.from({ length: PREFIX_COLUMN_COUNT }, () => ''));
    expect(header1[PREFIX_COLUMN_COUNT]).toBe('System Administrator (Profile)');
    expect(header2.slice(PREFIX_COLUMN_COUNT)).toEqual(['Read', 'Edit']);
  });

  it('should format dates for display and keep the permission values aligned after the prefix', () => {
    const [, , dataRow] = parse<string[]>(generateFieldCsv(columns, [customFieldRow])).data;

    expect(dataRow.slice(0, 3)).toEqual(['Account', 'Custom__c', 'Custom']);
    expect(dataRow[3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    expect(dataRow[4]).toBe('Austin Turner');
    expect(dataRow[5]).toMatch(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    expect(dataRow[6]).toBe('Someone Else');
    expect(dataRow.slice(PREFIX_COLUMN_COUNT)).toEqual(['TRUE', 'FALSE']);
  });

  it('should emit empty cells rather than null or undefined for a field with no audit data', () => {
    const [, , dataRow] = parse<string[]>(generateFieldCsv(columns, [standardFieldRow])).data;
    expect(dataRow.slice(3, PREFIX_COLUMN_COUNT)).toEqual(['', '', '', '']);
  });
});

describe('generateFieldWorksheet', () => {
  it('should shift the profile header merge past the audit columns', () => {
    const worksheet = generateFieldWorksheet(columns, [customFieldRow]);
    // The merged group header spans the profile's Read + Edit columns, which now start after the 7 prefix columns
    expect(worksheet['!merges']?.[0]).toEqual({
      s: { r: 0, c: PREFIX_COLUMN_COUNT },
      e: { r: 0, c: PREFIX_COLUMN_COUNT + 1 },
    });
  });
});

import { EntityParticlePermissionsRecord, FieldPermissionDefinitionMap } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { getFieldRows } from '../permission-manager-table-utils';

function buildFieldPermission(
  apiName: string,
  auditMetadata?: FieldPermissionDefinitionMap['auditMetadata'],
): FieldPermissionDefinitionMap {
  return {
    apiName,
    label: apiName,
    metadata: { DataType: 'string', IsCompound: false, IsUpdatable: true } as EntityParticlePermissionsRecord,
    auditMetadata,
    permissionKeys: [],
    permissions: {},
  };
}

describe('getFieldRows audit metadata', () => {
  it('should flatten audit metadata onto the row so the audit columns can read it by key', () => {
    const rows = getFieldRows(
      ['Account'],
      { Account: ['Account.Custom__c'] },
      {
        'Account.Custom__c': buildFieldPermission('Custom__c', {
          createdDate: '2020-04-22T14:48:23.000+0000',
          createdBy: 'Austin Turner',
          lastModifiedDate: '2022-05-15T19:44:02.000+0000',
          lastModifiedBy: 'Someone Else',
        }),
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      createdDate: '2020-04-22T14:48:23.000+0000',
      createdBy: 'Austin Turner',
      lastModifiedDate: '2022-05-15T19:44:02.000+0000',
      lastModifiedBy: 'Someone Else',
    });
  });

  it('should still build a row for a standard field, which has no audit data in Salesforce', () => {
    const rows = getFieldRows(
      ['Account'],
      { Account: ['Account.Name'] },
      {
        'Account.Name': buildFieldPermission('Name'),
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].createdDate).toBeUndefined();
    expect(rows[0].createdBy).toBeUndefined();
    expect(rows[0].lastModifiedDate).toBeUndefined();
    expect(rows[0].lastModifiedBy).toBeUndefined();
  });
});

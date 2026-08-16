import { describe, expect, test } from 'vitest';
import { CreateFieldParams } from '../create-object-types';
import { getObjectAndTabPermissionRecords } from '../create-object-utils';

function buildParams(overrides: Partial<CreateFieldParams> = {}): CreateFieldParams {
  return {
    apiName: 'myns__ObjName__c',
    createTab: true,
    tabMotif: 'Custom20: Airplane',
    payload: {} as CreateFieldParams['payload'],
    objectPermissions: {
      scope: 'ALL',
      permissions: {
        allowCreate: true,
        allowDelete: false,
        allowEdit: true,
        allowRead: true,
        modifyAllRecords: false,
        viewAllRecords: false,
        viewAllFields: false,
      },
    },
    permissionSets: ['0PS000000000001'],
    profiles: ['00e000000000001'],
    ...overrides,
  };
}

describe('getObjectAndTabPermissionRecords', () => {
  test('uses the api name as given, without re-applying the org namespace', () => {
    // Regression: the namespace was applied here as well as where the form value is read, producing
    // `myns__myns__ObjName__c` and failing the permissions step of an otherwise successful deploy.
    const { objectPermissions, tabPermissions } = getObjectAndTabPermissionRecords(buildParams());

    expect(objectPermissions).toHaveLength(2);
    objectPermissions.forEach((record) => expect(record.SobjectType).toBe('myns__ObjName__c'));

    expect(tabPermissions).toHaveLength(2);
    tabPermissions.forEach((record) => expect(record.Name).toBe('myns__ObjName__c'));
  });

  test('builds one record per profile and permission set for each parent id', () => {
    const { objectPermissions, tabPermissions } = getObjectAndTabPermissionRecords(
      buildParams({ profiles: ['00e1', '00e2'], permissionSets: ['0PS1'] }),
    );

    expect(objectPermissions.map((record) => record.ParentId)).toEqual(['00e1', '00e2', '0PS1']);
    expect(tabPermissions.map((record) => record.ParentId)).toEqual(['00e1', '00e2', '0PS1']);
  });

  test('omits tab permissions when no tab is created', () => {
    const { objectPermissions, tabPermissions } = getObjectAndTabPermissionRecords(buildParams({ createTab: false }));

    expect(objectPermissions).toHaveLength(2);
    expect(tabPermissions).toHaveLength(0);
  });

  test('leaves a non-namespaced api name untouched', () => {
    const { objectPermissions } = getObjectAndTabPermissionRecords(buildParams({ apiName: 'ObjName__c' }));

    objectPermissions.forEach((record) => expect(record.SobjectType).toBe('ObjName__c'));
  });
});

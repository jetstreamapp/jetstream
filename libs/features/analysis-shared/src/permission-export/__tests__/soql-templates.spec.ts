import { describe, expect, it } from 'vitest';
import {
  buildFieldPermissionsByParentSoql,
  buildMutingPermissionSetsByIdSoql,
  buildObjectPermissionsByParentSoql,
  buildPermissionSetAssignmentsByPermissionSetSoql,
  buildPermissionSetByIdSoql,
  buildPermissionSetGroupByIdSoql,
  buildPermissionSetGroupComponentsByGroupSoql,
  buildPermissionSetGroupComponentsByPermissionSetSoql,
  buildTabSettingsByParentSoql,
} from '../soql-templates';

describe('soql-templates permission export', () => {
  it('buildPermissionSetByIdSoql composes a PermissionSet IN clause', () => {
    const soql = buildPermissionSetByIdSoql(['p1', 'p2']);
    expect(soql).toContain('FROM PermissionSet');
    expect(soql).toContain("Id IN ('p1', 'p2')");
  });

  it('buildObjectPermissionsByParentSoql composes parent IN with no object filter', () => {
    const soql = buildObjectPermissionsByParentSoql(['p1']);
    expect(soql).toContain('FROM ObjectPermissions');
    expect(soql).toContain("ParentId IN ('p1')");
    expect(soql).not.toContain('SobjectType IN');
  });

  it('buildObjectPermissionsByParentSoql adds optional SobjectType filter', () => {
    const soql = buildObjectPermissionsByParentSoql(['p1'], ['Account', 'Case']);
    expect(soql).toContain("ParentId IN ('p1')");
    expect(soql).toContain("SobjectType IN ('Account', 'Case')");
    expect(soql).toContain(' AND ');
  });

  it('buildFieldPermissionsByParentSoql adds optional SobjectType filter', () => {
    const soql = buildFieldPermissionsByParentSoql(['p1'], ['Foo__c']);
    expect(soql).toContain('FROM FieldPermissions');
    expect(soql).toContain("ParentId IN ('p1')");
    expect(soql).toContain("SobjectType IN ('Foo__c')");
  });

  it('buildTabSettingsByParentSoql composes a PermissionSetTabSetting query', () => {
    const soql = buildTabSettingsByParentSoql(['p1', 'p2']);
    expect(soql).toContain('FROM PermissionSetTabSetting');
    expect(soql).toContain("ParentId IN ('p1', 'p2')");
  });

  it('buildPermissionSetAssignmentsByPermissionSetSoql composes assignment query', () => {
    const soql = buildPermissionSetAssignmentsByPermissionSetSoql(['p1']);
    expect(soql).toContain('FROM PermissionSetAssignment');
    expect(soql).toContain("PermissionSetId IN ('p1')");
  });

  it('buildPermissionSetGroupComponentsByPermissionSetSoql composes group component query', () => {
    const soql = buildPermissionSetGroupComponentsByPermissionSetSoql(['p1']);
    expect(soql).toContain('FROM PermissionSetGroupComponent');
    expect(soql).toContain("PermissionSetId IN ('p1')");
  });

  it('buildPermissionSetGroupByIdSoql composes group query', () => {
    const soql = buildPermissionSetGroupByIdSoql(['g1']);
    expect(soql).toContain('FROM PermissionSetGroup');
    expect(soql).toContain("Id IN ('g1')");
  });

  it('buildPermissionSetGroupComponentsByGroupSoql composes component-by-group query', () => {
    const soql = buildPermissionSetGroupComponentsByGroupSoql(['g1']);
    expect(soql).toContain('FROM PermissionSetGroupComponent');
    expect(soql).toContain("PermissionSetGroupId IN ('g1')");
  });

  it('buildMutingPermissionSetsByIdSoql filters MutingPermissionSet by Id (it has no group column)', () => {
    const soql = buildMutingPermissionSetsByIdSoql(['0QM000000000001']);
    expect(soql).toContain('FROM MutingPermissionSet');
    expect(soql).toContain("Id IN ('0QM000000000001')");
    expect(soql).not.toContain('PermissionSetGroupId');
  });
});

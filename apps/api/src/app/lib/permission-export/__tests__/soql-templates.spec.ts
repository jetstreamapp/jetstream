import { describe, expect, it } from 'vitest';
import { buildFieldPermissionsByParentSoql, buildObjectPermissionsByParentSoql } from '../soql-templates';

describe('soql-templates permission export', () => {
  it('buildObjectPermissionsByParentSoql adds optional SobjectType filter', () => {
    const base = buildObjectPermissionsByParentSoql("'p1'");
    expect(base).toContain('WHERE ParentId IN');
    expect(base).not.toContain('SobjectType IN');

    const scoped = buildObjectPermissionsByParentSoql("'p1'", "'Account','Case'");
    expect(scoped).toContain("AND SobjectType IN ('Account','Case')");
  });

  it('buildFieldPermissionsByParentSoql adds optional SobjectType filter', () => {
    const scoped = buildFieldPermissionsByParentSoql("'p1'", "'Foo__c'");
    expect(scoped).toContain("AND SobjectType IN ('Foo__c')");
  });
});

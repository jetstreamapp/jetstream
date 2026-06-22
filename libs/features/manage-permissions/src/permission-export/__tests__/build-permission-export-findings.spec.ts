import { describe, expect, it } from 'vitest';
import { buildIssueCodeSummary, buildPermissionExportFindings } from '../build-permission-export-findings';

describe('buildPermissionExportFindings', () => {
  it('returns empty when there are no permission rows', () => {
    expect(buildPermissionExportFindings([], [])).toEqual([]);
  });

  it('emits FLS_READ_NO_OBJECT_READ when field Read is true but object does not grant effective read', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        PermissionsRead: false,
        PermissionsViewAllRecords: false,
        PermissionsModifyAllRecords: false,
      },
    ];
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        Field: 'Account.Name',
        PermissionsRead: true,
      },
    ];
    const findings = buildPermissionExportFindings(objectPermissions, fieldPermissions);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('FLS_READ_NO_OBJECT_READ');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].objectApiName).toBe('Account');
    expect(findings[0].fieldApiName).toBe('Account.Name');
  });

  it('does not emit FLS_READ_NO_OBJECT_READ when object grants View All Records without Read', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        PermissionsRead: false,
        PermissionsViewAllRecords: true,
      },
    ];
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        Field: 'Account.Name',
        PermissionsRead: true,
      },
    ];
    expect(buildPermissionExportFindings(objectPermissions, fieldPermissions)).toHaveLength(0);
  });

  it('emits FLS_EDIT_NO_OBJECT_EDIT when field Edit is true but object does not grant effective edit', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Contact',
        PermissionsEdit: false,
        PermissionsModifyAllRecords: false,
      },
    ];
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Contact',
        Field: 'Contact.FirstName',
        PermissionsEdit: true,
      },
    ];
    const findings = buildPermissionExportFindings(objectPermissions, fieldPermissions);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('FLS_EDIT_NO_OBJECT_EDIT');
  });

  it('does not emit FLS_EDIT_NO_OBJECT_EDIT when object grants Modify All Records without Edit', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        PermissionsEdit: false,
        PermissionsModifyAllRecords: true,
      },
    ];
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        Field: 'Account.Name',
        PermissionsEdit: true,
      },
    ];
    expect(buildPermissionExportFindings(objectPermissions, fieldPermissions)).toHaveLength(0);
  });

  it('emits FLS_WITHOUT_OLS_ROW when field rows exist but there is no object permission row', () => {
    const parentId = '0PS000000000001';
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Case',
        Field: 'Case.Subject',
        PermissionsRead: true,
      },
    ];
    const findings = buildPermissionExportFindings([], fieldPermissions);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('FLS_WITHOUT_OLS_ROW');
    expect(findings[0].objectApiName).toBe('Case');
  });

  it('does not emit per-field FLS_READ when missing OLS row (FLS_WITHOUT_OLS_ROW covers the case)', () => {
    const parentId = '0PS000000000001';
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Lead',
        Field: 'Lead.Name',
        PermissionsRead: true,
      },
    ];
    const findings = buildPermissionExportFindings([], fieldPermissions);
    expect(findings.map((f) => f.code)).toEqual(['FLS_WITHOUT_OLS_ROW']);
  });

  it('emits OLS_READ_NO_FLS_ROWS when object Read is true and there are no field rows for that parent+object', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Opportunity',
        PermissionsRead: true,
      },
    ];
    const findings = buildPermissionExportFindings(objectPermissions, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('OLS_READ_NO_FLS_ROWS');
    expect(findings[0].severity).toBe('warning');
  });

  it('emits OLS_EDIT_NO_FLS_ROWS when object Edit is true and there are no field rows', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Task',
        PermissionsEdit: true,
        PermissionsRead: false,
      },
    ];
    const findings = buildPermissionExportFindings(objectPermissions, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('OLS_EDIT_NO_FLS_ROWS');
  });

  it('does not emit OLS_READ_NO_FLS_ROWS when at least one field permission exists for the object', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        PermissionsRead: true,
      },
    ];
    const fieldPermissions = [
      {
        ParentId: parentId,
        SobjectType: 'Account',
        Field: 'Account.Name',
        PermissionsRead: false,
      },
    ];
    expect(buildPermissionExportFindings(objectPermissions, fieldPermissions)).toHaveLength(0);
  });
});

describe('buildIssueCodeSummary', () => {
  it('aggregates counts by code', () => {
    const summary = buildIssueCodeSummary([
      { code: 'FLS_READ_NO_OBJECT_READ', severity: 'error' },
      { code: 'FLS_READ_NO_OBJECT_READ', severity: 'error' },
      { code: 'OLS_READ_NO_FLS_ROWS', severity: 'warning' },
    ]);
    expect(summary.FLS_READ_NO_OBJECT_READ).toEqual({ count: 2, errors: 2, warnings: 0 });
    expect(summary.OLS_READ_NO_FLS_ROWS).toEqual({ count: 1, errors: 0, warnings: 1 });
  });
});

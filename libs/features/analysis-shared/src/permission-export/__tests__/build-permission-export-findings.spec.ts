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
    // Re-tiered: inert FLS-without-OLS is a warning, not an error (errors are reserved for real exposure).
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].objectApiName).toBe('Account');
    expect(findings[0].fieldApiName).toBe('Account.Name');
  });

  it('does not emit FLS_READ_NO_OBJECT_READ when object grants View All Records (but flags the broad access)', () => {
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
    const codes = buildPermissionExportFindings(objectPermissions, fieldPermissions).map((f) => f.code);
    expect(codes).not.toContain('FLS_READ_NO_OBJECT_READ');
    expect(codes).toEqual(['OBJECT_VIEW_ALL_RECORDS']);
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

  it('does not emit FLS_EDIT_NO_OBJECT_EDIT when object grants Modify All Records (but flags the broad access)', () => {
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
    const codes = buildPermissionExportFindings(objectPermissions, fieldPermissions).map((f) => f.code);
    expect(codes).not.toContain('FLS_EDIT_NO_OBJECT_EDIT');
    expect(codes).toEqual(['OBJECT_MODIFY_ALL_RECORDS']);
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

describe('buildPermissionExportFindings — group-aware suppression', () => {
  it('suppresses FLS_WITHOUT_OLS_ROW when a sibling permission set in the same group supplies object read', () => {
    const flsOnly = '0PS00000000FLS1';
    const olsOnly = '0PS00000000OLS1';
    const objectPermissions = [{ ParentId: olsOnly, SobjectType: 'Account', PermissionsRead: true }];
    const fieldPermissions = [{ ParentId: flsOnly, SobjectType: 'Account', Field: 'Account.Name', PermissionsRead: true }];
    const context = {
      permissionSetGroupComponents: [
        { PermissionSetGroupId: '0PG1', PermissionSetId: flsOnly },
        { PermissionSetGroupId: '0PG1', PermissionSetId: olsOnly },
      ],
    };
    const codes = buildPermissionExportFindings(objectPermissions, fieldPermissions, context).map((f) => f.code);
    // The FLS-only building block is satisfied by the OLS-only sibling in group 0PG1 → no false positive.
    expect(codes).not.toContain('FLS_WITHOUT_OLS_ROW');
    expect(codes).not.toContain('FLS_READ_NO_OBJECT_READ');
  });

  it('still flags (softened) when the group contains a muting permission set', () => {
    const flsOnly = '0PS00000000FLS1';
    const olsOnly = '0PS00000000OLS1';
    const objectPermissions = [{ ParentId: olsOnly, SobjectType: 'Account', PermissionsRead: true }];
    const fieldPermissions = [{ ParentId: flsOnly, SobjectType: 'Account', Field: 'Account.Name', PermissionsRead: true }];
    const context = {
      permissionSetGroupComponents: [
        { PermissionSetGroupId: '0PG1', PermissionSetId: flsOnly },
        { PermissionSetGroupId: '0PG1', PermissionSetId: olsOnly },
      ],
      mutingPermissionSets: [{ PermissionSetGroupId: '0PG1' }],
    };
    const findings = buildPermissionExportFindings(objectPermissions, fieldPermissions, context);
    const flsFinding = findings.find((f) => f.code === 'FLS_WITHOUT_OLS_ROW');
    expect(flsFinding).toBeDefined();
    expect(flsFinding?.partOfGroupId).toBe('0PG1');
    expect(String(flsFinding?.message)).toContain('muting');
  });
});

describe('buildPermissionExportFindings — read+edit dedup', () => {
  it('emits only the edit finding when a field is misaligned on both read and edit', () => {
    const parentId = '0PS000000000001';
    const objectPermissions = [{ ParentId: parentId, SobjectType: 'Account', PermissionsRead: false, PermissionsEdit: false }];
    const fieldPermissions = [
      { ParentId: parentId, SobjectType: 'Account', Field: 'Account.Name', PermissionsRead: true, PermissionsEdit: true },
    ];
    const codes = buildPermissionExportFindings(objectPermissions, fieldPermissions).map((f) => f.code);
    expect(codes).toEqual(['FLS_EDIT_NO_OBJECT_EDIT']);
  });
});

describe('buildPermissionExportFindings — new findings', () => {
  it('flags high-risk and elevated system permissions', () => {
    const context = {
      permissionSets: [
        { Id: '0PS1', Label: 'Power PS', IsOwnedByProfile: false, PermissionsModifyAllData: true, PermissionsExportReport: true },
      ],
      // Avoid an orphaned-permset finding muddying the assertion.
      permissionSetAssignments: [{ PermissionSetId: '0PS1', AssigneeId: '005000000000001' }],
    };
    const findings = buildPermissionExportFindings([], [], context);
    const byCode = findings.map((f) => f.code);
    expect(byCode).toContain('SYSTEM_PERM_HIGH_RISK');
    expect(byCode).toContain('SYSTEM_PERM_ELEVATED');
    expect(findings.find((f) => f.code === 'SYSTEM_PERM_HIGH_RISK')?.severity).toBe('error');
    expect(findings.find((f) => f.code === 'SYSTEM_PERM_ELEVATED')?.severity).toBe('warning');
  });

  it('flags orphaned permission sets (no assignment, not in a group, not a profile)', () => {
    const context = {
      permissionSets: [
        { Id: '0PS_ORPHAN', Label: 'Unused', IsOwnedByProfile: false },
        { Id: '0PS_PROFILE', Label: 'Admin', IsOwnedByProfile: true },
      ],
      permissionSetAssignments: [],
    };
    const codes = buildPermissionExportFindings([], [], context).map((f) => f.code);
    expect(codes).toContain('PERMSET_NO_ASSIGNMENTS');
    // Profile-owned sets are never flagged as orphaned.
    expect(codes.filter((c) => c === 'PERMSET_NO_ASSIGNMENTS')).toHaveLength(1);
  });

  it('does not flag orphaned permission sets when assignment data was truncated', () => {
    const context = {
      permissionSets: [{ Id: '0PS_ORPHAN', Label: 'Unused', IsOwnedByProfile: false }],
      permissionSetAssignments: [],
      truncatedCategories: ['permissionSetAssignments'],
    };
    const codes = buildPermissionExportFindings([], [], context).map((f) => f.code);
    expect(codes).not.toContain('PERMSET_NO_ASSIGNMENTS');
  });

  it('flags a visible tab with no object read, and ignores tabs whose object has read', () => {
    const parentId = '0PS1';
    const objectPermissions = [{ ParentId: parentId, SobjectType: 'Contact', PermissionsRead: true }];
    const context = {
      permissionSetTabSettings: [
        { ParentId: parentId, Name: 'standard-Account', Visibility: 'DefaultOn' },
        { ParentId: parentId, Name: 'standard-Contact', Visibility: 'DefaultOn' },
        { ParentId: parentId, Name: 'My_VF_Tab', Visibility: 'DefaultOn' },
      ],
    };
    const findings = buildPermissionExportFindings(objectPermissions, [], context).filter((f) => f.code === 'TAB_VISIBLE_NO_OBJECT_READ');
    expect(findings).toHaveLength(1);
    expect(findings[0].objectApiName).toBe('Account');
  });
});

describe('buildPermissionExportFindings — truncation and scope suppression', () => {
  const parentId = '0PS1';

  it('does not emit OLS_*_NO_FLS_ROWS when field permissions were truncated', () => {
    const objectPermissions = [{ ParentId: parentId, SobjectType: 'Account', PermissionsRead: true, PermissionsEdit: true }];
    const codes = buildPermissionExportFindings(objectPermissions, [], { truncatedCategories: ['fieldPermissions'] }).map((f) => f.code);
    expect(codes).not.toContain('OLS_READ_NO_FLS_ROWS');
    expect(codes).not.toContain('OLS_EDIT_NO_FLS_ROWS');
  });

  it('does not emit FLS_WITHOUT_OLS_ROW when object permissions were truncated', () => {
    const fieldPermissions = [{ ParentId: parentId, SobjectType: 'Case', Field: 'Case.Subject', PermissionsRead: true }];
    const codes = buildPermissionExportFindings([], fieldPermissions, { truncatedCategories: ['objectPermissions'] }).map((f) => f.code);
    expect(codes).not.toContain('FLS_WITHOUT_OLS_ROW');
  });

  it('does not emit TAB_VISIBLE_NO_OBJECT_READ when object permissions were truncated', () => {
    const context = {
      permissionSetTabSettings: [{ ParentId: parentId, Name: 'standard-Account', Visibility: 'DefaultOn' }],
      truncatedCategories: ['objectPermissions'],
    };
    const codes = buildPermissionExportFindings([], [], context).map((f) => f.code);
    expect(codes).not.toContain('TAB_VISIBLE_NO_OBJECT_READ');
  });

  it('only evaluates tab findings for in-scope objects when the export was object-scoped', () => {
    const context = {
      permissionSetTabSettings: [
        { ParentId: parentId, Name: 'standard-Account', Visibility: 'DefaultOn' },
        { ParentId: parentId, Name: 'standard-Contact', Visibility: 'DefaultOn' },
      ],
      objectScope: ['Account'],
    };
    const findings = buildPermissionExportFindings([], [], context).filter((f) => f.code === 'TAB_VISIBLE_NO_OBJECT_READ');
    // Contact tab is skipped — its ObjectPermissions rows were never fetched, so "no access" cannot be proven.
    expect(findings).toHaveLength(1);
    expect(findings[0].objectApiName).toBe('Account');
  });

  it('does not emit OLS_READ_NO_FLS_ROWS when View All Fields is granted (intentional no-FLS setup)', () => {
    const objectPermissions = [{ ParentId: parentId, SobjectType: 'Account', PermissionsRead: true, PermissionsViewAllFields: true }];
    const codes = buildPermissionExportFindings(objectPermissions, []).map((f) => f.code);
    expect(codes).not.toContain('OLS_READ_NO_FLS_ROWS');
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

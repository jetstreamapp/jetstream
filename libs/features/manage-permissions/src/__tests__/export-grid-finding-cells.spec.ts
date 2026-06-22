import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  FIELD_PERMISSION_OBJECT_SCOPE_MARKER,
  buildContainerIdFindingSeverity,
  buildFieldPermissionFindingCellHighlights,
  buildPermissionSetAssigneeIdsByPermissionSetId,
  buildPermissionSetAssignmentsTreeRows,
  buildPermissionSetGroupLabelMap,
  buildPermissionSetIdToGroupIdsMap,
  buildUserAssignmentsTreeRows,
  fieldPermissionCellSeverity,
  fieldPermissionFindingRowKey,
  listFindingsForExportContainer,
  listFindingsForFieldPermissionCell,
  sortUserAssignmentsTreeRowsByUserDisplay,
} from '../permission-export-result-view';

describe('buildFieldPermissionFindingCellHighlights', () => {
  it('maps FLS read mismatch to PermissionsRead for the field row key', () => {
    const parentId = '0PS1';
    const findings = [
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'Account',
        fieldApiName: 'Account.Name',
        parentId,
        permissionSetId: parentId,
      },
    ];
    const map = buildFieldPermissionFindingCellHighlights(findings);
    const rowKey = fieldPermissionFindingRowKey(parentId, 'Account', 'Account.Name');
    expect(map.get(rowKey)?.get('PermissionsRead')).toBe('error');
  });

  it('maps FLS_WITHOUT_OLS_ROW to object scope marker and Read/Edit columns', () => {
    const parentId = '0PS2';
    const findings = [
      {
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        severity: 'error',
        objectApiName: 'Contact',
        parentId,
      },
    ];
    const map = buildFieldPermissionFindingCellHighlights(findings);
    const scopeKey = fieldPermissionFindingRowKey(parentId, 'Contact', FIELD_PERMISSION_OBJECT_SCOPE_MARKER);
    expect(map.get(scopeKey)?.get('PermissionsRead')).toBe('error');
    expect(map.get(scopeKey)?.get('PermissionsEdit')).toBe('error');
  });

  it('resolves fieldPermissionCellSeverity from scope marker for any field row on Read', () => {
    const parentId = '0PS3';
    const highlights = buildFieldPermissionFindingCellHighlights([
      {
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        severity: 'error',
        objectApiName: 'Case',
        parentId,
      },
    ]);
    const severity = fieldPermissionCellSeverity(highlights, parentId, 'Case', 'Case.Subject', 'PermissionsRead');
    expect(severity).toBe('error');
  });
});

describe('listFindingsForFieldPermissionCell', () => {
  it('returns FLS_WITHOUT_OLS for any field on the object', () => {
    const parentId = '0PS9';
    const findings = [
      {
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        severity: 'error',
        objectApiName: 'Lead',
        parentId,
      },
    ];
    const matches = listFindingsForFieldPermissionCell(findings, parentId, 'Lead', 'Lead.Company', 'PermissionsRead');
    expect(matches).toHaveLength(1);
  });

  it('requires field match for FLS read code', () => {
    const parentId = '0PS8';
    const findings = [
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'Account',
        fieldApiName: 'Account.Name',
        parentId,
      },
    ];
    expect(listFindingsForFieldPermissionCell(findings, parentId, 'Account', 'Account.Name', 'PermissionsRead')).toHaveLength(1);
    expect(listFindingsForFieldPermissionCell(findings, parentId, 'Account', 'Account.Other__c', 'PermissionsRead')).toHaveLength(0);
  });
});

describe('buildContainerIdFindingSeverity and listFindingsForExportContainer', () => {
  it('aggregates max severity per container id', () => {
    const id = '0PS55';
    const findings = [
      { code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS, severity: 'warning', objectApiName: 'A', parentId: id },
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'B',
        fieldApiName: 'B.x',
        parentId: id,
      },
    ];
    const sev = buildContainerIdFindingSeverity(findings);
    expect(sev.get(id)).toBe('error');
    const listed = listFindingsForExportContainer(findings, id);
    expect(listed).toHaveLength(2);
  });

  it('uses row severity when issue code is not in the catalog (forward-compatible jobs)', () => {
    const id = '0PS77';
    const findings = [
      {
        code: 'FUTURE_ISSUE_CODE_V1',
        severity: 'error',
        objectApiName: 'Account',
        parentId: id,
        permissionSetId: id,
      },
    ];
    const sev = buildContainerIdFindingSeverity(findings);
    expect(sev.get(id)).toBe('error');
  });

  it('excludes FINDINGS_TRUNCATED from container drill-in', () => {
    const id = '0PS66';
    const findings = [
      { code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ, severity: 'error', objectApiName: 'X', parentId: id },
      { code: PermissionExportFindingCode.FINDINGS_TRUNCATED, severity: 'warning', message: 'cap' },
    ];
    expect(listFindingsForExportContainer(findings, id)).toHaveLength(1);
  });
});

describe('buildPermissionSetAssigneeIdsByPermissionSetId', () => {
  it('groups only user assignees (005 prefix), dedupes, and sorts', () => {
    const psId = '0PS000000000001';
    const map = buildPermissionSetAssigneeIdsByPermissionSetId([
      { PermissionSetId: psId, AssigneeId: '005000000000002' },
      { PermissionSetId: psId, AssigneeId: '005000000000001' },
      { PermissionSetId: psId, AssigneeId: '005000000000002' },
      { PermissionSetId: psId, AssigneeId: '00G000000000003' },
    ]);
    expect(map.get(psId)).toEqual(['005000000000001', '005000000000002']);
  });
});

describe('buildPermissionSetAssignmentsTreeRows', () => {
  it('emits one leaf per user and a placeholder when there are no user assignees', () => {
    const psA = '0PS0000000000AA';
    const psB = '0PS0000000000BB';
    const permSets = [
      { Id: psA, Label: 'Alpha', Name: 'Alpha' },
      { Id: psB, Label: 'Beta', Name: 'Beta' },
    ];
    const assignments = [
      { PermissionSetId: psA, AssigneeId: '005000000000001' },
      { PermissionSetId: psA, AssigneeId: '005000000000002' },
    ];
    const leaves = buildPermissionSetAssignmentsTreeRows(permSets, assignments);
    const byGroup = new Map<string, string[]>();
    for (const row of leaves) {
      const groupKey = String(row._treePermissionSetGroupKey);
      const list = byGroup.get(groupKey) ?? [];
      if (row._noDirectUserAssignments) {
        list.push('placeholder');
      } else if (typeof row.AssigneeId === 'string') {
        list.push(row.AssigneeId);
      }
      byGroup.set(groupKey, list);
    }
    expect(byGroup.get(psA)).toEqual(['005000000000001', '005000000000002']);
    expect(byGroup.get(psB)).toEqual(['placeholder']);
  });

  it('orders permission set groups alphabetically by display label', () => {
    const psA = '0PS0000000000AA';
    const psB = '0PS0000000000BB';
    const permSets = [
      { Id: psB, Label: 'Zebra', Name: 'Zebra' },
      { Id: psA, Label: 'Alpha', Name: 'Alpha' },
    ];
    const leaves = buildPermissionSetAssignmentsTreeRows(permSets, []);
    const groupOrder = [...new Set(leaves.map((row) => row._treePermissionSetGroupKey))];
    expect(groupOrder).toEqual([psA, psB]);
  });
});

describe('buildUserAssignmentsTreeRows', () => {
  it('groups by user: profile first, permission sets (alpha), inferred groups, then licenses', () => {
    const u1 = '005000000000001';
    const u2 = '005000000000002';
    const ps1 = '0PS000000000001';
    const ps2 = '0PS000000000002';
    const g1 = '0PG000000000001';
    const assignments = [
      { PermissionSetId: ps1, AssigneeId: u1 },
      { PermissionSetId: ps2, AssigneeId: u1 },
      { PermissionSetId: ps1, AssigneeId: u2 },
    ];
    const permissionSets = [
      { Id: ps1, Label: 'B Perm', Name: 'B_Perm' },
      { Id: ps2, Label: 'A Perm', Name: 'A_Perm' },
    ];
    const groupComponents = [
      { PermissionSetId: ps1, PermissionSetGroupId: g1 },
      { PermissionSetId: ps2, PermissionSetGroupId: g1 },
    ];
    const groups = [{ Id: g1, MasterLabel: 'My Group', DeveloperName: 'My_Group' }];
    const licensesByUserId = new Map([
      [u1, [{ permissionSetLicenseId: '0PL000000000001', label: 'License B' }]],
      [u2, [{ permissionSetLicenseId: '0PL000000000002', label: 'License A' }]],
    ]);

    const rows = buildUserAssignmentsTreeRows({
      assignments,
      permissionSets,
      groupComponents: groupComponents,
      groups,
      licensesByUserId,
    });

    const kindsForUser = (userId: string) => rows.filter((row) => row._treeUserGroupKey === userId).map((row) => row._leafKind);

    expect(kindsForUser(u1)).toEqual(['profile', 'permission_set', 'permission_set', 'permission_set_group', 'permission_set_license']);
    expect(kindsForUser(u2)).toEqual(['profile', 'permission_set', 'permission_set_group', 'permission_set_license']);

    const psLeavesU1 = rows.filter((row) => row._treeUserGroupKey === u1 && row._leafKind === 'permission_set');
    expect(psLeavesU1.map((row) => row._permissionSetId)).toEqual([ps2, ps1]);

    const groupLeaf = rows.find((row) => row._leafKind === 'permission_set_group' && row._treeUserGroupKey === u1);
    expect(groupLeaf?._permissionSetGroupId).toBe(g1);

    const licenseLeaf = rows.find((row) => row._leafKind === 'permission_set_license' && row._treeUserGroupKey === u1);
    expect(licenseLeaf?._licenseLabel).toBe('License B');
  });
});

describe('buildPermissionSetIdToGroupIdsMap', () => {
  it('maps permission set Ids to group Ids', () => {
    const map = buildPermissionSetIdToGroupIdsMap([
      { PermissionSetId: '0PS1', PermissionSetGroupId: '0PG1' },
      { PermissionSetId: '0PS1', PermissionSetGroupId: '0PG2' },
    ]);
    expect([...(map.get('0PS1') ?? [])].sort()).toEqual(['0PG1', '0PG2']);
  });
});

describe('buildPermissionSetGroupLabelMap', () => {
  it('prefers MasterLabel over DeveloperName', () => {
    const map = buildPermissionSetGroupLabelMap([{ Id: '0PG1', MasterLabel: 'Nice', DeveloperName: 'X' }]);
    expect(map.get('0PG1')).toBe('Nice');
  });
});

describe('sortUserAssignmentsTreeRowsByUserDisplay', () => {
  it('orders user blocks by display label', () => {
    const rows = [
      { Id: '1', _treeUserGroupKey: '005B', _leafKind: 'profile' as const },
      { Id: '2', _treeUserGroupKey: '005A', _leafKind: 'profile' as const },
    ];
    const sorted = sortUserAssignmentsTreeRowsByUserDisplay(
      rows,
      new Map([
        ['005A', 'Zebra'],
        ['005B', 'Alpha'],
      ]),
    );
    expect(sorted.map((row) => row._treeUserGroupKey)).toEqual(['005B', '005A']);
  });
});

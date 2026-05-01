import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  FIELD_PERMISSION_OBJECT_SCOPE_MARKER,
  buildContainerIdFindingSeverity,
  buildFieldPermissionFindingCellHighlights,
  buildPermissionSetAssigneeIdsByPermissionSetId,
  buildPermissionSetAssignmentsTreeRows,
  fieldPermissionCellSeverity,
  fieldPermissionFindingRowKey,
  listFindingsForExportContainer,
  listFindingsForFieldPermissionCell,
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

  it('maps FLS_WITHOUT_OLS_ROW to object scope marker and Field/SobjectType columns', () => {
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
    expect(map.get(scopeKey)?.get('Field')).toBe('error');
    expect(map.get(scopeKey)?.get('SobjectType')).toBe('error');
  });

  it('resolves fieldPermissionCellSeverity from scope marker for any field row', () => {
    const parentId = '0PS3';
    const highlights = buildFieldPermissionFindingCellHighlights([
      {
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        severity: 'error',
        objectApiName: 'Case',
        parentId,
      },
    ]);
    const severity = fieldPermissionCellSeverity(highlights, parentId, 'Case', 'Case.Subject', 'Field');
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
    const matches = listFindingsForFieldPermissionCell(findings, parentId, 'Lead', 'Lead.Company', 'Field');
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

import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  FIELD_PERMISSION_OBJECT_SCOPE_MARKER,
  buildContainerIdFindingSeverity,
  buildFieldPermissionFindingCellHighlights,
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

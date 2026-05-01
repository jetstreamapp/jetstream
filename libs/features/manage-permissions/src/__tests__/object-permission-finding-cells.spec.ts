import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  buildObjectPermissionFindingCellHighlights,
  formatTabSettingVisibilityDisplay,
  getFindingCodeDisplayParts,
  getObjectPermissionHighlightColumnKeysForFindingCode,
  listFindingsForObjectPermissionCell,
  objectPermissionFindingRowKey,
  sortObjectPermissionExportRowsForAnalysisTree,
  sortTabSettingExportRowsForAnalysisTree,
  type PermissionAnalysisFinding,
} from '../permission-export-result-view';

describe('buildObjectPermissionFindingCellHighlights', () => {
  it('returns an empty map when there are no findings', () => {
    expect(buildObjectPermissionFindingCellHighlights([]).size).toBe(0);
  });

  it('maps OLS read warning to PermissionsRead on the matching row key', () => {
    const parentId = '0PSxx0000001';
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        severity: 'warning',
        objectApiName: 'Account',
        parentId,
      },
    ];
    const map = buildObjectPermissionFindingCellHighlights(findings);
    const rowKey = objectPermissionFindingRowKey(parentId, 'Account');
    expect(map.get(rowKey)?.get('PermissionsRead')).toBe('warning');
  });

  it('maps FLS read without object read to read-path columns as error', () => {
    const parentId = '0PSyy0000002';
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'Contact',
        permissionSetId: parentId,
      },
    ];
    const map = buildObjectPermissionFindingCellHighlights(findings);
    const rowKey = objectPermissionFindingRowKey(parentId, 'Contact');
    expect(map.get(rowKey)?.get('PermissionsRead')).toBe('error');
    expect(map.get(rowKey)?.get('PermissionsViewAllRecords')).toBe('error');
    expect(map.get(rowKey)?.get('PermissionsModifyAllRecords')).toBe('error');
  });

  it('prefers error over warning when the same cell is targeted', () => {
    const parentId = '0PSzz0000003';
    const rowKey = objectPermissionFindingRowKey(parentId, 'Case');
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        severity: 'warning',
        objectApiName: 'Case',
        parentId,
      },
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'Case',
        parentId,
      },
    ];
    const map = buildObjectPermissionFindingCellHighlights(findings);
    expect(map.get(rowKey)?.get('PermissionsRead')).toBe('error');
  });

  it('ignores FINDINGS_TRUNCATED', () => {
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.FINDINGS_TRUNCATED,
        severity: 'warning',
        message: 'cap',
      },
    ];
    expect(buildObjectPermissionFindingCellHighlights(findings).size).toBe(0);
  });
});

describe('listFindingsForObjectPermissionCell', () => {
  it('returns findings that highlight the requested column on the row', () => {
    const parentId = '0PS000000001';
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        severity: 'error',
        objectApiName: 'Account',
        parentId,
        message: 'Field X read without object read',
        fieldApiName: 'Account.MyField__c',
      },
      {
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        severity: 'warning',
        objectApiName: 'Account',
        parentId,
        message: 'OLS only',
      },
    ];
    const forRead = listFindingsForObjectPermissionCell(findings, parentId, 'Account', 'PermissionsRead');
    expect(forRead).toHaveLength(2);
    const forViewAll = listFindingsForObjectPermissionCell(findings, parentId, 'Account', 'PermissionsViewAllRecords');
    expect(forViewAll).toHaveLength(1);
    expect(forViewAll[0]?.code).toBe(PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ);
  });

  it('returns empty when parent or object does not match', () => {
    const findings: PermissionAnalysisFinding[] = [
      {
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        severity: 'warning',
        objectApiName: 'Contact',
        parentId: '0PS1',
      },
    ];
    expect(listFindingsForObjectPermissionCell(findings, '0PS1', 'Account', 'PermissionsRead')).toEqual([]);
  });
});

describe('getFindingCodeDisplayParts', () => {
  it('uses catalog label as title and keeps raw code for technical suffix', () => {
    const parts = getFindingCodeDisplayParts(PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS);
    expect(parts.technicalCode).toBe(PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS);
    expect(parts.title).toContain('field permission');
    expect(parts.title).not.toMatch(/^OLS_/);
  });

  it('returns raw code as title when unknown', () => {
    const parts = getFindingCodeDisplayParts('UNKNOWN_FUTURE_CODE');
    expect(parts.title).toBe('UNKNOWN_FUTURE_CODE');
    expect(parts.technicalCode).toBeNull();
  });
});

describe('getObjectPermissionHighlightColumnKeysForFindingCode', () => {
  it('returns read-path columns for FLS_READ_NO_OBJECT_READ', () => {
    expect(getObjectPermissionHighlightColumnKeysForFindingCode(PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ)).toEqual([
      'PermissionsRead',
      'PermissionsViewAllRecords',
      'PermissionsModifyAllRecords',
    ]);
  });

  it('returns empty for codes that do not map to object-permission cells', () => {
    expect(getObjectPermissionHighlightColumnKeysForFindingCode(PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW)).toEqual([]);
    expect(getObjectPermissionHighlightColumnKeysForFindingCode('UNKNOWN')).toEqual([]);
  });
});

describe('sortObjectPermissionExportRowsForAnalysisTree', () => {
  const psProfile = '0PSPROFILE000001';
  const psStandalone = '0PSSTAND00000001';

  it('orders profile-owned parents before standalone permission sets, then by parent label', () => {
    const permissionSetRows = [
      {
        Id: psStandalone,
        Label: 'Zebra Perm',
        Name: 'Zebra',
        IsOwnedByProfile: false,
      },
      {
        Id: psProfile,
        Label: 'X00ignored',
        Name: 'X',
        IsOwnedByProfile: true,
        Profile: { Name: 'Alpha Profile' },
      },
    ];
    const objectPermissionRows = [
      { ParentId: psStandalone, SobjectType: 'Account', Id: 'op1' },
      { ParentId: psProfile, SobjectType: 'Contact', Id: 'op2' },
    ];
    const sorted = sortObjectPermissionExportRowsForAnalysisTree(objectPermissionRows, permissionSetRows);
    expect(sorted.map((row) => row.ParentId)).toEqual([psProfile, psStandalone]);
  });

  it('orders standalone permission sets alphabetically when neither is profile-owned', () => {
    const psB = '0PSBBBB000000001';
    const psA = '0PSAAAA000000001';
    const permissionSetRows = [
      { Id: psB, Label: 'B Perm', Name: 'B', IsOwnedByProfile: false },
      { Id: psA, Label: 'A Perm', Name: 'A', IsOwnedByProfile: false },
    ];
    const objectPermissionRows = [
      { ParentId: psB, SobjectType: 'Account', Id: '1' },
      { ParentId: psA, SobjectType: 'Account', Id: '2' },
    ];
    const sorted = sortObjectPermissionExportRowsForAnalysisTree(objectPermissionRows, permissionSetRows);
    expect(sorted.map((row) => row.ParentId)).toEqual([psA, psB]);
  });

  it('orders objects by metadata label within the same parent', () => {
    const permissionSetRows = [{ Id: psStandalone, Label: 'P', Name: 'P', IsOwnedByProfile: false }];
    const sobjectExportDetails = {
      Zebra__c: { apiName: 'Zebra__c', label: 'Z', description: null },
      Account: { apiName: 'Account', label: 'Account', description: null },
    };
    const objectPermissionRows = [
      { ParentId: psStandalone, SobjectType: 'Zebra__c', Id: '1' },
      { ParentId: psStandalone, SobjectType: 'Account', Id: '2' },
    ];
    const sorted = sortObjectPermissionExportRowsForAnalysisTree(objectPermissionRows, permissionSetRows, sobjectExportDetails);
    expect(sorted.map((row) => row.SobjectType)).toEqual(['Account', 'Zebra__c']);
  });
});

describe('formatTabSettingVisibilityDisplay', () => {
  it('maps DefaultOn to Visible and DefaultOff to Hidden', () => {
    expect(formatTabSettingVisibilityDisplay('DefaultOn')).toBe('Visible');
    expect(formatTabSettingVisibilityDisplay('DefaultOff')).toBe('Hidden');
  });

  it('returns em dash for empty values and raw string for other picklist values', () => {
    expect(formatTabSettingVisibilityDisplay('')).toBe('—');
    expect(formatTabSettingVisibilityDisplay(null)).toBe('—');
    expect(formatTabSettingVisibilityDisplay('Available')).toBe('Available');
  });
});

describe('sortTabSettingExportRowsForAnalysisTree', () => {
  const psProfile = '0PSPROFILE000001';
  const psStandalone = '0PSSTAND00000001';

  it('orders profile-owned parents before standalone permission sets', () => {
    const permissionSetRows = [
      { Id: psStandalone, Label: 'Zebra', Name: 'Zebra', IsOwnedByProfile: false },
      { Id: psProfile, Label: 'X', Name: 'X', IsOwnedByProfile: true, Profile: { Name: 'Admin' } },
    ];
    const tabRows = [
      { ParentId: psStandalone, Name: 'TabA', Visibility: 'DefaultOn', Id: 't1' },
      { ParentId: psProfile, Name: 'TabB', Visibility: 'DefaultOff', Id: 't2' },
    ];
    const sorted = sortTabSettingExportRowsForAnalysisTree(tabRows, permissionSetRows);
    expect(sorted.map((row) => row.ParentId)).toEqual([psProfile, psStandalone]);
  });

  it('orders tabs by Name within the same parent', () => {
    const permissionSetRows = [{ Id: psStandalone, Label: 'P', Name: 'P', IsOwnedByProfile: false }];
    const tabRows = [
      { ParentId: psStandalone, Name: 'Zebra', Visibility: 'DefaultOn', Id: '1' },
      { ParentId: psStandalone, Name: 'Alpha', Visibility: 'DefaultOff', Id: '2' },
    ];
    const sorted = sortTabSettingExportRowsForAnalysisTree(tabRows, permissionSetRows);
    expect(sorted.map((row) => row.Name)).toEqual(['Alpha', 'Zebra']);
  });

  it('orders tabs by TabDefinition label when a label map is provided', () => {
    const permissionSetRows = [{ Id: psStandalone, Label: 'P', Name: 'P', IsOwnedByProfile: false }];
    const tabRows = [
      { ParentId: psStandalone, Name: 'standard-ZebraTab', Visibility: 'DefaultOn', Id: '1' },
      { ParentId: psStandalone, Name: 'standard-AlphaTab', Visibility: 'DefaultOn', Id: '2' },
    ];
    const sortedByApi = sortTabSettingExportRowsForAnalysisTree(tabRows, permissionSetRows);
    expect(sortedByApi.map((row) => row.Name)).toEqual(['standard-AlphaTab', 'standard-ZebraTab']);

    const labelMap = new Map([
      ['standard-ZebraTab', 'Zebra label'],
      ['standard-AlphaTab', 'Alpha label'],
    ]);
    const sortedByLabel = sortTabSettingExportRowsForAnalysisTree(tabRows, permissionSetRows, labelMap);
    expect(sortedByLabel.map((row) => row.Name)).toEqual(['standard-AlphaTab', 'standard-ZebraTab']);
  });
});

/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllWithCacheUsingOffsetMock = vi.fn();

vi.mock('@jetstream/shared/data', () => ({
  queryAllWithCacheUsingOffset: (...args: unknown[]) => queryAllWithCacheUsingOffsetMock(...args),
}));

import { OrgAlignmentComponentItem } from '../orgAlignmentTypes';
import { analyzeToolingDependencies, findStructuralDependencies, ToolingDependencyRecord, useDependencies } from '../useDependencies';

function makeListItem(type: string, fullName: string, id = '01p000000000001AAA'): ListMetadataResult {
  return {
    type,
    fullName,
    fileName: `${type}/${fullName}`,
    id,
    createdById: null,
    createdByName: null,
    createdDate: null,
    lastModifiedById: null,
    lastModifiedByName: null,
    lastModifiedDate: null,
  };
}

function makeComponent(
  type: string,
  fullName: string,
  status: OrgAlignmentComponentItem['status'] = 'onlyInSource',
  id = '01p000000000001AAA',
): OrgAlignmentComponentItem {
  return {
    key: `${type}:${fullName}`,
    type,
    typeLabel: type,
    fullName,
    status,
    isManaged: false,
    sourceItem: makeListItem(type, fullName, id),
    files: [],
    filesLoaded: false,
  };
}

describe('findStructuralDependencies', () => {
  it('flags missing parent CustomObject when deploying a CustomField on a custom object absent from target', () => {
    const fieldComp = makeComponent('CustomField', 'Invoice__c.Amount__c');
    const objComp = makeComponent('CustomObject', 'Invoice__c');
    const allByKey = new Map([
      [fieldComp.key, fieldComp],
      [objComp.key, objComp],
    ]);

    const findings = findStructuralDependencies([fieldComp], allByKey, {
      CustomObject: [makeListItem('CustomObject', 'Account')],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      referencedType: 'CustomObject',
      referencedName: 'Invoice__c',
      severity: 'missing',
      source: 'structural',
      addableComponentKey: 'CustomObject:Invoice__c',
    });
  });

  it('does not flag parent CustomObject when already selected or present in target org', () => {
    const fieldComp = makeComponent('CustomField', 'Invoice__c.Amount__c');
    const objComp = makeComponent('CustomObject', 'Invoice__c');
    const allByKey = new Map([
      [fieldComp.key, fieldComp],
      [objComp.key, objComp],
    ]);

    expect(findStructuralDependencies([fieldComp, objComp], allByKey, { CustomObject: [] })).toHaveLength(0);
    expect(
      findStructuralDependencies([fieldComp], allByKey, {
        CustomObject: [makeListItem('CustomObject', 'Invoice__c')],
      }),
    ).toHaveLength(0);
  });

  it('flags missing ReportFolder when deploying a Report inside an unscanned/absent folder', () => {
    const report = makeComponent('Report', 'ExecFolder/PipelineReport');
    const folder = makeComponent('ReportFolder', 'ExecFolder/');
    const allByKey = new Map([
      [report.key, report],
      [folder.key, folder],
    ]);

    const findings = findStructuralDependencies([report], allByKey, {
      ReportFolder: [makeListItem('ReportFolder', 'OtherFolder/')],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].referencedType).toBe('ReportFolder');
    expect(findings[0].referencedName).toBe('ExecFolder');
    expect(findings[0].addableComponentKey).toBe('ReportFolder:ExecFolder/');
  });
});

describe('analyzeToolingDependencies', () => {
  it('classifies missing, differing, managed, and unscanned dependencies accurately', () => {
    const selectedClass = makeComponent('ApexClass', 'OrderService', 'different', '01p000000000001AAA');
    const missingHelper = makeComponent('ApexClass', 'MissingHelper', 'onlyInSource', '01p000000000002AAA');
    const differingUtil = makeComponent('ApexClass', 'DiffUtil', 'different', '01p000000000003AAA');

    const allByKey = new Map([
      [selectedClass.key, selectedClass],
      [missingHelper.key, missingHelper],
      [differingUtil.key, differingUtil],
    ]);

    const records: ToolingDependencyRecord[] = [
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'OrderService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000002AAA',
        RefMetadataComponentName: 'MissingHelper',
        RefMetadataComponentType: 'ApexClass',
      },
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'OrderService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000003AAA',
        RefMetadataComponentName: 'DiffUtil',
        RefMetadataComponentType: 'ApexClass',
      },
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'OrderService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000004AAA',
        RefMetadataComponentName: 'ManagedApi',
        RefMetadataComponentType: 'ApexClass',
        RefMetadataComponentNamespace: 'acme',
      },
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'OrderService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000005AAA',
        RefMetadataComponentName: 'SomeLabel',
        RefMetadataComponentType: 'CustomLabel',
      },
    ];

    const findings = analyzeToolingDependencies(
      [selectedClass],
      records,
      allByKey,
      { ApexClass: [makeListItem('ApexClass', 'DiffUtil')] },
      new Map([['01p000000000001AAA', selectedClass]]),
    );

    expect(findings.find(({ referencedName }) => referencedName === 'MissingHelper')).toMatchObject({
      severity: 'missing',
      addableComponentKey: 'ApexClass:MissingHelper',
    });
    expect(findings.find(({ referencedName }) => referencedName === 'DiffUtil')).toMatchObject({
      severity: 'differs',
      addableComponentKey: 'ApexClass:DiffUtil',
    });
    expect(findings.find(({ referencedName }) => referencedName === 'acme__ManagedApi')).toMatchObject({
      severity: 'external',
    });
    expect(findings.find(({ referencedName }) => referencedName === 'SomeLabel')).toMatchObject({
      severity: 'external',
    });
  });
});

describe('useDependencies hook', () => {
  const mockOrg = { uniqueId: 'org-a', label: 'UAT' } as SalesforceOrgUi;

  beforeEach(() => {
    queryAllWithCacheUsingOffsetMock.mockReset();
  });

  it('merges structural and Tooling API findings and gracefully preserves structural findings on Tooling failure', async () => {
    queryAllWithCacheUsingOffsetMock.mockRejectedValue(new Error('Tooling API disabled'));

    const fieldComp = makeComponent('CustomField', 'Project__c.Status__c', 'onlyInSource', '00N000000000001AAA');
    const objComp = makeComponent('CustomObject', 'Project__c', 'onlyInSource', '01I000000000001AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        selectedComponents: [fieldComp],
        allSourceComponents: [fieldComp, objComp],
        targetInventoryByType: { CustomObject: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => {
      expect(result.current.toolingApiError).toBe('Tooling API disabled');
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.missingCount).toBe(1);
    expect(result.current.findings[0].referencedName).toBe('Project__c');
  });

  it('returns Tooling API missing dependencies alongside structural checks when Tooling succeeds', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({
      queryResults: {
        records: [
          {
            MetadataComponentId: '01p000000000001AAA',
            MetadataComponentName: 'MainService',
            MetadataComponentType: 'ApexClass',
            RefMetadataComponentId: '01p000000000002AAA',
            RefMetadataComponentName: 'HelperClass',
            RefMetadataComponentType: 'ApexClass',
          },
        ],
      },
    });

    const mainClass = makeComponent('ApexClass', 'MainService', 'onlyInSource', '01p000000000001AAA');
    const helperClass = makeComponent('ApexClass', 'HelperClass', 'onlyInSource', '01p000000000002AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        selectedComponents: [mainClass],
        allSourceComponents: [mainClass, helperClass],
        targetInventoryByType: { ApexClass: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.findings).toHaveLength(1);
    });

    expect(result.current.toolingApiError).toBeNull();
    expect(result.current.findings[0]).toMatchObject({
      referencedType: 'ApexClass',
      referencedName: 'HelperClass',
      severity: 'missing',
      addableComponentKey: 'ApexClass:HelperClass',
    });
  });
});

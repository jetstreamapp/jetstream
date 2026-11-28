/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllWithCacheUsingOffsetMock = vi.fn();

const fetchListMetadataForTypeMock = vi.fn();

vi.mock('@jetstream/shared/data', () => ({
  queryAllWithCacheUsingOffset: (...args: unknown[]) => queryAllWithCacheUsingOffsetMock(...args),
}));

vi.mock('@jetstream/connected-ui', () => ({
  fetchListMetadataForType: (...args: unknown[]) => fetchListMetadataForTypeMock(...args),
  getMetadataLabelFromFullName: (metadataType: string) => metadataType,
}));

import { OrgAlignmentComponentItem } from '../orgAlignmentTypes';
import {
  analyzeToolingDependencies,
  findStructuralDependencies,
  getAddableComponentsByKey,
  getComponentsMissingFromTarget,
  ToolingDependencyRecord,
  useDependencies,
} from '../useDependencies';

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
    fetchListMetadataForTypeMock.mockReset();
  });

  it('merges structural and Tooling API findings and gracefully preserves structural findings on Tooling failure', async () => {
    queryAllWithCacheUsingOffsetMock.mockRejectedValue(new Error('Tooling API disabled'));

    const fieldComp = makeComponent('CustomField', 'Project__c.Status__c', 'onlyInSource', '00N000000000001AAA');
    const objComp = makeComponent('CustomObject', 'Project__c', 'onlyInSource', '01I000000000001AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        selectedKeys: new Set([fieldComp.key]),
        comparedComponents: [fieldComp, objComp],
        targetInventoryByType: { CustomObject: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => {
      expect(result.current.toolingApiError).toBe('Tooling API disabled');
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.findings.filter(({ severity }) => severity === 'missing')).toHaveLength(1);
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
        selectedKeys: new Set([mainClass.key]),
        comparedComponents: [mainClass, helperClass],
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

  it('looks up referenced types that were not compared and offers the ones missing from the target org', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({
      queryResults: {
        records: [
          {
            MetadataComponentId: '01p000000000001AAA',
            MetadataComponentName: 'MainService',
            MetadataComponentType: 'ApexClass',
            RefMetadataComponentId: '00N000000000001',
            RefMetadataComponentName: 'Status',
            RefMetadataComponentType: 'CustomField',
          },
          {
            MetadataComponentId: '01p000000000001AAA',
            MetadataComponentName: 'MainService',
            MetadataComponentType: 'ApexClass',
            RefMetadataComponentId: '00N000000000002',
            RefMetadataComponentName: 'Priority',
            RefMetadataComponentType: 'CustomField',
          },
        ],
      },
    });
    const targetOrg = { uniqueId: 'org-b', label: 'Production' } as SalesforceOrgUi;
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      error: null,
      items:
        org.uniqueId === 'org-a'
          ? [
              makeListItem('CustomField', 'Project__c.Status__c', '00N000000000001AAA'),
              makeListItem('CustomField', 'Project__c.Priority__c', '00N000000000002AAA'),
            ]
          : [makeListItem('CustomField', 'Project__c.Priority__c', '00N000000000009AAA')],
    }));
    const mainClass = makeComponent('ApexClass', 'MainService', 'onlyInSource', '01p000000000001AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        deployTargetOrg: targetOrg,
        selectedKeys: new Set([mainClass.key]),
        comparedComponents: [mainClass],
        targetInventoryByType: { ApexClass: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.findings).toHaveLength(1);
    });

    // The field that exists in the target org is verified and not reported, the missing one can be added
    expect(result.current.findings[0]).toMatchObject({
      referencedType: 'CustomField',
      referencedName: 'Project__c.Status__c',
      severity: 'missing',
      addableComponentKey: 'CustomField:Project__c.Status__c',
    });
    expect(result.current.findings.filter(({ severity }) => severity === 'external')).toHaveLength(0);
    // The missing field was not part of the comparison, it is offered as a component that only exists in the source org
    expect(result.current.componentsByKey.get('CustomField:Project__c.Status__c')).toMatchObject({ status: 'onlyInSource' });
  });

  it('looks up the parent object of a selected field when custom objects were not compared', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({ queryResults: { records: [] } });
    const targetOrg = { uniqueId: 'org-b', label: 'Production' } as SalesforceOrgUi;
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      error: null,
      items:
        org.uniqueId === 'org-a'
          ? [
              makeListItem('CustomObject', 'Project__c', '01I000000000001AAA'),
              makeListItem('CustomObject', 'Task__c', '01I000000000002AAA'),
            ]
          : [makeListItem('CustomObject', 'Task__c', '01I000000000009AAA')],
    }));
    const missingParentField = makeComponent('CustomField', 'Project__c.Status__c', 'onlyInSource', '00N000000000001AAA');
    const existingParentField = makeComponent('CustomField', 'Task__c.Status__c', 'onlyInSource', '00N000000000002AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        deployTargetOrg: targetOrg,
        selectedKeys: new Set([missingParentField.key, existingParentField.key]),
        comparedComponents: [missingParentField, existingParentField],
        targetInventoryByType: {},
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.findings[0]?.severity).toBe('missing');
    });

    expect(result.current.findings).toHaveLength(1);
    expect(result.current.findings[0]).toMatchObject({
      referencedType: 'CustomObject',
      referencedName: 'Project__c',
      addableComponentKey: 'CustomObject:Project__c',
    });
  });

  it('does not offer managed or uncomparable components, or ones missing from the org being deployed from', () => {
    const managedObject = { ...makeComponent('CustomObject', 'pkg__Thing__c', 'uncomparable'), isManaged: true };
    const uncomparableObject = makeComponent('CustomObject', 'Broken__c', 'uncomparable');
    const sourceOnlyObject = makeComponent('CustomObject', 'Project__c', 'onlyInSource');
    const componentsByKey = new Map([managedObject, uncomparableObject, sourceOnlyObject].map((component) => [component.key, component]));

    expect(Array.from(getAddableComponentsByKey(componentsByKey, 'A_TO_B').keys())).toEqual([sourceOnlyObject.key]);
    // Deploying the other way, the object does not exist in the org being deployed from
    expect(getAddableComponentsByKey(componentsByKey, 'B_TO_A').size).toBe(0);
  });

  it("does not turn a packaging org's own managed components into deployable ones", () => {
    const records: ToolingDependencyRecord[] = [
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'MainService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000002AAA',
        RefMetadataComponentName: 'ReleasedHelper',
        RefMetadataComponentType: 'ApexClass',
      },
      {
        MetadataComponentId: '01p000000000001AAA',
        MetadataComponentName: 'MainService',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '01p000000000003AAA',
        RefMetadataComponentName: 'LocalHelper',
        RefMetadataComponentType: 'ApexClass',
      },
    ];
    const sourceItems: ListMetadataResult[] = [
      // Managed without a namespace prefix, as listed by the org the package is developed in
      { ...makeListItem('ApexClass', 'ReleasedHelper', '01p000000000002AAA'), manageableState: 'released', namespacePrefix: null },
      { ...makeListItem('ApexClass', 'LocalHelper', '01p000000000003AAA'), manageableState: 'unmanaged' },
    ];

    const components = getComponentsMissingFromTarget(records, { ApexClass: { sourceItems, targetItems: [] } }, 'A_TO_B');
    expect(components.map(({ key }) => key)).toEqual(['ApexClass:LocalHelper']);
  });

  it('reports a missing credential without offering to deploy it', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({
      queryResults: {
        records: [
          {
            MetadataComponentId: '01p000000000001AAA',
            MetadataComponentName: 'MainService',
            MetadataComponentType: 'ApexClass',
            RefMetadataComponentId: '0XA000000000001',
            RefMetadataComponentName: 'Billing_API',
            RefMetadataComponentType: 'NamedCredential',
          },
        ],
      },
    });
    const targetOrg = { uniqueId: 'org-b', label: 'Production' } as SalesforceOrgUi;
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      error: null,
      items: org.uniqueId === 'org-a' ? [makeListItem('NamedCredential', 'Billing_API', '0XA000000000001AAA')] : [],
    }));
    const mainClass = makeComponent('ApexClass', 'MainService', 'onlyInSource', '01p000000000001AAA');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        deployTargetOrg: targetOrg,
        selectedKeys: new Set([mainClass.key]),
        comparedComponents: [mainClass],
        targetInventoryByType: { ApexClass: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => expect(result.current.findings).toHaveLength(1));
    expect(result.current.findings[0]).toMatchObject({
      referencedType: 'NamedCredential',
      referencedName: 'Billing_API',
      severity: 'missing',
    });
    expect(result.current.findings[0].addableComponentKey).toBeUndefined();
    expect(result.current.componentsByKey.has('NamedCredential:Billing_API')).toBe(false);
  });

  it('reports the managed parent object of a selected field as missing without offering to add it', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({ queryResults: { records: [] } });
    const field = makeComponent('CustomField', 'pkg__Thing__c.Status__c', 'onlyInSource', '00N000000000001AAA');
    const managedObject = { ...makeComponent('CustomObject', 'pkg__Thing__c', 'uncomparable'), isManaged: true };

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        selectedKeys: new Set([field.key]),
        comparedComponents: [field, managedObject],
        targetInventoryByType: { CustomObject: [] },
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => expect(result.current.checkedAt).not.toBeNull());
    expect(result.current.findings).toHaveLength(1);
    expect(result.current.findings[0]).toMatchObject({ referencedName: 'pkg__Thing__c', severity: 'missing' });
    expect(result.current.findings[0].addableComponentKey).toBeUndefined();
  });

  it('looks up the parent object of components that have no Salesforce id', async () => {
    const targetOrg = { uniqueId: 'org-b', label: 'Production' } as SalesforceOrgUi;
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      error: null,
      items: org.uniqueId === 'org-a' ? [makeListItem('CustomObject', 'Project__c', '01I000000000001AAA')] : [],
    }));
    const listView = makeComponent('ListView', 'Project__c.All', 'onlyInSource', '');

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        deployTargetOrg: targetOrg,
        selectedKeys: new Set([listView.key]),
        comparedComponents: [listView],
        targetInventoryByType: {},
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => expect(result.current.findings[0]?.severity).toBe('missing'));
    expect(queryAllWithCacheUsingOffsetMock).not.toHaveBeenCalled();
    expect(result.current.findings[0]).toMatchObject({ referencedName: 'Project__c', addableComponentKey: 'CustomObject:Project__c' });
  });

  it('lists a type again on recheck when it could not be listed before, without using remembered listings', async () => {
    queryAllWithCacheUsingOffsetMock.mockResolvedValue({ queryResults: { records: [] } });
    const targetOrg = { uniqueId: 'org-b', label: 'Production' } as SalesforceOrgUi;
    fetchListMetadataForTypeMock.mockResolvedValue({ error: 'Request failed', items: [] });
    const field = makeComponent('CustomField', 'Project__c.Status__c', 'onlyInSource', '00N000000000001AAA');
    const selectedKeys = new Set([field.key]);
    const comparedComponents = [field];
    const targetInventoryByType = {};

    const { result } = renderHook(() =>
      useDependencies({
        deploySourceOrg: mockOrg,
        deployTargetOrg: targetOrg,
        selectedKeys,
        comparedComponents,
        targetInventoryByType,
        direction: 'A_TO_B',
      }),
    );

    await waitFor(() => expect(result.current.checkedAt).not.toBeNull());
    expect(result.current.findings[0]).toMatchObject({ referencedName: 'Project__c', severity: 'external' });
    expect(fetchListMetadataForTypeMock).toHaveBeenCalledTimes(2);
    expect(fetchListMetadataForTypeMock.mock.calls[0][2]).toMatchObject({ skipRequestCache: false });
    expect(fetchListMetadataForTypeMock.mock.calls[0][2].skipCacheIfOlderThan).toBeGreaterThan(0);

    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      error: null,
      items: org.uniqueId === 'org-a' ? [makeListItem('CustomObject', 'Project__c', '01I000000000001AAA')] : [],
    }));
    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.findings[0]?.severity).toBe('missing'));
    expect(fetchListMetadataForTypeMock).toHaveBeenCalledTimes(4);
    expect(fetchListMetadataForTypeMock.mock.calls[2][2]).toMatchObject({ skipRequestCache: true });
  });
});

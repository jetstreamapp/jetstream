/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { act, renderHook } from '@testing-library/react';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const describeMetadataMock = vi.fn();
const fetchListMetadataForTypeMock = vi.fn();
const retrieveMetadataChunkedMock = vi.fn();

vi.mock('@jetstream/shared/data', () => ({
  describeMetadata: (...args: unknown[]) => describeMetadataMock(...args),
}));

vi.mock('@jetstream/connected-ui', async () => {
  return {
    COMMON_METADATA_TYPES: ['ApexClass', 'Profile'],
    buildDescribeMetadataMap: ({ metadataObjects }: { metadataObjects: { xmlName: string }[] }) =>
      Object.fromEntries(metadataObjects.map((item) => [item.xmlName, item])),
    METADATA_TYPES_TO_OMIT: new Set<string>(),
    getMetadataLabelFromFullName: (type: string) => type,
    fetchListMetadataForType: (...args: unknown[]) => fetchListMetadataForTypeMock(...args),
  };
});

vi.mock('@jetstream/shared/ui-utils', () => ({
  useBrowserNotifications: () => ({ notifyUser: vi.fn() }),
}));

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ serverUrl: 'https://getjetstream.app' }),
  };
});

vi.mock('../../view-or-compare-metadata/retrieveMetadataChunked', () => ({
  retrieveMetadataChunked: (...args: unknown[]) => retrieveMetadataChunkedMock(...args),
}));

import { OrgAlignmentTypeResult } from '../orgAlignmentTypes';
import { getTypesToCompareAgain, MAX_TYPES_COMPARED_IN_PARALLEL, useOrgAlignmentCompare } from '../useOrgAlignmentCompare';

const orgA = { uniqueId: 'org-a', label: 'Dev', username: 'dev@example.com' } as SalesforceOrgUi;
const orgB = { uniqueId: 'org-b', label: 'Prod', username: 'prod@example.com' } as SalesforceOrgUi;

function makeListItem(type: string, fullName: string): ListMetadataResult {
  return {
    type,
    fullName,
    fileName: `${type}/${fullName}`,
    id: '01p000000000001AAA',
    createdById: null,
    createdByName: null,
    createdDate: null,
    lastModifiedById: null,
    lastModifiedByName: null,
    lastModifiedDate: null,
    manageableState: 'unmanaged',
  };
}

describe('useOrgAlignmentCompare', () => {
  beforeEach(() => {
    describeMetadataMock.mockReset();
    fetchListMetadataForTypeMock.mockReset();
    retrieveMetadataChunkedMock.mockReset();

    describeMetadataMock.mockResolvedValue({
      data: {
        metadataObjects: [
          { xmlName: 'ApexClass', inFolder: false, childXmlNames: [] },
          { xmlName: 'NamedCredential', inFolder: false, childXmlNames: [] },
        ],
        organizationNamespace: null,
        partialSaveAllowed: true,
        testRequired: false,
      },
    });
  });

  it('marks uncomparable types without listing/retrieving, set-diffs first, and retrieves only shared candidates', async () => {
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi) => {
      if (org.uniqueId === 'org-a') {
        return {
          items: [makeListItem('ApexClass', 'OnlyInA'), makeListItem('ApexClass', 'SharedCls')],
        };
      }
      return {
        items: [makeListItem('ApexClass', 'OnlyInB'), makeListItem('ApexClass', 'SharedCls')],
      };
    });

    retrieveMetadataChunkedMock.mockImplementation(async (org: SalesforceOrgUi) => ({
      zip: new JSZip(),
      fileProperties: [
        {
          type: 'ApexClass',
          fullName: 'SharedCls',
          fileName: 'classes/SharedCls.cls',
          id: '01p000000000001AAA',
          createdById: '',
          createdByName: '',
          createdDate: '',
          lastModifiedById: '',
          lastModifiedByName: '',
          lastModifiedDate: '',
          content: org.uniqueId === 'org-a' ? 'class SharedCls { /* v1 */ }' : 'class SharedCls { /* v2 */ }',
        },
      ],
    }));

    const { result } = renderHook(() => useOrgAlignmentCompare());
    const onComplete = vi.fn();

    await act(async () => {
      await result.current.runComparison({
        sourceOrg: orgA,
        targetOrg: orgB,
        selectionMode: 'custom',
        selectedMetadataTypes: ['ApexClass', 'NamedCredential'],
        includeManaged: false,
        normalizePermissionXml: true,
        onComplete,
      });
    });

    const namedCred = result.current.typeResults.find(({ type }) => type === 'NamedCredential');
    expect(namedCred?.executionStatus).toBe('uncomparable');
    expect(namedCred?.uncomparableReason).toBeTruthy();

    // NamedCredential must never be passed to listMetadata
    expect(fetchListMetadataForTypeMock).toHaveBeenCalledTimes(2);

    // Retrieve was called ONLY with SharedCls, not OnlyInA or OnlyInB
    expect(retrieveMetadataChunkedMock).toHaveBeenCalledTimes(2);
    expect(retrieveMetadataChunkedMock.mock.calls[0][1].ApexClass.map(({ fullName }: ListMetadataResult) => fullName)).toEqual([
      'SharedCls',
    ]);

    const apexResult = result.current.typeResults.find(({ type }) => type === 'ApexClass');
    expect(apexResult?.executionStatus).toBe('complete');
    expect(apexResult?.counts).toMatchObject({
      onlyInSource: 1,
      onlyInTarget: 1,
      different: 1,
      same: 0,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('compares profiles last and retrieves them together with the components they refer to', async () => {
    describeMetadataMock.mockResolvedValue({
      data: {
        metadataObjects: [
          { xmlName: 'ApexClass', inFolder: false, childXmlNames: [] },
          { xmlName: 'Profile', inFolder: false, childXmlNames: [] },
        ],
      },
    });
    fetchListMetadataForTypeMock.mockImplementation(async (org: SalesforceOrgUi, { type }: { type: string }) => ({
      items:
        type === 'Profile'
          ? [makeListItem('Profile', 'Admin')]
          : [makeListItem('ApexClass', 'SharedCls'), makeListItem('ApexClass', org.uniqueId === 'org-a' ? 'OnlyInA' : 'OnlyInB')],
    }));
    retrieveMetadataChunkedMock.mockResolvedValue({ zip: new JSZip(), fileProperties: [] });

    const { result } = renderHook(() => useOrgAlignmentCompare());
    await act(async () => {
      await result.current.runComparison({
        sourceOrg: orgA,
        targetOrg: orgB,
        selectionMode: 'custom',
        selectedMetadataTypes: ['Profile', 'ApexClass'],
        includeManaged: false,
        normalizePermissionXml: true,
      });
    });

    const retrievedTypes = retrieveMetadataChunkedMock.mock.calls.map(([, metadata]) => Object.keys(metadata)[0]);
    expect(retrievedTypes).toEqual(['ApexClass', 'ApexClass', 'Profile', 'Profile']);

    const [sourceOrg, , sourceOptions] = retrieveMetadataChunkedMock.mock.calls[2];
    const [, , targetOptions] = retrieveMetadataChunkedMock.mock.calls[3];
    expect(sourceOrg.uniqueId).toBe('org-a');
    const getCompanionNames = (options: { includeWithEveryChunk: Record<string, ListMetadataResult[]> }) =>
      options.includeWithEveryChunk.ApexClass.map(({ fullName }) => fullName);
    // Each org is asked for its own classes, including the ones the other org does not have
    expect(getCompanionNames(sourceOptions)).toEqual(['SharedCls', 'OnlyInA']);
    expect(getCompanionNames(targetOptions)).toEqual(['SharedCls', 'OnlyInB']);
    expect(sourceOptions.includeFile({ type: 'ApexClass' })).toBe(false);
    expect(sourceOptions.includeFile({ type: 'Profile' })).toBe(true);
  });

  it('compares a few types at a time and leaves profiles until every other type is done', async () => {
    const otherTypes = ['ApexClass', 'ApexPage', 'ApexTrigger', 'Flow', 'Layout'];
    describeMetadataMock.mockResolvedValue({
      data: { metadataObjects: ['Profile', ...otherTypes].map((xmlName) => ({ xmlName, inFolder: false, childXmlNames: [] })) },
    });
    const typesInProgress = new Set<string>();
    const finishedTypes = new Set<string>();
    let mostTypesInProgress = 0;
    let otherTypesFinishedBeforeProfile = 0;
    fetchListMetadataForTypeMock.mockImplementation(async (_org: SalesforceOrgUi, { type }: { type: string }) => {
      if (type === 'Profile') {
        otherTypesFinishedBeforeProfile = finishedTypes.size;
      }
      typesInProgress.add(type);
      mostTypesInProgress = Math.max(mostTypesInProgress, typesInProgress.size);
      await new Promise((resolve) => setTimeout(resolve, 5));
      typesInProgress.delete(type);
      finishedTypes.add(type);
      return { items: [] };
    });

    const { result } = renderHook(() => useOrgAlignmentCompare());
    await act(async () => {
      await result.current.runComparison({
        sourceOrg: orgA,
        targetOrg: orgB,
        selectionMode: 'custom',
        selectedMetadataTypes: ['Profile', ...otherTypes],
        includeManaged: false,
        normalizePermissionXml: true,
      });
    });

    expect(mostTypesInProgress).toBe(MAX_TYPES_COMPARED_IN_PARALLEL);
    expect(otherTypesFinishedBeforeProfile).toBe(otherTypes.length);
    expect(result.current.typeResults.every(({ executionStatus }) => executionStatus === 'complete')).toBe(true);
    expect(result.current.progress.completedTypes).toBe(otherTypes.length + 1);
  });

  it('captures per-type errors and supports retrying only failed types', async () => {
    let attempt = 0;
    fetchListMetadataForTypeMock.mockImplementation(async () => {
      attempt += 1;
      if (attempt <= 2) {
        throw new Error('Salesforce timeout');
      }
      return { items: [makeListItem('ApexClass', 'Recovered')] };
    });

    retrieveMetadataChunkedMock.mockResolvedValue({
      zip: new JSZip(),
      fileProperties: [
        {
          type: 'ApexClass',
          fullName: 'Recovered',
          fileName: 'classes/Recovered.cls',
          id: '01p000000000001AAA',
          createdById: '',
          createdByName: '',
          createdDate: '',
          lastModifiedById: '',
          lastModifiedByName: '',
          lastModifiedDate: '',
          content: 'same',
        },
      ],
    });

    const { result } = renderHook(() => useOrgAlignmentCompare());

    await act(async () => {
      await result.current.runComparison({
        sourceOrg: orgA,
        targetOrg: orgB,
        selectionMode: 'custom',
        selectedMetadataTypes: ['ApexClass'],
        includeManaged: false,
        normalizePermissionXml: true,
      });
    });

    expect(result.current.typeResults[0].executionStatus).toBe('error');
    expect(result.current.typeResults[0].errorMessage).toBe('Salesforce timeout');

    await act(async () => {
      await result.current.retryTypes(['ApexClass']);
    });

    expect(result.current.typeResults[0].executionStatus).toBe('complete');
    expect(result.current.typeResults[0].counts.same).toBe(1);
  });
});

describe('getTypesToCompareAgain', () => {
  const makeTypeResult = (type: string, executionStatus: OrgAlignmentTypeResult['executionStatus']) =>
    ({ type, executionStatus }) as OrgAlignmentTypeResult;

  it('includes the completed parent type and profiles that used the results of a retried type', () => {
    const typeResults = [
      makeTypeResult('CustomField', 'error'),
      makeTypeResult('CustomObject', 'complete'),
      makeTypeResult('Profile', 'complete'),
      makeTypeResult('StaticResource', 'complete'),
    ];
    expect(getTypesToCompareAgain(['CustomField'], typeResults)).toEqual(['CustomObject', 'Profile']);
    expect(getTypesToCompareAgain(['CustomObject'], typeResults)).toEqual(['Profile']);
    expect(getTypesToCompareAgain(['StaticResource'], typeResults)).toEqual([]);
  });
});

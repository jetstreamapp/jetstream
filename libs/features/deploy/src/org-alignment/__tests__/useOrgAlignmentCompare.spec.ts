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

vi.mock('../../view-or-compare-metadata/useViewOrCompareMetadata', () => ({
  retrieveMetadataChunked: (...args: unknown[]) => retrieveMetadataChunkedMock(...args),
}));

import { useOrgAlignmentCompare } from '../useOrgAlignmentCompare';

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

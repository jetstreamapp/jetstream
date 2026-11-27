import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { FilePropertiesWithContent } from '../../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { getMetadataTypeComparability, isManagedListMetadataItem } from '../orgAlignmentMetadataClassification';
import { OrgAlignmentTypeResult } from '../orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildChangeReviewMarkdown,
  buildDriftReportFlatRows,
  buildDriftReportWorkbookData,
  buildTypeComparisonComponents,
  componentsToListMetadataMap,
  getOverwrittenTargetComponentsMap,
  isComponentDeployableInDirection,
  setDiffListMetadata,
} from '../orgAlignmentUtils';

function makeListItem(overrides: Partial<ListMetadataResult> & { type: string; fullName: string }): ListMetadataResult {
  return {
    createdById: '005000000000001',
    createdByName: 'Alice',
    createdDate: new Date('2026-01-01T00:00:00Z'),
    fileName: `${overrides.type}/${overrides.fullName}`,
    id: '01p000000000001AAA',
    lastModifiedById: '005000000000001',
    lastModifiedByName: 'Alice',
    lastModifiedDate: new Date('2026-01-10T00:00:00Z'),
    manageableState: 'unmanaged',
    namespacePrefix: null,
    ...overrides,
  };
}

function makeFileProps(
  overrides: Partial<FilePropertiesWithContent> & { type: string; fullName: string; fileName: string },
): FilePropertiesWithContent {
  return {
    createdById: '005000000000001',
    createdByName: 'Alice',
    createdDate: '2026-01-01T00:00:00Z',
    id: '01p000000000001AAA',
    lastModifiedById: '005000000000001',
    lastModifiedByName: 'Alice',
    lastModifiedDate: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

const mockOrgA = { uniqueId: 'org-a', label: 'UAT', username: 'uat@example.com' } as SalesforceOrgUi;
const mockOrgB = { uniqueId: 'org-b', label: 'Prod', username: 'prod@example.com' } as SalesforceOrgUi;

describe('orgAlignmentMetadataClassification', () => {
  it('marks settings, credentials, and installed packages as uncomparable with explicit reasons', () => {
    expect(getMetadataTypeComparability('Settings').comparable).toBe(false);
    expect(getMetadataTypeComparability('SecuritySettings').comparable).toBe(false);
    expect(getMetadataTypeComparability('NamedCredential').comparable).toBe(false);
    expect(getMetadataTypeComparability('ConnectedApp').comparable).toBe(false);
    expect(getMetadataTypeComparability('InstalledPackage').comparable).toBe(false);
    expect(getMetadataTypeComparability('NamedCredential').reason).toBeTruthy();

    expect(getMetadataTypeComparability('ApexClass').comparable).toBe(true);
    expect(getMetadataTypeComparability('Profile').comparable).toBe(true);
    expect(getMetadataTypeComparability('RemoteSiteSetting').comparable).toBe(true);
  });

  it('detects managed package components cleanly', () => {
    expect(isManagedListMetadataItem({ manageableState: 'installed' })).toBe(true);
    expect(isManagedListMetadataItem({ manageableState: 'installedEditable' })).toBe(true);
    expect(isManagedListMetadataItem({ manageableState: 'released' })).toBe(true);
    expect(isManagedListMetadataItem({ manageableState: 'unmanaged' })).toBe(false);
    expect(isManagedListMetadataItem({ manageableState: undefined })).toBe(false);
  });
});

describe('orgAlignmentUtils', () => {
  it('set-diffs listMetadata into onlyInSource, onlyInTarget, and shared candidates while skipping managed by default', () => {
    const sourceItems = [
      makeListItem({ type: 'ApexClass', fullName: 'OnlyInA' }),
      makeListItem({ type: 'ApexClass', fullName: 'Shared' }),
      makeListItem({ type: 'ApexClass', fullName: 'ManagedCls', manageableState: 'installed', namespacePrefix: 'pkg' }),
    ];
    const targetItems = [
      makeListItem({ type: 'ApexClass', fullName: 'OnlyInB' }),
      makeListItem({ type: 'ApexClass', fullName: 'Shared' }),
      makeListItem({ type: 'ApexClass', fullName: 'ManagedCls', manageableState: 'installed', namespacePrefix: 'pkg' }),
    ];

    const excludedResult = setDiffListMetadata(sourceItems, targetItems, { includeManaged: false });
    expect(excludedResult.onlyInSource.map(({ fullName }) => fullName)).toEqual(['OnlyInA']);
    expect(excludedResult.onlyInTarget.map(({ fullName }) => fullName)).toEqual(['OnlyInB']);
    expect(excludedResult.candidates.map(({ fullName }) => fullName)).toEqual(['Shared']);
    expect(excludedResult.managedSkippedCount).toBe(1);
    expect(excludedResult.managedUncomparable).toHaveLength(0);

    const includedResult = setDiffListMetadata(sourceItems, targetItems, { includeManaged: true });
    expect(includedResult.managedSkippedCount).toBe(0);
    expect(includedResult.managedUncomparable).toHaveLength(1);
  });

  it('classifies shared candidates into different, same, and uncomparable (when zip content is missing)', () => {
    const setDiff = setDiffListMetadata(
      [
        makeListItem({ type: 'ApexClass', fullName: 'SameClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'DiffClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'UnreadableClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'OnlyA' }),
      ],
      [
        makeListItem({ type: 'ApexClass', fullName: 'SameClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'DiffClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'UnreadableClass' }),
        makeListItem({ type: 'ApexClass', fullName: 'OnlyB' }),
      ],
    );

    const sourceFiles = [
      makeFileProps({ type: 'ApexClass', fullName: 'SameClass', fileName: 'classes/SameClass.cls', content: 'public class SameClass {}' }),
      makeFileProps({
        type: 'ApexClass',
        fullName: 'DiffClass',
        fileName: 'classes/DiffClass.cls',
        content: 'public class DiffClass { int a = 1; }',
      }),
    ];
    const targetFiles = [
      makeFileProps({ type: 'ApexClass', fullName: 'SameClass', fileName: 'classes/SameClass.cls', content: 'public class SameClass {}' }),
      makeFileProps({
        type: 'ApexClass',
        fullName: 'DiffClass',
        fileName: 'classes/DiffClass.cls',
        content: 'public class DiffClass { int a = 2; }',
      }),
    ];

    const { components, counts } = buildTypeComparisonComponents('ApexClass', setDiff, sourceFiles, targetFiles);

    expect(counts).toEqual({
      onlyInSource: 1,
      onlyInTarget: 1,
      different: 1,
      same: 1,
      uncomparable: 1,
      managedSkipped: 0,
    });
    expect(components.find(({ fullName }) => fullName === 'DiffClass')?.status).toBe('different');
    expect(components.find(({ fullName }) => fullName === 'SameClass')?.status).toBe('same');
    expect(components.find(({ fullName }) => fullName === 'UnreadableClass')?.status).toBe('uncomparable');
    expect(components.find(({ fullName }) => fullName === 'OnlyA')?.status).toBe('onlyInSource');
    expect(components.find(({ fullName }) => fullName === 'OnlyB')?.status).toBe('onlyInTarget');
  });

  it('groups multi-file LWC bundle files under a single logical component', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'LightningComponentBundle', fullName: 'myWidget' })],
      [makeListItem({ type: 'LightningComponentBundle', fullName: 'myWidget' })],
    );
    const sourceFiles = [
      makeFileProps({
        type: 'LightningComponentBundle',
        fullName: 'myWidget/myWidget.js',
        fileName: 'lwc/myWidget/myWidget.js',
        content: 'export default class {}',
      }),
      makeFileProps({
        type: 'LightningComponentBundle',
        fullName: 'myWidget/myWidget.html',
        fileName: 'lwc/myWidget/myWidget.html',
        content: '<template>A</template>',
      }),
    ];
    const targetFiles = [
      makeFileProps({
        type: 'LightningComponentBundle',
        fullName: 'myWidget/myWidget.js',
        fileName: 'lwc/myWidget/myWidget.js',
        content: 'export default class {}',
      }),
      makeFileProps({
        type: 'LightningComponentBundle',
        fullName: 'myWidget/myWidget.html',
        fileName: 'lwc/myWidget/myWidget.html',
        content: '<template>B</template>',
      }),
    ];

    const { components } = buildTypeComparisonComponents('LightningComponentBundle', setDiff, sourceFiles, targetFiles);
    expect(components).toHaveLength(1);
    expect(components[0].status).toBe('different');
    expect(components[0].files).toHaveLength(2);
  });

  it('extracts individual CustomField blocks from parent CustomObject XML so sibling fields are compared independently', () => {
    const setDiff = setDiffListMetadata(
      [
        makeListItem({ type: 'CustomField', fullName: 'Account.Same__c' }),
        makeListItem({ type: 'CustomField', fullName: 'Account.Changed__c' }),
      ],
      [
        makeListItem({ type: 'CustomField', fullName: 'Account.Same__c' }),
        makeListItem({ type: 'CustomField', fullName: 'Account.Changed__c' }),
      ],
    );

    const objectXmlA = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <fields><fullName>Same__c</fullName><label>Same</label></fields>
  <fields><fullName>Changed__c</fullName><label>Old Label</label></fields>
</CustomObject>`;
    const objectXmlB = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <fields><fullName>Same__c</fullName><label>Same</label></fields>
  <fields><fullName>Changed__c</fullName><label>New Label</label></fields>
</CustomObject>`;

    const { components, counts } = buildTypeComparisonComponents(
      'CustomField',
      setDiff,
      [makeFileProps({ type: 'CustomObject', fullName: 'Account', fileName: 'objects/Account.object', content: objectXmlA })],
      [makeFileProps({ type: 'CustomObject', fullName: 'Account', fileName: 'objects/Account.object', content: objectXmlB })],
    );

    expect(counts).toMatchObject({ same: 1, different: 1, uncomparable: 0 });
    expect(components.find(({ fullName }) => fullName === 'Account.Same__c')?.status).toBe('same');
    expect(components.find(({ fullName }) => fullName === 'Account.Changed__c')?.status).toBe('different');
  });

  it('enforces bidirectional deployability and computes overwritten target backup maps', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'ApexClass', fullName: 'OnlyA' }), makeListItem({ type: 'ApexClass', fullName: 'DiffCls' })],
      [makeListItem({ type: 'ApexClass', fullName: 'OnlyB' }), makeListItem({ type: 'ApexClass', fullName: 'DiffCls' })],
    );
    const { components } = buildTypeComparisonComponents(
      'ApexClass',
      setDiff,
      [makeFileProps({ type: 'ApexClass', fullName: 'DiffCls', fileName: 'classes/DiffCls.cls', content: 'v1' })],
      [makeFileProps({ type: 'ApexClass', fullName: 'DiffCls', fileName: 'classes/DiffCls.cls', content: 'v2' })],
    );

    const onlyA = components.find(({ fullName }) => fullName === 'OnlyA')!;
    const onlyB = components.find(({ fullName }) => fullName === 'OnlyB')!;
    const diff = components.find(({ fullName }) => fullName === 'DiffCls')!;

    expect(isComponentDeployableInDirection(onlyA, 'A_TO_B')).toBe(true);
    expect(isComponentDeployableInDirection(onlyA, 'B_TO_A')).toBe(false);
    expect(isComponentDeployableInDirection(onlyB, 'A_TO_B')).toBe(false);
    expect(isComponentDeployableInDirection(onlyB, 'B_TO_A')).toBe(true);
    expect(isComponentDeployableInDirection(diff, 'A_TO_B')).toBe(true);
    expect(isComponentDeployableInDirection(diff, 'B_TO_A')).toBe(true);

    const deployPayload = componentsToListMetadataMap([onlyA, diff], 'A_TO_B');
    expect(deployPayload.ApexClass).toHaveLength(2);

    const backupMap = getOverwrittenTargetComponentsMap([onlyA, diff], 'A_TO_B');
    expect(backupMap.ApexClass.map(({ fullName }) => fullName)).toEqual(['DiffCls']);
  });

  it('builds workbook, flat rows, and Markdown change-review exports', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'ApexClass', fullName: 'ChangedCls' }), makeListItem({ type: 'ApexClass', fullName: 'SameCls' })],
      [makeListItem({ type: 'ApexClass', fullName: 'ChangedCls' }), makeListItem({ type: 'ApexClass', fullName: 'SameCls' })],
    );
    const { components, counts } = buildTypeComparisonComponents(
      'ApexClass',
      setDiff,
      [
        makeFileProps({ type: 'ApexClass', fullName: 'ChangedCls', fileName: 'classes/ChangedCls.cls', content: 'A' }),
        makeFileProps({ type: 'ApexClass', fullName: 'SameCls', fileName: 'classes/SameCls.cls', content: 'Same' }),
      ],
      [
        makeFileProps({ type: 'ApexClass', fullName: 'ChangedCls', fileName: 'classes/ChangedCls.cls', content: 'B' }),
        makeFileProps({ type: 'ApexClass', fullName: 'SameCls', fileName: 'classes/SameCls.cls', content: 'Same' }),
      ],
    );

    const typeResults: OrgAlignmentTypeResult[] = [
      {
        type: 'ApexClass',
        typeLabel: 'Apex Classes',
        inFolder: false,
        executionStatus: 'complete',
        sourceListItems: [],
        targetListItems: [],
        components,
        counts,
      },
    ];

    expect(aggregateSummaryCounts(typeResults).different).toBe(1);

    const context = {
      sourceOrg: mockOrgA,
      targetOrg: mockOrgB,
      generatedAt: new Date('2026-05-01T10:00:00Z'),
      normalizePermissionXml: true,
      includeManaged: false,
      typeResults,
    };

    const workbook = buildDriftReportWorkbookData(context);
    expect(Object.keys(workbook)).toEqual(['Summary', 'By Metadata Type', 'Differences', 'All Components']);
    expect(workbook.Differences).toHaveLength(1);
    expect(workbook['All Components']).toHaveLength(2);

    const flatDiffs = buildDriftReportFlatRows(context, true);
    expect(flatDiffs).toHaveLength(1);

    const markdown = buildChangeReviewMarkdown(context);
    expect(markdown).toContain('# Org Alignment Drift Report');
    expect(markdown).toContain('ChangedCls');
    expect(markdown).not.toContain('- **SameCls**');
  });
});

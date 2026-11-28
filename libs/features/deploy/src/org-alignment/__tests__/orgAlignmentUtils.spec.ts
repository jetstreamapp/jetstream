import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { FilePropertiesWithContent } from '../../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { mergeMetadataXmlFiles } from '../../view-or-compare-metadata/viewOrCompareMetadataUtils';
import {
  getMetadataTypeComparability,
  getProfileCompanions,
  isManagedListMetadataItem,
  MAX_PROFILE_COMPANIONS_WITH_FILES,
} from '../orgAlignmentMetadataClassification';
import { OrgAlignmentTypeResult } from '../orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildChangeReviewHtml,
  buildChangeReviewMarkdown,
  buildDriftReportFlatRows,
  buildDriftReportWorkbookData,
  buildTypeComparisonComponents,
  componentsToListMetadataMap,
  getOverwrittenTargetComponentsMap,
  groupRetrievedFilesByComponent,
  isComponentDeployableInDirection,
  removeSeparatelyComparedChildren,
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

  it('builds workbook, flat rows, and clipboard summary exports', () => {
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
    expect(markdown).toContain('- **ChangedCls**: Different');
    expect(markdown).not.toContain('SameCls');

    const html = buildChangeReviewHtml(context);
    expect(html).toContain('<h1>Org Alignment Drift Report</h1>');
    expect(html).toContain('<li><strong>ChangedCls</strong>: Different</li>');
    expect(html).not.toContain('SameCls');
  });
});

describe('parent files with separately compared children', () => {
  const getObjectXml = (customFieldLabel: string, description: string) =>
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
      `    <description>${description}</description>`,
      '    <fields>',
      '        <fullName>Custom__c</fullName>',
      `        <label>${customFieldLabel}</label>`,
      '    </fields>',
      '    <fields>',
      '        <fullName>Industry</fullName>',
      '        <trackFeedHistory>false</trackFeedHistory>',
      '    </fields>',
      '</CustomObject>',
    ].join('\n');

  it('removes only the children that are compared on their own', () => {
    const output = removeSeparatelyComparedChildren(
      getObjectXml('Label', 'Accounts'),
      'CustomObject',
      'Account',
      new Set(['CustomField:Account.Custom__c']),
    );
    expect(output).not.toContain('Custom__c');
    // Standard fields are not listed as components, so they stay with the object
    expect(output).toContain('Industry');
    expect(output).toContain('<description>Accounts</description>');
  });

  it('leaves the content alone when nothing is compared separately or the type is not a parent', () => {
    const xml = getObjectXml('Label', 'Accounts');
    expect(removeSeparatelyComparedChildren(xml, 'CustomObject', 'Account', new Set())).toBe(xml);
    expect(removeSeparatelyComparedChildren(xml, 'ApexClass', 'Account', new Set(['CustomField:Account.Custom__c']))).toBe(xml);
    expect(removeSeparatelyComparedChildren('<not-xml', 'CustomObject', 'Account', new Set(['CustomField:Account.Custom__c']))).toBe(
      '<not-xml',
    );
  });

  it('does not report an object as different when only a separately compared field changed', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'CustomObject', fullName: 'Account' })],
      [makeListItem({ type: 'CustomObject', fullName: 'Account' })],
    );
    const getFiles = (customFieldLabel: string, description: string) => [
      makeFileProps({
        type: 'CustomObject',
        fullName: 'Account',
        fileName: 'objects/Account.object',
        content: getObjectXml(customFieldLabel, description),
      }),
    ];
    const separatelyComparedKeys = new Set(['CustomField:Account.Custom__c']);

    const fieldChanged = buildTypeComparisonComponents('CustomObject', setDiff, getFiles('One', 'Accounts'), getFiles('Two', 'Accounts'), {
      separatelyComparedKeys,
    });
    expect(fieldChanged.components[0].status).toBe('same');

    const objectChanged = buildTypeComparisonComponents('CustomObject', setDiff, getFiles('One', 'Accounts'), getFiles('One', 'Changed'), {
      separatelyComparedKeys,
    });
    expect(objectChanged.components[0].status).toBe('different');

    // Without the field being compared on its own, its change still has to surface somewhere
    const fieldNotCompared = buildTypeComparisonComponents(
      'CustomObject',
      setDiff,
      getFiles('One', 'Accounts'),
      getFiles('Two', 'Accounts'),
    );
    expect(fieldNotCompared.components[0].status).toBe('different');
  });
});

describe('content kept after comparing', () => {
  const getFiles = (type: string, fileName: string, content: string) => [makeFileProps({ type, fullName: 'Item', fileName, content })];

  it('releases the content of matching components and keeps it for different ones', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'ApexClass', fullName: 'Item' })],
      [makeListItem({ type: 'ApexClass', fullName: 'Item' })],
    );
    const same = buildTypeComparisonComponents(
      'ApexClass',
      setDiff,
      getFiles('ApexClass', 'classes/Item.cls', 'class Item {}'),
      getFiles('ApexClass', 'classes/Item.cls', 'class Item {}'),
    );
    expect(same.components[0]).toMatchObject({ status: 'same', files: [], filesLoaded: false });

    const different = buildTypeComparisonComponents(
      'ApexClass',
      setDiff,
      getFiles('ApexClass', 'classes/Item.cls', 'class Item {}'),
      getFiles('ApexClass', 'classes/Item.cls', 'class Item { Integer value; }'),
    );
    expect(different.components[0]).toMatchObject({ status: 'different', filesLoaded: true });
    expect(different.components[0].files).toHaveLength(1);
  });

  it('keeps the content of matching permission files so normalization can be toggled without another retrieve', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'Profile', fullName: 'Item' })],
      [makeListItem({ type: 'Profile', fullName: 'Item' })],
    );
    const xml = '<Profile><custom>false</custom></Profile>';
    const { components } = buildTypeComparisonComponents(
      'Profile',
      setDiff,
      getFiles('Profile', 'profiles/Item.profile', xml),
      getFiles('Profile', 'profiles/Item.profile', xml),
    );
    expect(components[0]).toMatchObject({ status: 'same', filesLoaded: true });
    expect(components[0].files).toHaveLength(1);
  });

  it('uses the provided reason when content was deliberately not retrieved', () => {
    const setDiff = setDiffListMetadata(
      [makeListItem({ type: 'Profile', fullName: 'Item' })],
      [makeListItem({ type: 'Profile', fullName: 'Item' })],
    );
    const { components } = buildTypeComparisonComponents('Profile', setDiff, [], [], { uncomparableReason: 'Too many' });
    expect(components[0]).toMatchObject({ status: 'uncomparable', uncomparableReason: 'Too many' });
  });
});

describe('getProfileCompanions', () => {
  it('returns the components profiles refer to and ignores other types', () => {
    const companions = getProfileCompanions({
      ApexClass: [makeListItem({ type: 'ApexClass', fullName: 'One' })],
      CustomField: [makeListItem({ type: 'CustomField', fullName: 'Account.One__c' })],
      Report: [makeListItem({ type: 'Report', fullName: 'Folder/One' })],
      Layout: [],
    });
    expect(Object.keys(companions ?? {})).toEqual(['ApexClass', 'CustomField']);
  });

  it('returns null when there are too many companions to retrieve in one request', () => {
    const classes = Array.from({ length: MAX_PROFILE_COMPANIONS_WITH_FILES + 1 }, (_, i) =>
      makeListItem({ type: 'ApexClass', fullName: `Class${i}` }),
    );
    expect(getProfileCompanions({ ApexClass: classes })).toBeNull();
    // Fields are returned inside their object's file and do not count towards the limit
    const fields = classes.map((item) => ({ ...item, type: 'CustomField' }));
    expect(getProfileCompanions({ CustomField: fields })).not.toBeNull();
  });
});

describe('child components whose parent file is split across retrieve chunks', () => {
  const getObjectFile = (fieldNames: string[]) =>
    makeFileProps({
      type: 'CustomObject',
      fullName: 'Account',
      fileName: 'objects/Account.object',
      content: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
        ...fieldNames.map((fieldName) => `    <fields><fullName>${fieldName}</fullName><label>${fieldName}</label></fields>`),
        '</CustomObject>',
      ].join('\n'),
    });

  it('combines both versions of the file so every child keeps its own content', () => {
    const merged = mergeMetadataXmlFiles(getObjectFile(['First__c']).content as string, getObjectFile(['Second__c']).content as string);
    const filesByComponent = groupRetrievedFilesByComponent(
      [{ ...getObjectFile([]), content: merged as string }],
      new Set(['Account.First__c', 'Account.Second__c']),
      'CustomField',
    );
    expect(filesByComponent.get('Account.First__c')?.[0].content).toContain('<label>First__c</label>');
    expect(filesByComponent.get('Account.Second__c')?.[0].content).toContain('<label>Second__c</label>');
    expect(filesByComponent.get('Account.Second__c')?.[0].content).not.toContain('First__c');
  });

  it('leaves a child that is missing from the parent file without content instead of comparing the whole parent', () => {
    const filesByComponent = groupRetrievedFilesByComponent(
      [getObjectFile(['First__c'])],
      new Set(['Account.First__c', 'Account.Missing__c']),
      'CustomField',
    );
    expect(filesByComponent.has('Account.First__c')).toBe(true);
    expect(filesByComponent.has('Account.Missing__c')).toBe(false);
  });
});

import { ListMetadataResult } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { BUNDLE_RETRIEVE_CHUNK_SIZE, chunkListMetadataForRetrieve, DEFAULT_RETRIEVE_CHUNK_SIZE } from '../viewOrCompareMetadataUtils';
import {
  compareMetadataContents,
  getDisplayContent,
  isPermissionXmlType,
  normalizeMetadataContent,
  normalizePermissionXmlContent,
} from '../xmlNormalizer';

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
  };
}

describe('xmlNormalizer', () => {
  it('identifies Profile and PermissionSet types and file names', () => {
    expect(isPermissionXmlType('Profile')).toBe(true);
    expect(isPermissionXmlType('PermissionSet')).toBe(true);
    expect(isPermissionXmlType('MutingPermissionSet')).toBe(true);
    expect(isPermissionXmlType('PermissionSetGroup')).toBe(true);
    expect(isPermissionXmlType('ApexClass', 'profiles/Admin.profile')).toBe(true);
    expect(isPermissionXmlType('ApexClass', 'permissionsets/Sales.permissionset-meta.xml')).toBe(true);
    expect(isPermissionXmlType('ApexClass', 'classes/MyClass.cls')).toBe(false);
  });

  it('normalizes reordered Profile XML blocks and inner tags to identical output', () => {
    const profileA = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <readable>true</readable>
    <editable>false</editable>
    <field>Account.Beta__c</field>
  </fieldPermissions>
  <fieldPermissions>
    <editable>true</editable>
    <field>Account.Alpha__c</field>
    <readable>true</readable>
  </fieldPermissions>
  <classAccesses>
    <apexClass>ZebraController</apexClass>
    <enabled>true</enabled>
  </classAccesses>
</Profile>`;

    const profileB = `<?xml version="1.0" encoding="UTF-8"?>\r\n
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <classAccesses>
        <enabled>true</enabled>
        <apexClass>ZebraController</apexClass>
    </classAccesses>
    <fieldPermissions>
        <field>Account.Alpha__c</field>
        <editable>true</editable>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <field>Account.Beta__c</field>
        <editable>false</editable>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

    expect(normalizePermissionXmlContent(profileA)).toBe(normalizePermissionXmlContent(profileB));
    expect(compareMetadataContents(profileA, profileB, { metadataType: 'Profile', normalizePermissionXml: true })).toBe(true);
    expect(compareMetadataContents(profileA, profileB, { metadataType: 'Profile', normalizePermissionXml: false })).toBe(false);
  });

  it('detects real permission differences after normalization', () => {
    const permSetA = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Alpha__c</field>
    <editable>true</editable>
    <readable>true</readable>
  </fieldPermissions>
</PermissionSet>`;

    const permSetB = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Alpha__c</field>
    <editable>false</editable>
    <readable>true</readable>
  </fieldPermissions>
</PermissionSet>`;

    expect(compareMetadataContents(permSetA, permSetB, { metadataType: 'PermissionSet', normalizePermissionXml: true })).toBe(false);
  });

  it('falls back safely without throwing on malformed XML or non-XML content', () => {
    const malformed = '<Profile><unclosed>';
    expect(normalizePermissionXmlContent(malformed)).toBe(malformed);

    const apex = 'public class Foo {\r\n  void bar() {}\r\n}  ';
    expect(normalizeMetadataContent(apex, { metadataType: 'ApexClass', fileName: 'classes/Foo.cls' })).toBe(
      'public class Foo {\n  void bar() {}\n}',
    );
  });

  it('never treats missing/null content as equal', () => {
    expect(compareMetadataContents(undefined, undefined)).toBe(false);
    expect(compareMetadataContents('abc', undefined)).toBe(false);
  });
});

describe('permission XML with escaped characters', () => {
  const getPermissionSet = (userPermissions: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Sales &amp; Marketing</label>
  <description>Access for tiers &lt; 3</description>
${userPermissions.map((name) => `  <userPermissions>\n    <enabled>true</enabled>\n    <name>${name}</name>\n  </userPermissions>`).join('\n')}
</PermissionSet>`;
  const permissionSet = getPermissionSet(['ApiEnabled', 'ViewSetup']);
  const reorderedPermissionSet = getPermissionSet(['ViewSetup', 'ApiEnabled']);

  it('treats reordered files as the same', () => {
    expect(compareMetadataContents(permissionSet, reorderedPermissionSet, { metadataType: 'PermissionSet' })).toBe(true);
  });

  it('sorts the displayed content and unescapes it afterwards', () => {
    const getFile = (content: string) => ({ content, type: 'PermissionSet', fileName: 'permissionsets/Sales.permissionset' });
    const displayContent = getDisplayContent(getFile(permissionSet), true);

    expect(displayContent).toBe(getDisplayContent(getFile(reorderedPermissionSet), true));
    expect(displayContent).toContain('<label>Sales & Marketing</label>');
    expect(displayContent).toContain('<description>Access for tiers < 3</description>');
  });
});

describe('chunkListMetadataForRetrieve', () => {
  it('splits large metadata types into chunks below the retrieve limit', () => {
    const classes = Array.from({ length: DEFAULT_RETRIEVE_CHUNK_SIZE * 2 + 15 }, (_, i) => makeListItem('ApexClass', `Class_${i}`));
    const chunks = chunkListMetadataForRetrieve({ ApexClass: classes });

    expect(chunks).toHaveLength(3);
    expect(chunks[0].ApexClass).toHaveLength(DEFAULT_RETRIEVE_CHUNK_SIZE);
    expect(chunks[1].ApexClass).toHaveLength(DEFAULT_RETRIEVE_CHUNK_SIZE);
    expect(chunks[2].ApexClass).toHaveLength(15);
  });

  it('uses smaller chunks for multi-file bundle types like LWC', () => {
    const bundles = Array.from({ length: BUNDLE_RETRIEVE_CHUNK_SIZE + 25 }, (_, i) => makeListItem('LightningComponentBundle', `comp${i}`));
    const chunks = chunkListMetadataForRetrieve({ LightningComponentBundle: bundles });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].LightningComponentBundle).toHaveLength(BUNDLE_RETRIEVE_CHUNK_SIZE);
    expect(chunks[1].LightningComponentBundle).toHaveLength(25);
  });

  it('packs small types together into a single chunk when under limit', () => {
    const chunks = chunkListMetadataForRetrieve({
      ApexClass: [makeListItem('ApexClass', 'One')],
      ApexTrigger: [makeListItem('ApexTrigger', 'Two')],
    });
    expect(chunks).toHaveLength(1);
    expect(Object.keys(chunks[0])).toEqual(['ApexClass', 'ApexTrigger']);
  });
});

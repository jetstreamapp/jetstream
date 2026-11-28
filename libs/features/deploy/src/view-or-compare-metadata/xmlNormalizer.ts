import { unSanitizeXml } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { FilePropertiesWithContent } from './viewOrCompareMetadataTypes';
/**
 * Canonical XML normalization for Salesforce Profile and Permission Set metadata.
 *
 * Salesforce returns child blocks (fieldPermissions, objectPermissions, userPermissions, etc.)
 * in non-deterministic order across orgs, causing raw string diffs to show noisy false positives.
 * Normalizing sorts attributes and child elements deterministically by semantic Salesforce key
 * and applies consistent 4-space indentation before diffing.
 */

export const NORMALIZABLE_PERMISSION_XML_TYPES = new Set(['Profile', 'PermissionSet', 'MutingPermissionSet', 'PermissionSetGroup']);

const NORMALIZABLE_PERMISSION_FILE_SUFFIXES = [
  '.profile',
  '.profile-meta.xml',
  '.permissionset',
  '.permissionset-meta.xml',
  '.mutingpermissionset',
  '.mutingpermissionset-meta.xml',
  '.permissionsetgroup',
  '.permissionsetgroup-meta.xml',
];

/**
 * Semantic identity child tag(s) for Salesforce repeating permission blocks so elements sort
 * naturally by the object, field, class, tab, or permission name they reference.
 */
const PERMISSION_BLOCK_SORT_KEY_TAGS: Record<string, string[]> = {
  applicationVisibilities: ['application'],
  categoryGroupVisibilities: ['dataCategoryGroup'],
  classAccesses: ['apexClass'],
  customMetadataTypeAccesses: ['name'],
  customPermissions: ['name'],
  customSettingAccesses: ['name'],
  externalCredentialPrincipalAccesses: ['externalCredentialPrincipal'],
  externalDataSourceAccesses: ['externalDataSource'],
  fieldPermissions: ['field'],
  flowAccesses: ['flow'],
  layoutAssignments: ['layout', 'recordType'],
  loginIpRanges: ['startAddress', 'endAddress'],
  objectPermissions: ['object'],
  pageAccesses: ['apexPage'],
  recordTypeVisibilities: ['recordType'],
  tabSettings: ['tab'],
  tabVisibilities: ['tab'],
  userPermissions: ['name'],
};

const INDENT = '    ';

export function isPermissionXmlType(metadataType?: string | null, fileName?: string | null): boolean {
  if (metadataType && NORMALIZABLE_PERMISSION_XML_TYPES.has(metadataType)) {
    return true;
  }
  if (fileName) {
    const lowerFileName = fileName.toLowerCase();
    return NORMALIZABLE_PERMISSION_FILE_SUFFIXES.some((suffix) => lowerFileName.endsWith(suffix));
  }
  return false;
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getDirectChildElements(element: Element): Element[] {
  const children: Element[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const childNode = element.childNodes[i];
    if (childNode.nodeType === 1) {
      children.push(childNode as Element);
    }
  }
  return children;
}

function getDirectChildText(element: Element, tagName: string): string {
  const children = getDirectChildElements(element);
  const matchingChild = children.find((child) => child.tagName === tagName || child.localName === tagName);
  return matchingChild?.textContent?.trim() ?? '';
}

function formatAttributes(element: Element): string {
  if (!element.attributes || element.attributes.length === 0) {
    return '';
  }
  const attrs: { name: string; value: string }[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs.push({ name: attr.name, value: attr.value });
  }
  // Keep xmlns first, then sort remaining attributes alphabetically for deterministic output
  attrs.sort((first, second) => {
    if (first.name === 'xmlns') {
      return -1;
    }
    if (second.name === 'xmlns') {
      return 1;
    }
    return first.name.localeCompare(second.name);
  });
  return attrs.map(({ name, value }) => ` ${name}="${escapeXmlAttribute(value)}"`).join('');
}

function getElementSortKey(element: Element): string {
  const tagName = element.tagName;
  const keyTags = PERMISSION_BLOCK_SORT_KEY_TAGS[tagName];
  if (keyTags) {
    const semanticParts = keyTags.map((keyTag) => getDirectChildText(element, keyTag));
    return `${tagName}\u0000${semanticParts.join('\u0000')}\u0000${serializeCanonicalElement(element, 0)}`;
  }
  return `${tagName}\u0000${serializeCanonicalElement(element, 0)}`;
}

function serializeCanonicalElement(element: Element, depth: number): string {
  const indent = INDENT.repeat(depth);
  const tagName = element.tagName;
  const attributes = formatAttributes(element);
  const childElements = getDirectChildElements(element);

  if (childElements.length === 0) {
    const textContent = (element.textContent ?? '').trim();
    if (!textContent) {
      return `${indent}<${tagName}${attributes}/>`;
    }
    return `${indent}<${tagName}${attributes}>${escapeXmlText(textContent)}</${tagName}>`;
  }

  // Sort child elements deterministically: repeating permission blocks by semantic key,
  // and inner scalar fields by tag name so property ordering differences never cause noisy diffs.
  const sortedChildren = [...childElements].sort((first, second) => {
    return getElementSortKey(first).localeCompare(getElementSortKey(second));
  });

  const renderedChildren = sortedChildren.map((child) => serializeCanonicalElement(child, depth + 1)).join('\n');
  return `${indent}<${tagName}${attributes}>\n${renderedChildren}\n${indent}</${tagName}>`;
}

/**
 * Canonicalize Profile / PermissionSet XML so elements and attributes appear in a stable order.
 * Returns the original line-ending-normalized text if XML parsing fails or DOMParser is unavailable.
 */
export function normalizePermissionXmlContent(xmlContent: string): string {
  const normalizedLineEndings = xmlContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedLineEndings || typeof DOMParser === 'undefined') {
    return normalizedLineEndings;
  }

  try {
    const document = new DOMParser().parseFromString(normalizedLineEndings, 'application/xml');
    if (document.getElementsByTagName('parsererror').length > 0 || !document.documentElement) {
      return normalizedLineEndings;
    }
    const serializedRoot = serializeCanonicalElement(document.documentElement, 0);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serializedRoot}`;
  } catch {
    return normalizedLineEndings;
  }
}

export interface NormalizeMetadataOptions {
  metadataType?: string | null;
  fileName?: string | null;
  normalizePermissionXml?: boolean;
}

/**
 * Normalize metadata file content for comparison and clean diff display.
 * Always normalizes line endings and outer whitespace; canonically sorts XML for Profile and
 * PermissionSet types when `normalizePermissionXml` is enabled.
 */
export function normalizeMetadataContent(content: string | undefined | null, options: NormalizeMetadataOptions = {}): string {
  if (content == null) {
    return '';
  }
  const { metadataType, fileName, normalizePermissionXml = true } = options;
  if (normalizePermissionXml && isPermissionXmlType(metadataType, fileName)) {
    return normalizePermissionXmlContent(content);
  }
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * File content as shown in the editors. With `normalizePermissionXml` profiles and permission sets are sorted so
 * that both sides line up, otherwise the content is shown exactly as Salesforce returned it.
 */
export function getDisplayContent(
  file: Maybe<Pick<FilePropertiesWithContent, 'content' | 'type' | 'fileName'>>,
  normalizePermissionXml: boolean,
): string {
  const rawContent = unSanitizeXml(file?.content || '');
  return file && normalizePermissionXml
    ? normalizeMetadataContent(rawContent, { metadataType: file.type, fileName: file.fileName, normalizePermissionXml: true })
    : rawContent;
}

/**
 * Compare two metadata file strings with optional Profile / PermissionSet XML normalization.
 * Returns false if either side has unreadable/missing content (undefined/null).
 */
export function compareMetadataContents(
  sourceContent: string | undefined | null,
  targetContent: string | undefined | null,
  options: NormalizeMetadataOptions = {},
): boolean {
  if (sourceContent == null || targetContent == null) {
    return false;
  }
  if (sourceContent === targetContent) {
    return true;
  }
  return normalizeMetadataContent(sourceContent, options) === normalizeMetadataContent(targetContent, options);
}

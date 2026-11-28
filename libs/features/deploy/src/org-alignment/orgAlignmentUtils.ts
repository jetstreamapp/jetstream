import { getMetadataLabelFromFullName } from '@jetstream/connected-ui';
import { escapeHtml, formatNumber } from '@jetstream/shared/ui-utils';
import { getFullNameFromListMetadata, orderObjectsBy } from '@jetstream/shared/utils';
import { ListMetadataResult, OrgAlignmentRunSummaryCounts } from '@jetstream/types';
import { FilePropertiesWithContent } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { compareMetadataContents, isPermissionXmlType } from '../view-or-compare-metadata/xmlNormalizer';
import { isManagedListMetadataItem, MANAGED_COMPONENT_UNCOMPARABLE_REASON } from './orgAlignmentMetadataClassification';
import {
  OrgAlignmentComponentItem,
  OrgAlignmentDeployDirection,
  OrgAlignmentExportContext,
  OrgAlignmentFilePair,
  OrgAlignmentTypeResult,
} from './orgAlignmentTypes';

export function createEmptySummaryCounts(): OrgAlignmentRunSummaryCounts {
  return {
    onlyInSource: 0,
    onlyInTarget: 0,
    different: 0,
    same: 0,
    uncomparable: 0,
    managedSkipped: 0,
  };
}

export function getComponentKey(metadataType: string, fullName: string): string {
  return `${metadataType}:${fullName}`;
}

/**
 * Listings of some types are remembered for days. That is too long for a drift report, but remembering them for
 * a while keeps it fast to compare again after adding a metadata type that was forgotten.
 */
export const LIST_METADATA_CACHE_MAX_AGE_MS = 1000 * 60 * 60;

/**
 * The name a component is compared by. `getFullNameFromListMetadata` replaces the name of a folder
 * (e.g. `ReportFolder`) with its metadata type, which is what a package manifest needs but would turn every
 * folder of a type into the same component here.
 */
function getComparableFullName(metadataType: string, fullName: string, namespace: ListMetadataResult['namespacePrefix']): string {
  if (metadataType.endsWith('Folder')) {
    return fullName;
  }
  return getFullNameFromListMetadata({ fullName, metadataType, namespace });
}

export function getNormalizedListItemName(item: Pick<ListMetadataResult, 'fullName' | 'namespacePrefix' | 'type'>): string {
  return getComparableFullName(item.type, item.fullName, item.namespacePrefix);
}

export interface ListMetadataSetDiffResult {
  onlyInSource: ListMetadataResult[];
  onlyInTarget: ListMetadataResult[];
  /** Pairs present in both orgs that should be retrieved and diffed */
  candidates: Array<{ fullName: string; source: ListMetadataResult; target: ListMetadataResult }>;
  /** Managed items included as explicitly marked uncomparable entries (only when includeManaged === true) */
  managedUncomparable: Array<{ fullName: string; source?: ListMetadataResult; target?: ListMetadataResult }>;
  managedSkippedCount: number;
}

/**
 * Set-diff two orgs' `listMetadata` responses for a single metadata type before any retrieve calls.
 * - Unmanaged items only in Org A -> `onlyInSource` (no retrieve needed for drift summary)
 * - Unmanaged items only in Org B -> `onlyInTarget` (no retrieve needed for drift summary)
 * - Unmanaged items in both -> `candidates` (retrieved in chunks for content comparison)
 * - Managed items -> counted as `managedSkippedCount` when excluded, or marked `uncomparable` when included
 */
export function setDiffListMetadata(
  sourceItems: ListMetadataResult[],
  targetItems: ListMetadataResult[],
  options: { includeManaged?: boolean } = {},
): ListMetadataSetDiffResult {
  const { includeManaged = false } = options;

  const sourceByName = new Map<string, ListMetadataResult>();
  const targetByName = new Map<string, ListMetadataResult>();
  const managedByName = new Map<string, { source?: ListMetadataResult; target?: ListMetadataResult }>();
  const skippedManagedKeys = new Set<string>();

  for (const item of sourceItems) {
    const normalizedName = getNormalizedListItemName(item);
    if (isManagedListMetadataItem(item)) {
      if (includeManaged) {
        const entry = managedByName.get(normalizedName) ?? {};
        entry.source = item;
        managedByName.set(normalizedName, entry);
      } else {
        skippedManagedKeys.add(normalizedName);
      }
      continue;
    }
    if (!sourceByName.has(normalizedName)) {
      sourceByName.set(normalizedName, item);
    }
  }

  for (const item of targetItems) {
    const normalizedName = getNormalizedListItemName(item);
    if (isManagedListMetadataItem(item)) {
      if (includeManaged) {
        const entry = managedByName.get(normalizedName) ?? {};
        entry.target = item;
        managedByName.set(normalizedName, entry);
      } else {
        skippedManagedKeys.add(normalizedName);
      }
      continue;
    }
    if (!targetByName.has(normalizedName)) {
      targetByName.set(normalizedName, item);
    }
  }

  const onlyInSource: ListMetadataResult[] = [];
  const onlyInTarget: ListMetadataResult[] = [];
  const candidates: Array<{ fullName: string; source: ListMetadataResult; target: ListMetadataResult }> = [];

  for (const [fullName, sourceItem] of sourceByName.entries()) {
    const targetItem = targetByName.get(fullName);
    if (targetItem) {
      candidates.push({ fullName, source: sourceItem, target: targetItem });
    } else {
      onlyInSource.push(sourceItem);
    }
  }

  for (const [fullName, targetItem] of targetByName.entries()) {
    if (!sourceByName.has(fullName)) {
      onlyInTarget.push(targetItem);
    }
  }

  const managedUncomparable = Array.from(managedByName.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([fullName, pair]) => ({ fullName, source: pair.source, target: pair.target }));

  return {
    onlyInSource: orderObjectsBy(onlyInSource, 'fullName'),
    onlyInTarget: orderObjectsBy(onlyInTarget, 'fullName'),
    candidates: orderObjectsBy(candidates, 'fullName'),
    managedUncomparable,
    managedSkippedCount: skippedManagedKeys.size,
  };
}

/**
 * Resolve the logical component fullName for a retrieved FileProperties entry so multi-file
 * components (ApexClass `.cls` + `-meta.xml`, LWC/Aura bundles `lwc/comp/comp.js`) group
 * cleanly under their candidate component fullName.
 */
export function resolveLogicalComponentName(
  file: Pick<FilePropertiesWithContent, 'type' | 'fullName' | 'fileName' | 'namespacePrefix'>,
): string {
  // LWC and Aura bundles return per-file fullNames like `myComp/myComp.js` or bundle-level `myComp`
  if (file.type === 'LightningComponentBundle' || file.type === 'AuraDefinitionBundle') {
    const slashIndex = file.fullName.indexOf('/');
    if (slashIndex > 0) {
      return file.fullName.slice(0, slashIndex);
    }
    const pathParts = file.fileName.split('/');
    if (pathParts.length >= 2) {
      return pathParts[1];
    }
  }
  return getComparableFullName(file.type, file.fullName, file.namespacePrefix);
}

interface ContainerFileDefinition {
  /** XML element name to the metadata type stored in that element */
  childTypeByTag: Record<string, string>;
  /** true when the child fullName is `Parent.Child` (e.g. `Account.Field__c`), false when it is just `Child` */
  childNameIncludesParent: boolean;
}

/**
 * Parent metadata types whose file (e.g. `objects/Account.object`) also holds components that are listed and
 * compared on their own (e.g. each CustomField).
 */
const CONTAINER_FILES_BY_PARENT_TYPE: Record<string, ContainerFileDefinition> = {
  CustomObject: {
    childNameIncludesParent: true,
    childTypeByTag: {
      businessProcesses: 'BusinessProcess',
      compactLayouts: 'CompactLayout',
      fields: 'CustomField',
      fieldSets: 'FieldSet',
      indexes: 'Index',
      listViews: 'ListView',
      recordTypes: 'RecordType',
      sharingReasons: 'SharingReason',
      validationRules: 'ValidationRule',
      webLinks: 'WebLink',
    },
  },
  CustomLabels: { childNameIncludesParent: false, childTypeByTag: { labels: 'CustomLabel' } },
  Workflow: {
    childNameIncludesParent: true,
    childTypeByTag: {
      alerts: 'WorkflowAlert',
      fieldUpdates: 'WorkflowFieldUpdate',
      knowledgePublishes: 'WorkflowKnowledgePublish',
      outboundMessages: 'WorkflowOutboundMessage',
      rules: 'WorkflowRule',
      send: 'WorkflowSend',
      tasks: 'WorkflowTask',
    },
  },
};

/** Types whose `fullName` is `ObjectApiName.ComponentName` and that are stored in the file of their object */
export const CUSTOM_OBJECT_CHILD_METADATA_TYPES = new Set(Object.values(CONTAINER_FILES_BY_PARENT_TYPE.CustomObject.childTypeByTag));

/** The parent type whose file holds components of `childType`, e.g. CustomObject for CustomField */
export function getContainerParentType(childType: string): string | undefined {
  return Object.keys(CONTAINER_FILES_BY_PARENT_TYPE).find((parentType) =>
    Object.values(CONTAINER_FILES_BY_PARENT_TYPE[parentType].childTypeByTag).includes(childType),
  );
}

/** Parent types that must be compared after their child types, see `removeSeparatelyComparedChildren` */
export const CONTAINER_PARENT_METADATA_TYPES = new Set(Object.keys(CONTAINER_FILES_BY_PARENT_TYPE));

/** Child metadata type to the repeating XML tag that holds it inside its parent's file */
const PARENT_CONTAINER_CHILD_TAG: Record<string, string> = Object.fromEntries(
  Object.values(CONTAINER_FILES_BY_PARENT_TYPE).flatMap(({ childTypeByTag }) =>
    Object.entries(childTypeByTag).map(([tagName, childType]) => [childType, tagName]),
  ),
);

/**
 * Remove the child components that are compared on their own from a parent file, so that a changed field is
 * reported once against the field instead of also marking its object as different.
 *
 * Children that are not part of the comparison (e.g. standard fields, which Salesforce does not list) stay in
 * the parent so they are still compared. Returns the original content if it cannot be parsed or `parentType`
 * does not hold other components.
 */
export function removeSeparatelyComparedChildren(
  parentXml: string,
  parentType: string,
  parentName: string,
  separatelyComparedKeys: Pick<ReadonlySet<string>, 'has'>,
): string {
  const container = CONTAINER_FILES_BY_PARENT_TYPE[parentType];
  if (!container || !parentXml || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return parentXml;
  }
  try {
    const xmlDocument = new DOMParser().parseFromString(parentXml, 'application/xml');
    const root = xmlDocument.documentElement;
    if (!root || xmlDocument.getElementsByTagName('parsererror').length > 0) {
      return parentXml;
    }
    for (const element of Array.from(root.children)) {
      const childType = container.childTypeByTag[element.localName];
      const childName = Array.from(element.children)
        .find((childElement) => childElement.localName === 'fullName')
        ?.textContent?.trim();
      if (!childType || !childName) {
        continue;
      }
      const childFullName = container.childNameIncludesParent ? `${parentName}.${childName}` : childName;
      if (!separatelyComparedKeys.has(getComponentKey(childType, childFullName))) {
        continue;
      }
      // Take the line break and indentation in front of the element with it. That is the element's own line
      // wherever it sits, removing what follows instead would leave the closing tag of the parent indented
      // when the last child is removed.
      const previousSibling = element.previousSibling;
      if (previousSibling?.nodeType === 3 && !previousSibling.textContent?.trim()) {
        previousSibling.remove();
      }
      element.remove();
    }
    // Serialized even when nothing was removed: the other org's copy may have had children removed, and the
    // serializer does not write entities and empty elements the way Salesforce does, which would be a difference
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(root)}`;
  } catch {
    return parentXml;
  }
}

/**
 * Split a parent container file (such as `objects/Account.object`) into the XML of each child held in
 * `childTagName` elements, keyed by the child's `fullName`. Comparing `Account.MyField__c` then diffs only that
 * field rather than every sibling field on the same object. Returns null if the file cannot be parsed.
 */
export function getChildMetadataXmlBlocks(parentXml: string, childTagName: string): Map<string, string> | null {
  if (!parentXml || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return null;
  }
  try {
    const xmlDocument = new DOMParser().parseFromString(parentXml, 'application/xml');
    if (xmlDocument.getElementsByTagName('parsererror').length > 0) {
      return null;
    }
    const serializer = new XMLSerializer();
    const blocksByName = new Map<string, string>();
    // Direct children only: the same tag names are used deeper in the file, e.g. the `fields` of a compact layout
    for (const element of Array.from(xmlDocument.documentElement?.children ?? [])) {
      if (element.localName !== childTagName) {
        continue;
      }
      const childName = Array.from(element.children)
        .find((childElement) => childElement.localName === 'fullName')
        ?.textContent?.trim();
      if (childName && !blocksByName.has(childName)) {
        blocksByName.set(childName, serializer.serializeToString(element));
      }
    }
    return blocksByName;
  } catch {
    return null;
  }
}

export function extractChildMetadataXmlBlock(parentXml: string, childTagName: string, childFullName: string): string | null {
  return getChildMetadataXmlBlocks(parentXml, childTagName)?.get(childFullName) ?? null;
}

export function groupRetrievedFilesByComponent(
  files: FilePropertiesWithContent[],
  candidateNames: Set<string>,
  metadataType?: string,
): Map<string, FilePropertiesWithContent[]> {
  const grouped = new Map<string, FilePropertiesWithContent[]>();
  const childTagName = metadataType ? PARENT_CONTAINER_CHILD_TAG[metadataType] : undefined;

  // Pre-index dotted candidate names by their parent container prefix (e.g. `Account` -> [`Account.MyField__c`])
  const candidatesByParentPrefix = new Map<string, string[]>();
  if (childTagName) {
    for (const candidateName of candidateNames) {
      const dotIndex = candidateName.indexOf('.');
      const parentKey = dotIndex > 0 ? candidateName.slice(0, dotIndex) : 'CustomLabels';
      const list = candidatesByParentPrefix.get(parentKey);
      if (list) {
        list.push(candidateName);
      } else {
        candidatesByParentPrefix.set(parentKey, [candidateName]);
      }
    }
  }

  const addFile = (componentName: string, file: FilePropertiesWithContent) => {
    const existing = grouped.get(componentName);
    if (existing) {
      existing.push(file);
    } else {
      grouped.set(componentName, [file]);
    }
  };

  for (const file of files) {
    if (file.fileName === 'package.xml') {
      continue;
    }
    let componentName = resolveLogicalComponentName(file);
    if (!candidateNames.has(componentName)) {
      // Fallback to the raw fullName if namespace-prefixed resolution didn't match a known candidate.
      // Folders are listed with a trailing slash (`MyFolder/`) but retrieved without one.
      const matchingName = [file.fullName, `${componentName}/`, `${file.fullName}/`].find((name) => candidateNames.has(name));
      componentName = matchingName ?? componentName;
    }

    if (candidateNames.has(componentName)) {
      addFile(componentName, file);
      continue;
    }

    // Handle child metadata types returned inside parent container XML (e.g. CustomField inside CustomObject)
    if (childTagName) {
      const matchingCandidates = candidatesByParentPrefix.get(file.fullName) ?? candidatesByParentPrefix.get(componentName);
      if (matchingCandidates?.length) {
        // Parsed once per parent file, an object can hold hundreds of the fields being compared
        const childBlocksByName = file.content ? getChildMetadataXmlBlocks(file.content, childTagName) : null;
        for (const candidateName of matchingCandidates) {
          const dotIndex = candidateName.indexOf('.');
          const childLocalName = dotIndex > 0 ? candidateName.slice(dotIndex + 1) : candidateName;
          const extractedXml = childBlocksByName?.get(childLocalName);
          // A child that is not in the file is left without content and reported as not compared,
          // comparing the whole parent file instead would report differences that belong to its siblings
          if (extractedXml) {
            addFile(candidateName, {
              ...file,
              type: metadataType || file.type,
              fullName: candidateName,
              fileName: `${file.fileName}#${childLocalName}`,
              content: extractedXml,
            });
          }
        }
        continue;
      }
    }

    addFile(componentName, file);
  }
  return grouped;
}

/**
 * Pair retrieved files from Org A and Org B for a single candidate component and determine whether
 * all files match (using optional Profile/PermissionSet XML normalization).
 * Never treats missing/unreadable zip content on both sides as matching.
 */
export function buildFilePairsForComponent(
  sourceFiles: FilePropertiesWithContent[],
  targetFiles: FilePropertiesWithContent[],
  options: { normalizePermissionXml?: boolean } = {},
): { files: OrgAlignmentFilePair[]; allMatch: boolean; hasReadableContent: boolean } {
  const { normalizePermissionXml = true } = options;
  const sourceByFileName = new Map(sourceFiles.map((file) => [file.fileName, file]));
  const targetByFileName = new Map(targetFiles.map((file) => [file.fileName, file]));
  const allFileNames = Array.from(new Set([...sourceByFileName.keys(), ...targetByFileName.keys()])).sort((first, second) =>
    first.localeCompare(second),
  );

  let allMatch = allFileNames.length > 0;
  let hasReadableContent = false;

  const files: OrgAlignmentFilePair[] = allFileNames.map((fileName) => {
    const source = sourceByFileName.get(fileName);
    const target = targetByFileName.get(fileName);
    // Compared as retrieved: unescaping entities first would leave XML that cannot be parsed for normalization
    const sourceContent = source?.content ?? null;
    const targetContent = target?.content ?? null;

    if (sourceContent != null || targetContent != null) {
      hasReadableContent = true;
    }

    const matches =
      sourceContent != null &&
      targetContent != null &&
      compareMetadataContents(sourceContent, targetContent, {
        metadataType: source?.type ?? target?.type,
        fileName,
        normalizePermissionXml,
      });

    if (!matches) {
      allMatch = false;
    }

    return { fileName, source, target, matches };
  });

  return { files, allMatch, hasReadableContent };
}

export interface ComponentFileOptions {
  /**
   * `type:fullName` of every component compared on its own. When provided, those components are removed from
   * the file of their parent (see `removeSeparatelyComparedChildren`).
   */
  separatelyComparedKeys?: Pick<ReadonlySet<string>, 'has'>;
}

export interface BuildTypeComparisonOptions extends ComponentFileOptions {
  normalizePermissionXml?: boolean;
  /** Shown for components in both orgs that have no retrieved content, when the default reason does not apply */
  uncomparableReason?: string;
}

/**
 * Content of matching components is released once compared, a large org would otherwise hold every file of
 * every component in memory. It is retrieved again if the user opens the component.
 * Permission types keep theirs because toggling XML normalization re-compares them without another retrieve.
 */
function keepContentOfMatchingComponents(metadataType: string) {
  return isPermissionXmlType(metadataType);
}

/** Group retrieved files by the component they belong to, ready to be compared or shown */
export function getComponentFilesByName(
  files: FilePropertiesWithContent[],
  componentNames: Set<string>,
  metadataType: string,
  { separatelyComparedKeys }: ComponentFileOptions = {},
): Map<string, FilePropertiesWithContent[]> {
  const filesByComponent = groupRetrievedFilesByComponent(files, componentNames, metadataType);
  if (!separatelyComparedKeys || !CONTAINER_PARENT_METADATA_TYPES.has(metadataType)) {
    return filesByComponent;
  }
  for (const [componentName, componentFiles] of filesByComponent) {
    filesByComponent.set(
      componentName,
      componentFiles.map((file) =>
        file.content
          ? { ...file, content: removeSeparatelyComparedChildren(file.content, metadataType, componentName, separatelyComparedKeys) }
          : file,
      ),
    );
  }
  return filesByComponent;
}

/**
 * Assemble complete component comparison rows and summary counts for a single metadata type
 * from its set-diff result and retrieved candidate files.
 */
export function buildTypeComparisonComponents(
  metadataType: string,
  setDiff: ListMetadataSetDiffResult,
  sourceRetrievedFiles: FilePropertiesWithContent[],
  targetRetrievedFiles: FilePropertiesWithContent[],
  options: BuildTypeComparisonOptions = {},
): { components: OrgAlignmentComponentItem[]; counts: OrgAlignmentRunSummaryCounts } {
  const typeLabel = getMetadataLabelFromFullName(metadataType);
  const candidateNames = new Set(setDiff.candidates.map(({ fullName }) => fullName));
  const sourceFilesByComponent = getComponentFilesByName(sourceRetrievedFiles, candidateNames, metadataType, options);
  const targetFilesByComponent = getComponentFilesByName(targetRetrievedFiles, candidateNames, metadataType, options);
  const contentNotReturnedReason = options.uncomparableReason ?? 'Metadata content was not returned by Salesforce during retrieve.';

  const components: OrgAlignmentComponentItem[] = [];
  const counts = createEmptySummaryCounts();
  counts.managedSkipped = setDiff.managedSkippedCount;

  for (const sourceItem of setDiff.onlyInSource) {
    const fullName = getNormalizedListItemName(sourceItem);
    counts.onlyInSource += 1;
    components.push({
      key: getComponentKey(metadataType, fullName),
      type: metadataType,
      typeLabel,
      fullName,
      status: 'onlyInSource',
      isManaged: false,
      sourceItem,
      files: [],
      filesLoaded: false,
    });
  }

  for (const targetItem of setDiff.onlyInTarget) {
    const fullName = getNormalizedListItemName(targetItem);
    counts.onlyInTarget += 1;
    components.push({
      key: getComponentKey(metadataType, fullName),
      type: metadataType,
      typeLabel,
      fullName,
      status: 'onlyInTarget',
      isManaged: false,
      targetItem,
      files: [],
      filesLoaded: false,
    });
  }

  for (const { fullName, source, target } of setDiff.candidates) {
    const sourceFiles = sourceFilesByComponent.get(fullName) ?? [];
    const targetFiles = targetFilesByComponent.get(fullName) ?? [];
    const { files, allMatch, hasReadableContent } = buildFilePairsForComponent(sourceFiles, targetFiles, options);

    if (files.length === 0 || !hasReadableContent) {
      counts.uncomparable += 1;
      components.push({
        key: getComponentKey(metadataType, fullName),
        type: metadataType,
        typeLabel,
        fullName,
        status: 'uncomparable',
        uncomparableReason: contentNotReturnedReason,
        isManaged: false,
        sourceItem: source,
        targetItem: target,
        files,
        filesLoaded: true,
      });
    } else if (allMatch) {
      counts.same += 1;
      components.push({
        key: getComponentKey(metadataType, fullName),
        type: metadataType,
        typeLabel,
        fullName,
        status: 'same',
        isManaged: false,
        sourceItem: source,
        targetItem: target,
        ...(keepContentOfMatchingComponents(metadataType) ? { files, filesLoaded: true } : { files: [], filesLoaded: false }),
      });
    } else {
      counts.different += 1;
      components.push({
        key: getComponentKey(metadataType, fullName),
        type: metadataType,
        typeLabel,
        fullName,
        status: 'different',
        isManaged: false,
        sourceItem: source,
        targetItem: target,
        files,
        filesLoaded: true,
      });
    }
  }

  for (const { fullName, source, target } of setDiff.managedUncomparable) {
    counts.uncomparable += 1;
    components.push({
      key: getComponentKey(metadataType, fullName),
      type: metadataType,
      typeLabel,
      fullName,
      status: 'uncomparable',
      uncomparableReason: MANAGED_COMPONENT_UNCOMPARABLE_REASON,
      isManaged: true,
      sourceItem: source,
      targetItem: target,
      files: [],
      filesLoaded: false,
    });
  }

  return {
    components: orderObjectsBy(components, 'fullName'),
    counts,
  };
}

/** Aggregate counts across all metadata types in a drift report */
export function aggregateSummaryCounts(typeResults: OrgAlignmentTypeResult[]): OrgAlignmentRunSummaryCounts {
  return typeResults.reduce<OrgAlignmentRunSummaryCounts>((totals, typeResult) => {
    totals.onlyInSource += typeResult.counts.onlyInSource;
    totals.onlyInTarget += typeResult.counts.onlyInTarget;
    totals.different += typeResult.counts.different;
    totals.same += typeResult.counts.same;
    totals.uncomparable += typeResult.counts.uncomparable;
    totals.managedSkipped += typeResult.counts.managedSkipped;
    return totals;
  }, createEmptySummaryCounts());
}

/**
 * Determine whether a component can be deployed in the chosen direction:
 * - `A_TO_B` deploys components present in Org A (`different` or `onlyInSource`) into Org B.
 * - `B_TO_A` deploys components present in Org B (`different` or `onlyInTarget`) into Org A.
 */
export function isComponentDeployableInDirection(
  component: Pick<OrgAlignmentComponentItem, 'status' | 'isManaged' | 'sourceItem' | 'targetItem'>,
  direction: OrgAlignmentDeployDirection,
): boolean {
  if (component.isManaged || component.status === 'uncomparable') {
    return false;
  }
  const onlyInFromOrgStatus = getDeployFromAndTo('onlyInSource', 'onlyInTarget', direction).from;
  return Boolean(getDeployFromItem(component, direction)) && (component.status === 'different' || component.status === onlyInFromOrgStatus);
}

type ComponentListItems = Pick<OrgAlignmentComponentItem, 'sourceItem' | 'targetItem'>;

/** Which of the two orgs (or anything else kept per org) is deployed from and which is deployed to */
export function getDeployFromAndTo<T>(source: T, target: T, direction: OrgAlignmentDeployDirection): { from: T; to: T } {
  return direction === 'A_TO_B' ? { from: source, to: target } : { from: target, to: source };
}

/** The component as it is listed in the org being deployed from */
export function getDeployFromItem(component: ComponentListItems, direction: OrgAlignmentDeployDirection) {
  return getDeployFromAndTo(component.sourceItem, component.targetItem, direction).from;
}

/** The component as it is listed in the org being deployed to, undefined when it does not exist there yet */
export function getDeployToItem(component: ComponentListItems, direction: OrgAlignmentDeployDirection) {
  return getDeployFromAndTo(component.sourceItem, component.targetItem, direction).to;
}

function groupListItemsByType(
  components: OrgAlignmentComponentItem[],
  getListItem: (component: OrgAlignmentComponentItem) => ListMetadataResult | undefined,
): Record<string, ListMetadataResult[]> {
  const itemsByType: Record<string, ListMetadataResult[]> = {};
  for (const component of components) {
    const item = getListItem(component);
    if (item) {
      itemsByType[component.type] = itemsByType[component.type] ?? [];
      itemsByType[component.type].push(item);
    }
  }
  return itemsByType;
}

/** The selected components as they exist in the org being deployed from, in the shape used by the retrieve and deploy APIs */
export function componentsToListMetadataMap(components: OrgAlignmentComponentItem[], direction: OrgAlignmentDeployDirection) {
  return groupListItemsByType(components, (component) => getDeployFromItem(component, direction));
}

/** The selected components that already exist in the org being deployed to and would be overwritten, used for the backup */
export function getOverwrittenTargetComponentsMap(components: OrgAlignmentComponentItem[], direction: OrgAlignmentDeployDirection) {
  return groupListItemsByType(components, (component) => getDeployToItem(component, direction));
}

export function getStatusLabel(status: OrgAlignmentComponentItem['status'], sourceOrgLabel: string, targetOrgLabel: string): string {
  switch (status) {
    case 'different':
      return 'Different';
    case 'onlyInSource':
      return `Only in ${sourceOrgLabel}`;
    case 'onlyInTarget':
      return `Only in ${targetOrgLabel}`;
    case 'same':
      return 'Same';
    case 'uncomparable':
      return 'Not Compared';
    default:
      return status;
  }
}

/** Build flat export rows suitable for CSV or JSON downloads */
export function buildDriftReportFlatRows(context: OrgAlignmentExportContext, onlyDifferences = false): Record<string, unknown>[] {
  const { sourceOrg, targetOrg, typeResults } = context;
  const rows: Record<string, unknown>[] = [];

  for (const typeResult of typeResults) {
    for (const component of typeResult.components) {
      if (onlyDifferences && component.status === 'same') {
        continue;
      }
      rows.push({
        'Metadata Type': component.type,
        'Type Label': component.typeLabel,
        Component: component.fullName,
        Status: getStatusLabel(component.status, sourceOrg.label, targetOrg.label),
        'Status Code': component.status,
        'Managed Component': component.isManaged ? 'Yes' : 'No',
        'Reason Not Compared': component.uncomparableReason ?? '',
        [`${sourceOrg.label} Last Modified By`]: component.sourceItem?.lastModifiedByName ?? '',
        [`${sourceOrg.label} Last Modified Date`]: component.sourceItem?.lastModifiedDate
          ? new Date(component.sourceItem.lastModifiedDate).toISOString()
          : '',
        [`${targetOrg.label} Last Modified By`]: component.targetItem?.lastModifiedByName ?? '',
        [`${targetOrg.label} Last Modified Date`]: component.targetItem?.lastModifiedDate
          ? new Date(component.targetItem.lastModifiedDate).toISOString()
          : '',
      });
    }
  }

  return rows;
}

/** Build multi-sheet Excel workbook data tailored for change-review meetings */
export function buildDriftReportWorkbookData(context: OrgAlignmentExportContext): Record<string, unknown[]> {
  const { sourceOrg, targetOrg, generatedAt, normalizePermissionXml, includeManaged, typeResults } = context;
  const totals = aggregateSummaryCounts(typeResults);
  const uncomparableTypes = typeResults.filter(({ executionStatus }) => executionStatus === 'uncomparable');
  const failedTypes = typeResults.filter(({ executionStatus }) => executionStatus === 'error');

  return {
    Summary: [
      ['Report', 'Org Alignment Drift Report'],
      ['Generated At', generatedAt.toISOString()],
      ['Org A (Source)', `${sourceOrg.label} (${sourceOrg.username})`],
      ['Org B (Target)', `${targetOrg.label} (${targetOrg.username})`],
      ['Normalize Permission XML', normalizePermissionXml ? 'Yes' : 'No'],
      ['Include Managed Components', includeManaged ? 'Yes' : 'No'],
      ['Metadata Types Evaluated', typeResults.length],
      ['Different Components', totals.different],
      [`Only in ${sourceOrg.label}`, totals.onlyInSource],
      [`Only in ${targetOrg.label}`, totals.onlyInTarget],
      ['Matching Components', totals.same],
      ['Uncomparable Components', totals.uncomparable],
      ['Managed Components Skipped', totals.managedSkipped],
      ['Uncomparable Types Skipped', uncomparableTypes.length],
      ['Failed Types', failedTypes.length],
    ],
    'By Metadata Type': typeResults.map((typeResult) => ({
      'Metadata Type': typeResult.type,
      Label: typeResult.typeLabel,
      Status: typeResult.executionStatus,
      Different: typeResult.counts.different,
      [`Only in ${sourceOrg.label}`]: typeResult.counts.onlyInSource,
      [`Only in ${targetOrg.label}`]: typeResult.counts.onlyInTarget,
      Same: typeResult.counts.same,
      Uncomparable: typeResult.counts.uncomparable,
      'Managed Skipped': typeResult.counts.managedSkipped,
      Notes: typeResult.uncomparableReason ?? typeResult.errorMessage ?? '',
    })),
    Differences: buildDriftReportFlatRows(context, true),
    'All Components': buildDriftReportFlatRows(context, false),
  };
}

interface ChangeReviewSummary {
  details: [label: string, value: string][];
  totals: [label: string, count: number][];
  typeHeaders: string[];
  typeRows: string[][];
  differencesByType: { heading: string; components: { fullName: string; statusLabel: string }[] }[];
}

const CHANGE_REVIEW_TITLE = 'Org Alignment Drift Report';

/** The content of the clipboard summary, rendered as Markdown or as rich text */
function getChangeReviewSummary(context: OrgAlignmentExportContext): ChangeReviewSummary {
  const { sourceOrg, targetOrg, generatedAt, normalizePermissionXml, typeResults } = context;
  const totals = aggregateSummaryCounts(typeResults);
  return {
    details: [
      ['Source Org', `${sourceOrg.label} (${sourceOrg.username})`],
      ['Target Org', `${targetOrg.label} (${targetOrg.username})`],
      ['Generated', generatedAt.toLocaleString()],
      ['Ignore Permission Ordering', normalizePermissionXml ? 'Yes' : 'No'],
    ],
    totals: [
      ['Different', totals.different],
      [`Only in ${sourceOrg.label}`, totals.onlyInSource],
      [`Only in ${targetOrg.label}`, totals.onlyInTarget],
      ['Same', totals.same],
      ['Not Compared', totals.uncomparable],
      ['Managed Skipped', totals.managedSkipped],
    ],
    typeHeaders: ['Metadata Type', 'Status', 'Different', `Only in ${sourceOrg.label}`, `Only in ${targetOrg.label}`, 'Same', 'Notes'],
    typeRows: typeResults.map(({ type, typeLabel, executionStatus, counts, uncomparableReason, errorMessage }) => [
      `${typeLabel} (${type})`,
      executionStatus,
      formatNumber(counts.different),
      formatNumber(counts.onlyInSource),
      formatNumber(counts.onlyInTarget),
      formatNumber(counts.same),
      uncomparableReason ?? errorMessage ?? '',
    ]),
    differencesByType: typeResults
      .map(({ type, typeLabel, components }) => ({
        heading: `${typeLabel} (${type})`,
        components: components
          .filter(({ status }) => status === 'different' || status === 'onlyInSource' || status === 'onlyInTarget')
          .map(({ fullName, status }) => ({ fullName, statusLabel: getStatusLabel(status, sourceOrg.label, targetOrg.label) })),
      }))
      .filter(({ components }) => components.length > 0),
  };
}

/** Build a Markdown summary to paste into change-review docs, tickets or pull requests */
export function buildChangeReviewMarkdown(context: OrgAlignmentExportContext): string {
  const { details, totals, typeHeaders, typeRows, differencesByType } = getChangeReviewSummary(context);
  // Backslashes first, otherwise a value ending in one would un-escape the pipe that follows it
  const escapeCell = (value: string) => value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  const lines: string[] = [
    `# ${CHANGE_REVIEW_TITLE}`,
    '',
    ...details.map(([label, value]) => `- **${label}:** ${value}`),
    '',
    '## Overall Summary',
    '',
    '| Category | Count |',
    '| --- | ---: |',
    ...totals.map(([label, count]) => `| ${escapeCell(label)} | ${formatNumber(count)} |`),
    '',
    '## Summary by Metadata Type',
    '',
    `| ${typeHeaders.map(escapeCell).join(' | ')} |`,
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...typeRows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ];

  if (differencesByType.length > 0) {
    lines.push('', '## Differences', '');
    for (const { heading, components } of differencesByType) {
      lines.push(`### ${heading}`, '', ...components.map(({ fullName, statusLabel }) => `- **${fullName}**: ${statusLabel}`), '');
    }
  }

  return lines.join('\n');
}

/** Build the same summary as rich text (HTML), which keeps its tables when pasted into documents and email */
export function buildChangeReviewHtml(context: OrgAlignmentExportContext): string {
  const { details, totals, typeHeaders, typeRows, differencesByType } = getChangeReviewSummary(context);
  const getRow = (cells: string[], tag: 'td' | 'th' = 'td') =>
    `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
  const getTable = (headers: string[], rows: string[][]) =>
    `<table border="1" cellpadding="4" cellspacing="0">${getRow(headers, 'th')}${rows.map((row) => getRow(row)).join('')}</table>`;

  return [
    `<h1>${escapeHtml(CHANGE_REVIEW_TITLE)}</h1>`,
    `<ul>${details.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul>`,
    '<h2>Overall Summary</h2>',
    getTable(
      ['Category', 'Count'],
      totals.map(([label, count]) => [label, formatNumber(count)]),
    ),
    '<h2>Summary by Metadata Type</h2>',
    getTable(typeHeaders, typeRows),
    ...(differencesByType.length > 0 ? ['<h2>Differences</h2>'] : []),
    ...differencesByType.map(
      ({ heading, components }) =>
        `<h3>${escapeHtml(heading)}</h3><ul>${components
          .map(({ fullName, statusLabel }) => `<li><strong>${escapeHtml(fullName)}</strong>: ${escapeHtml(statusLabel)}</li>`)
          .join('')}</ul>`,
    ),
  ].join('');
}

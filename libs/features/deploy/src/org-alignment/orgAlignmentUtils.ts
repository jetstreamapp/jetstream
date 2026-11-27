import { getMetadataLabelFromFullName } from '@jetstream/connected-ui';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getFullNameFromListMetadata, orderObjectsBy, unSanitizeXml } from '@jetstream/shared/utils';
import { ListMetadataResult, OrgAlignmentRunSummaryCounts } from '@jetstream/types';
import { FilePropertiesWithContent } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { compareMetadataContents } from '../view-or-compare-metadata/xmlNormalizer';
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

export function getNormalizedListItemName(item: Pick<ListMetadataResult, 'fullName' | 'namespacePrefix' | 'type'>): string {
  return getFullNameFromListMetadata({
    fullName: item.fullName,
    metadataType: item.type,
    namespace: item.namespacePrefix,
  });
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
  return getFullNameFromListMetadata({
    fullName: file.fullName,
    metadataType: file.type,
    namespace: file.namespacePrefix,
  });
}

/**
 * Child metadata types that Salesforce returns nested inside a parent container XML file
 * (e.g. `objects/Account.object` or `workflows/Account.workflow`) rather than standalone files.
 * Maps the Metadata API child type to the repeating XML tag name inside the parent file.
 */
const PARENT_CONTAINER_CHILD_TAG: Record<string, string> = {
  BusinessProcess: 'businessProcesses',
  CompactLayout: 'compactLayouts',
  CustomField: 'fields',
  CustomLabel: 'labels',
  FieldSet: 'fieldSets',
  Index: 'indexes',
  ListView: 'listViews',
  RecordType: 'recordTypes',
  SharingReason: 'sharingReasons',
  ValidationRule: 'validationRules',
  WebLink: 'webLinks',
  WorkflowAlert: 'alerts',
  WorkflowFieldUpdate: 'fieldUpdates',
  WorkflowKnowledgePublish: 'knowledgePublishes',
  WorkflowOutboundMessage: 'outboundMessages',
  WorkflowRule: 'rules',
  WorkflowSend: 'send',
  WorkflowTask: 'tasks',
};

/**
 * Extract the single XML block matching `<fullName>{childName}</fullName>` from a parent container
 * file (such as `objects/Account.object`) so comparing `Account.MyField__c` diffs only that field
 * rather than every sibling field on the same object.
 */
export function extractChildMetadataXmlBlock(parentXml: string, childTagName: string, childFullName: string): string | null {
  if (!parentXml || typeof DOMParser === 'undefined') {
    return null;
  }
  try {
    const document = new DOMParser().parseFromString(parentXml, 'application/xml');
    if (document.getElementsByTagName('parsererror').length > 0) {
      return null;
    }
    const candidates = document.getElementsByTagName(childTagName);
    for (let i = 0; i < candidates.length; i++) {
      const element = candidates[i];
      const fullNameEl = element.getElementsByTagName('fullName')[0];
      if (fullNameEl?.textContent?.trim() === childFullName) {
        if (typeof XMLSerializer !== 'undefined') {
          return new XMLSerializer().serializeToString(element);
        }
        return element.outerHTML || null;
      }
    }
  } catch {
    return null;
  }
  return null;
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
    // Fallback to raw fullName if namespace-prefixed resolution didn't match a known candidate
    if (!candidateNames.has(componentName) && candidateNames.has(file.fullName)) {
      componentName = file.fullName;
    }

    if (candidateNames.has(componentName)) {
      addFile(componentName, file);
      continue;
    }

    // Handle child metadata types returned inside parent container XML (e.g. CustomField inside CustomObject)
    if (childTagName) {
      const matchingCandidates = candidatesByParentPrefix.get(file.fullName) ?? candidatesByParentPrefix.get(componentName);
      if (matchingCandidates?.length) {
        for (const candidateName of matchingCandidates) {
          const dotIndex = candidateName.indexOf('.');
          const childLocalName = dotIndex > 0 ? candidateName.slice(dotIndex + 1) : candidateName;
          const extractedXml = file.content ? extractChildMetadataXmlBlock(file.content, childTagName, childLocalName) : null;
          if (extractedXml) {
            addFile(candidateName, {
              ...file,
              type: metadataType || file.type,
              fullName: candidateName,
              fileName: `${file.fileName}#${childLocalName}`,
              content: extractedXml,
            });
          } else {
            addFile(candidateName, file);
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
    const sourceContent = source?.content != null ? unSanitizeXml(source.content) : null;
    const targetContent = target?.content != null ? unSanitizeXml(target.content) : null;

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

/**
 * Assemble complete component comparison rows and summary counts for a single metadata type
 * from its set-diff result and retrieved candidate files.
 */
export function buildTypeComparisonComponents(
  metadataType: string,
  setDiff: ListMetadataSetDiffResult,
  sourceRetrievedFiles: FilePropertiesWithContent[],
  targetRetrievedFiles: FilePropertiesWithContent[],
  options: { normalizePermissionXml?: boolean } = {},
): { components: OrgAlignmentComponentItem[]; counts: OrgAlignmentRunSummaryCounts } {
  const typeLabel = getMetadataLabelFromFullName(metadataType);
  const candidateNames = new Set(setDiff.candidates.map(({ fullName }) => fullName));
  const sourceFilesByComponent = groupRetrievedFilesByComponent(sourceRetrievedFiles, candidateNames, metadataType);
  const targetFilesByComponent = groupRetrievedFilesByComponent(targetRetrievedFiles, candidateNames, metadataType);

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
        uncomparableReason: 'Metadata content was not returned by Salesforce during retrieve.',
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
        files,
        filesLoaded: true,
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
  if (direction === 'A_TO_B') {
    return Boolean(component.sourceItem) && (component.status === 'different' || component.status === 'onlyInSource');
  }
  return Boolean(component.targetItem) && (component.status === 'different' || component.status === 'onlyInTarget');
}

/** Convert selected alignment components into the `Record<type, ListMetadataResult[]>` shape used by deploy APIs */
export function componentsToListMetadataMap(
  components: OrgAlignmentComponentItem[],
  direction: OrgAlignmentDeployDirection,
): Record<string, ListMetadataResult[]> {
  return components.reduce<Record<string, ListMetadataResult[]>>((output, component) => {
    const item = direction === 'A_TO_B' ? component.sourceItem : component.targetItem;
    if (!item) {
      return output;
    }
    output[component.type] = output[component.type] ?? [];
    output[component.type].push(item);
    return output;
  }, {});
}

/**
 * Return the subset of selected components that already exist on the destination org
 * (and would therefore be overwritten during deployment), formatted as a listMetadata map
 * suitable for retrieving a target backup package.
 */
export function getOverwrittenTargetComponentsMap(
  components: OrgAlignmentComponentItem[],
  direction: OrgAlignmentDeployDirection,
): Record<string, ListMetadataResult[]> {
  return components.reduce<Record<string, ListMetadataResult[]>>((output, component) => {
    const existingTargetItem = direction === 'A_TO_B' ? component.targetItem : component.sourceItem;
    if (!existingTargetItem) {
      return output;
    }
    output[component.type] = output[component.type] ?? [];
    output[component.type].push(existingTargetItem);
    return output;
  }, {});
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
      return 'Uncomparable';
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
        Notes: component.uncomparableReason ?? '',
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

/** Build a clean Markdown summary ready to paste into change-review docs, Jira, Confluence, or Slack */
export function buildChangeReviewMarkdown(context: OrgAlignmentExportContext): string {
  const { sourceOrg, targetOrg, generatedAt, normalizePermissionXml, typeResults } = context;
  const totals = aggregateSummaryCounts(typeResults);
  const lines: string[] = [
    `# Org Alignment Drift Report`,
    '',
    `- **Org A:** ${sourceOrg.label} (${sourceOrg.username})`,
    `- **Org B:** ${targetOrg.label} (${targetOrg.username})`,
    `- **Generated:** ${generatedAt.toLocaleString()}`,
    `- **Permission XML Normalization:** ${normalizePermissionXml ? 'Enabled' : 'Disabled'}`,
    '',
    '## Overall Summary',
    '',
    `| Category | Count |`,
    `| --- | ---: |`,
    `| Different | ${formatNumber(totals.different)} |`,
    `| Only in ${sourceOrg.label} | ${formatNumber(totals.onlyInSource)} |`,
    `| Only in ${targetOrg.label} | ${formatNumber(totals.onlyInTarget)} |`,
    `| Same | ${formatNumber(totals.same)} |`,
    `| Uncomparable | ${formatNumber(totals.uncomparable)} |`,
    `| Managed Skipped | ${formatNumber(totals.managedSkipped)} |`,
    '',
    '## Summary by Metadata Type',
    '',
    `| Metadata Type | Status | Different | Only in ${sourceOrg.label} | Only in ${targetOrg.label} | Same | Notes |`,
    `| --- | --- | ---: | ---: | ---: | ---: | --- |`,
  ];

  for (const typeResult of typeResults) {
    const notes = (typeResult.uncomparableReason ?? typeResult.errorMessage ?? '').replace(/\|/g, '\\|');
    lines.push(
      `| ${typeResult.typeLabel} (\`${typeResult.type}\`) | ${typeResult.executionStatus} | ${typeResult.counts.different} | ${typeResult.counts.onlyInSource} | ${typeResult.counts.onlyInTarget} | ${typeResult.counts.same} | ${notes} |`,
    );
  }

  const driftingTypes = typeResults.filter(
    (typeResult) => typeResult.counts.different > 0 || typeResult.counts.onlyInSource > 0 || typeResult.counts.onlyInTarget > 0,
  );

  if (driftingTypes.length > 0) {
    lines.push('', '## Drift Details for Change Review', '');
    for (const typeResult of driftingTypes) {
      lines.push(`### ${typeResult.typeLabel} (\`${typeResult.type}\`)`, '');
      const driftingComponents = typeResult.components.filter(
        ({ status }) => status === 'different' || status === 'onlyInSource' || status === 'onlyInTarget',
      );
      for (const component of driftingComponents) {
        const badge =
          component.status === 'different'
            ? 'Different'
            : component.status === 'onlyInSource'
              ? `Only in ${sourceOrg.label}`
              : `Only in ${targetOrg.label}`;
        lines.push(`- **${component.fullName}** — ${badge}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

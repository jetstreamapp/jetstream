import { logger } from '@jetstream/shared/client-logger';
import { queryAllWithCacheUsingOffset } from '@jetstream/shared/data';
import { getErrorMessage, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrgAlignmentComponentItem, OrgAlignmentDependencyFinding } from './orgAlignmentTypes';
import { getComponentKey, getNormalizedListItemName } from './orgAlignmentUtils';

const DEPENDENCY_QUERY_ID_BATCH_SIZE = 40;
const DEPENDENCY_QUERY_MAX_OFFSET = 2000;

/**
 * Metadata types whose `fullName` uses `ObjectApiName.ComponentName` and therefore structurally
 * depend on their parent CustomObject existing in the destination org.
 */
const CUSTOM_OBJECT_CHILD_TYPES = new Set([
  'BusinessProcess',
  'CompactLayout',
  'CustomField',
  'FieldSet',
  'Index',
  'ListView',
  'RecordType',
  'SharingReason',
  'ValidationRule',
  'WebLink',
]);

/**
 * Folder-based metadata types whose `fullName` uses `FolderName/ComponentName`.
 * Classic EmailTemplates live in `EmailFolder`, while other types use `${type}Folder`.
 */
const FOLDER_CHILD_TO_PARENT_TYPES: Record<string, string[]> = {
  Dashboard: ['DashboardFolder'],
  Document: ['DocumentFolder'],
  EmailTemplate: ['EmailTemplateFolder', 'EmailFolder'],
  Report: ['ReportFolder'],
};

/**
 * Tooling API `RefMetadataComponentType` values that represent built-in Salesforce entities
 * rather than deployable metadata components.
 */
const IGNORED_TOOLING_REF_TYPES = new Set(['StandardEntity', 'StandardField', 'User', 'Organization']);

/**
 * Normalize Tooling API `MetadataComponentType` names to Metadata API xmlNames where they differ.
 */
const TOOLING_TYPE_TO_METADATA_TYPE: Record<string, string> = {
  AuraDefinition: 'AuraDefinitionBundle',
  CustomObject: 'CustomObject',
  FlexiPage: 'FlexiPage',
  Flow: 'Flow',
  Layout: 'Layout',
  LightningComponentResource: 'LightningComponentBundle',
  ValidationRule: 'ValidationRule',
};

export interface ToolingDependencyRecord {
  MetadataComponentId: string;
  MetadataComponentName: string;
  MetadataComponentType: string;
  RefMetadataComponentId: string;
  RefMetadataComponentName: string;
  RefMetadataComponentType: string;
  RefMetadataComponentNamespace?: string | null;
}

function isCustomObjectApiName(objectName: string): boolean {
  return objectName.endsWith('__c') || objectName.endsWith('__mdt') || objectName.endsWith('__e') || objectName.endsWith('__b');
}

function buildTargetNameLookup(targetInventoryByType: Record<string, ListMetadataResult[]>): Map<string, Set<string>> {
  const lookup = new Map<string, Set<string>>();
  for (const [metadataType, items] of Object.entries(targetInventoryByType)) {
    const names = new Set<string>();
    for (const item of items) {
      names.add(item.fullName);
      names.add(getNormalizedListItemName(item));
      // Folder fullNames are normalized with a trailing slash in Jetstream
      if (item.fullName.endsWith('/')) {
        names.add(item.fullName.slice(0, -1));
      }
    }
    lookup.set(metadataType, names);
  }
  return lookup;
}

/**
 * Structural pre-deploy dependency checks derived purely from component names and the destination
 * org's `listMetadata` inventory (works even when the Tooling dependency API has gaps).
 */
export function findStructuralDependencies(
  selectedComponents: OrgAlignmentComponentItem[],
  allSourceComponentsByKey: Map<string, OrgAlignmentComponentItem>,
  targetInventoryByType: Record<string, ListMetadataResult[]>,
): OrgAlignmentDependencyFinding[] {
  const selectedKeys = new Set(selectedComponents.map(({ key }) => key));
  const targetLookup = buildTargetNameLookup(targetInventoryByType);
  const findings: OrgAlignmentDependencyFinding[] = [];
  const seenFindingKeys = new Set<string>();

  for (const component of selectedComponents) {
    // 1. CustomField / ValidationRule / RecordType / etc. -> parent CustomObject
    if (CUSTOM_OBJECT_CHILD_TYPES.has(component.type) && component.fullName.includes('.')) {
      const [objectName] = component.fullName.split('.');
      if (objectName && isCustomObjectApiName(objectName)) {
        const parentKey = getComponentKey('CustomObject', objectName);
        const inSelection = selectedKeys.has(parentKey);
        const targetCustomObjects = targetLookup.get('CustomObject');
        const inTarget = targetCustomObjects?.has(objectName) ?? false;

        if (!inSelection && !inTarget) {
          const findingKey = `structural:${component.key}->${parentKey}`;
          if (!seenFindingKeys.has(findingKey)) {
            seenFindingKeys.add(findingKey);
            const sourceParent = allSourceComponentsByKey.get(parentKey);
            const customObjectsWereScanned = targetLookup.has('CustomObject');
            findings.push({
              key: findingKey,
              sourceComponentKey: component.key,
              sourceComponentType: component.type,
              sourceComponentName: component.fullName,
              referencedType: 'CustomObject',
              referencedName: objectName,
              severity: customObjectsWereScanned ? 'missing' : 'external',
              source: 'structural',
              message: customObjectsWereScanned
                ? `Parent custom object "${objectName}" is not in the target org or deployment selection.`
                : `Verify parent custom object "${objectName}" exists in the target org (CustomObject was not included in this comparison).`,
              addableComponentKey: sourceParent ? parentKey : undefined,
            });
          }
        }
      }
    }

    // 2. Folder-based items (Report, Dashboard, EmailTemplate, Document) -> parent Folder
    const parentFolderTypes = FOLDER_CHILD_TO_PARENT_TYPES[component.type];
    if (parentFolderTypes && component.fullName.includes('/')) {
      const folderPath = component.fullName.slice(0, component.fullName.lastIndexOf('/'));
      if (folderPath && folderPath !== 'unfiled$public') {
        const folderInSelection = parentFolderTypes.some(
          (folderType) =>
            selectedKeys.has(getComponentKey(folderType, folderPath)) || selectedKeys.has(getComponentKey(folderType, `${folderPath}/`)),
        );
        const anyFolderTypeScanned = parentFolderTypes.some((folderType) => targetLookup.has(folderType));
        const folderInTarget = parentFolderTypes.some((folderType) => {
          const targetNames = targetLookup.get(folderType);
          return Boolean(targetNames?.has(folderPath) || targetNames?.has(`${folderPath}/`));
        });

        if (!folderInSelection && !folderInTarget && anyFolderTypeScanned) {
          const primaryFolderType = parentFolderTypes[0];
          const addableKey = parentFolderTypes
            .flatMap((folderType) => [getComponentKey(folderType, folderPath), getComponentKey(folderType, `${folderPath}/`)])
            .find((candidateKey) => allSourceComponentsByKey.has(candidateKey));

          const findingKey = `structural:${component.key}->${primaryFolderType}:${folderPath}`;
          if (!seenFindingKeys.has(findingKey)) {
            seenFindingKeys.add(findingKey);
            findings.push({
              key: findingKey,
              sourceComponentKey: component.key,
              sourceComponentType: component.type,
              sourceComponentName: component.fullName,
              referencedType: primaryFolderType,
              referencedName: folderPath,
              severity: 'missing',
              source: 'structural',
              message: `Parent folder "${folderPath}" is not in the target org or deployment selection.`,
              addableComponentKey: addableKey,
            });
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Cross-reference Tooling API `MetadataComponentDependency` rows against the deployment selection
 * and the destination org's `listMetadata` inventory.
 */
export function analyzeToolingDependencies(
  selectedComponents: OrgAlignmentComponentItem[],
  records: ToolingDependencyRecord[],
  allSourceComponentsByKey: Map<string, OrgAlignmentComponentItem>,
  targetInventoryByType: Record<string, ListMetadataResult[]>,
  componentIdToSelectedComponent: Map<string, OrgAlignmentComponentItem>,
): OrgAlignmentDependencyFinding[] {
  const selectedKeys = new Set(selectedComponents.map(({ key }) => key));
  const targetLookup = buildTargetNameLookup(targetInventoryByType);
  const findings: OrgAlignmentDependencyFinding[] = [];
  const seenKeys = new Set<string>();

  for (const record of records) {
    const sourceComponent = componentIdToSelectedComponent.get(record.MetadataComponentId);
    if (!sourceComponent) {
      continue;
    }

    const rawRefType = record.RefMetadataComponentType;
    const refName = record.RefMetadataComponentName;
    if (!rawRefType || !refName || IGNORED_TOOLING_REF_TYPES.has(rawRefType)) {
      continue;
    }

    const refType = TOOLING_TYPE_TO_METADATA_TYPE[rawRefType] || rawRefType;
    const refNamespace = record.RefMetadataComponentNamespace || null;
    const refKey = getComponentKey(refType, refName);

    // Skip self-references or items already chosen for deployment
    if (refKey === sourceComponent.key || selectedKeys.has(refKey)) {
      continue;
    }

    const findingKey = `tooling:${sourceComponent.key}->${refType}:${refNamespace ? `${refNamespace}__` : ''}${refName}`;
    if (seenKeys.has(findingKey)) {
      continue;
    }
    seenKeys.add(findingKey);

    if (refNamespace) {
      findings.push({
        key: findingKey,
        sourceComponentKey: sourceComponent.key,
        sourceComponentType: sourceComponent.type,
        sourceComponentName: sourceComponent.fullName,
        referencedType: refType,
        referencedName: `${refNamespace}__${refName}`,
        referencedNamespace: refNamespace,
        severity: 'external',
        source: 'tooling-api',
        message: `References managed package component (${refNamespace}). Ensure the package is installed in the target org.`,
      });
      continue;
    }

    const targetNamesForType = targetLookup.get(refType);
    const sourceCandidate = allSourceComponentsByKey.get(refKey);
    // Tooling API returns CustomField names without the Object prefix (e.g. `MyField__c`); match by suffix when needed
    const existsInTarget = Boolean(
      targetNamesForType?.has(refName) ||
      (refType === 'CustomField' &&
        targetNamesForType &&
        Array.from(targetNamesForType).some((fullName) => fullName.endsWith(`.${refName}`) || fullName.endsWith(`.${refName}__c`))),
    );

    if (existsInTarget) {
      if (sourceCandidate?.status === 'different') {
        findings.push({
          key: findingKey,
          sourceComponentKey: sourceComponent.key,
          sourceComponentType: sourceComponent.type,
          sourceComponentName: sourceComponent.fullName,
          referencedType: refType,
          referencedName: refName,
          severity: 'differs',
          source: 'tooling-api',
          message: `Exists in target org, but differs from source. Include it if your changes depend on the updated version.`,
          addableComponentKey: sourceCandidate.key,
        });
      }
      continue;
    }

    if (targetNamesForType) {
      // Type was scanned in target org and this referenced component was NOT found there
      findings.push({
        key: findingKey,
        sourceComponentKey: sourceComponent.key,
        sourceComponentType: sourceComponent.type,
        sourceComponentName: sourceComponent.fullName,
        referencedType: refType,
        referencedName: refName,
        severity: 'missing',
        source: 'tooling-api',
        message: `Referenced by ${sourceComponent.fullName}, but not found in the target org's ${refType} list.`,
        addableComponentKey: sourceCandidate ? sourceCandidate.key : undefined,
      });
    } else {
      findings.push({
        key: findingKey,
        sourceComponentKey: sourceComponent.key,
        sourceComponentType: sourceComponent.type,
        sourceComponentName: sourceComponent.fullName,
        referencedType: refType,
        referencedName: refName,
        severity: 'external',
        source: 'tooling-api',
        message: `Referenced by ${sourceComponent.fullName}. "${refType}" was not included in this comparison — verify it exists in the target org.`,
        addableComponentKey: sourceCandidate ? sourceCandidate.key : undefined,
      });
    }
  }

  return findings;
}

function buildToolingDependenciesSoql(componentIds: string[]): string {
  return composeQuery({
    fields: [
      getField('MetadataComponentId'),
      getField('MetadataComponentName'),
      getField('MetadataComponentType'),
      getField('RefMetadataComponentId'),
      getField('RefMetadataComponentName'),
      getField('RefMetadataComponentType'),
      getField('RefMetadataComponentNamespace'),
    ],
    sObject: 'MetadataComponentDependency',
    where: {
      left: {
        field: 'MetadataComponentId',
        operator: 'IN',
        value: componentIds,
        literalType: 'STRING',
      },
    },
  });
}

export interface UseDependenciesOptions {
  deploySourceOrg: SalesforceOrgUi | null;
  selectedComponents: OrgAlignmentComponentItem[];
  allSourceComponents: OrgAlignmentComponentItem[];
  targetInventoryByType: Record<string, ListMetadataResult[]>;
  /** Whether the selected components are deployed A -> B (use sourceItem.id) or B -> A (use targetItem.id) */
  direction: 'A_TO_B' | 'B_TO_A';
  enabled?: boolean;
}

/**
 * Best-effort pre-deploy dependency hook.
 * Checks the user's selected components against both:
 * 1. The destination org's `listMetadata` inventory (structural parent/folder checks)
 * 2. Salesforce's Tooling `MetadataComponentDependency` API on the deploy source org
 *
 * Results are always labelled best-effort and never block deployment.
 */
export function useDependencies({
  deploySourceOrg,
  selectedComponents,
  allSourceComponents,
  targetInventoryByType,
  direction,
  enabled = true,
}: UseDependenciesOptions) {
  const isMounted = useRef(true);
  const requestIdRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [toolingFindings, setToolingFindings] = useState<OrgAlignmentDependencyFinding[]>([]);
  const [toolingApiError, setToolingApiError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [recheckCounter, setRecheckCounter] = useState(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const allSourceComponentsByKey = useMemo(
    () => new Map(allSourceComponents.map((component) => [component.key, component])),
    [allSourceComponents],
  );

  const structuralFindings = useMemo(
    () => (enabled ? findStructuralDependencies(selectedComponents, allSourceComponentsByKey, targetInventoryByType) : []),
    [allSourceComponentsByKey, enabled, selectedComponents, targetInventoryByType],
  );

  const selectedSignature = useMemo(
    () =>
      selectedComponents
        .map(({ key }) => key)
        .sort()
        .join('|'),
    [selectedComponents],
  );

  // Keep latest snapshots in refs so the effect only re-queries Salesforce when the org, direction,
  // enabled flag, selected component keys, or explicit recheck counter actually change.
  const latestInputsRef = useRef({
    deploySourceOrg,
    selectedComponents,
    allSourceComponentsByKey,
    targetInventoryByType,
    direction,
  });

  useEffect(() => {
    latestInputsRef.current = {
      deploySourceOrg,
      selectedComponents,
      allSourceComponentsByKey,
      targetInventoryByType,
      direction,
    };
  });

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const {
      deploySourceOrg: currentSourceOrg,
      selectedComponents: currentSelected,
      allSourceComponentsByKey: currentAllByKey,
      targetInventoryByType: currentTargetInventory,
      direction: currentDirection,
    } = latestInputsRef.current;

    if (!enabled || !currentSourceOrg?.uniqueId || currentSelected.length === 0) {
      return;
    }

    const componentIdToSelectedComponent = new Map<string, OrgAlignmentComponentItem>();
    for (const component of currentSelected) {
      const listItem = currentDirection === 'A_TO_B' ? component.sourceItem : component.targetItem;
      // Salesforce metadata Ids are 15 or 18 alphanumeric characters
      if (listItem?.id && /^[a-zA-Z0-9]{15,18}$/.test(listItem.id)) {
        componentIdToSelectedComponent.set(listItem.id, component);
      }
    }

    const componentIds = Array.from(componentIdToSelectedComponent.keys());
    if (componentIds.length === 0) {
      return;
    }

    const runQuery = async () => {
      setLoading(true);
      setToolingApiError(null);
      try {
        const allRecords: ToolingDependencyRecord[] = [];
        let partialError: string | null = null;

        for (const idChunk of splitArrayToMaxSize(componentIds, DEPENDENCY_QUERY_ID_BATCH_SIZE)) {
          if (!isMounted.current || requestIdRef.current !== requestId) {
            return;
          }
          try {
            const response = await queryAllWithCacheUsingOffset<ToolingDependencyRecord>(
              currentSourceOrg,
              buildToolingDependenciesSoql(idChunk),
              true,
              DEPENDENCY_QUERY_MAX_OFFSET,
            );
            allRecords.push(...(response.queryResults.records || []));
          } catch (ex) {
            logger.warn('[ORG ALIGNMENT][DEPENDENCIES][TOOLING ERROR]', ex);
            partialError = getErrorMessage(ex);
          }
        }

        if (!isMounted.current || requestIdRef.current !== requestId) {
          return;
        }

        const analyzed = analyzeToolingDependencies(
          currentSelected,
          allRecords,
          currentAllByKey,
          currentTargetInventory,
          componentIdToSelectedComponent,
        );
        setToolingFindings(analyzed);
        setToolingApiError(partialError);
        setCheckedAt(new Date());
      } catch (ex) {
        if (!isMounted.current || requestIdRef.current !== requestId) {
          return;
        }
        logger.warn('[ORG ALIGNMENT][DEPENDENCIES][ERROR]', ex);
        setToolingApiError(getErrorMessage(ex));
        setToolingFindings([]);
      } finally {
        if (isMounted.current && requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    void Promise.resolve().then(runQuery);
  }, [deploySourceOrg?.uniqueId, direction, enabled, recheckCounter, selectedSignature]);

  const recheck = useCallback(() => {
    setRecheckCounter((count) => count + 1);
  }, []);

  const hasQueryableSelection = useMemo(
    () =>
      enabled &&
      Boolean(deploySourceOrg?.uniqueId) &&
      selectedComponents.some((component) => {
        const listItem = direction === 'A_TO_B' ? component.sourceItem : component.targetItem;
        return Boolean(listItem?.id && /^[a-zA-Z0-9]{15,18}$/.test(listItem.id));
      }),
    [deploySourceOrg?.uniqueId, direction, enabled, selectedComponents],
  );

  // Combine structural + Tooling API findings, deduplicating when both flag the same (source -> referenced) pair
  const activeToolingFindings = useMemo(() => (hasQueryableSelection ? toolingFindings : []), [hasQueryableSelection, toolingFindings]);
  const activeToolingApiError = hasQueryableSelection ? toolingApiError : null;

  const findings = useMemo(() => {
    const combined: OrgAlignmentDependencyFinding[] = [...structuralFindings];
    const seenPairs = new Set(
      structuralFindings.map((finding) => `${finding.sourceComponentKey}->${finding.referencedType}:${finding.referencedName}`),
    );
    for (const finding of activeToolingFindings) {
      const pairKey = `${finding.sourceComponentKey}->${finding.referencedType}:${finding.referencedName}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        combined.push(finding);
      }
    }
    const severityOrder: Record<OrgAlignmentDependencyFinding['severity'], number> = {
      missing: 0,
      differs: 1,
      external: 2,
    };
    return combined.sort((first, second) => {
      const severityDiff = severityOrder[first.severity] - severityOrder[second.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return first.referencedName.localeCompare(second.referencedName);
    });
  }, [activeToolingFindings, structuralFindings]);

  const missingCount = useMemo(() => findings.filter(({ severity }) => severity === 'missing').length, [findings]);
  const differsCount = useMemo(() => findings.filter(({ severity }) => severity === 'differs').length, [findings]);
  const externalCount = useMemo(() => findings.filter(({ severity }) => severity === 'external').length, [findings]);

  return {
    loading: hasQueryableSelection && loading,
    findings,
    missingCount,
    differsCount,
    externalCount,
    toolingApiError: activeToolingApiError,
    checkedAt,
    recheck,
  };
}

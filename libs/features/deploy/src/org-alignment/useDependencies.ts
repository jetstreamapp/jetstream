import { fetchListMetadataForType, getMetadataLabelFromFullName } from '@jetstream/connected-ui';
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

/** Folder-based types need a request per folder to be listed, so they are not looked up automatically */
const TYPES_NOT_LISTED_AUTOMATICALLY = new Set([
  ...Object.keys(FOLDER_CHILD_TO_PARENT_TYPES),
  ...Object.values(FOLDER_CHILD_TO_PARENT_TYPES).flat(),
]);

/** Salesforce returns 15 or 18 character ids depending on the API, the first 15 characters identify the record */
const getShortId = (id: string) => id.slice(0, 15);

interface ListedMetadataType {
  sourceItems: ListMetadataResult[];
  targetItems: ListMetadataResult[];
}

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
                ? 'This parent object is not in the target org or in the deployment.'
                : 'Jetstream could not check whether this parent object exists in the target org.',
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
              message: 'This parent folder is not in the target org or in the deployment.',
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
  /** Full names of the deploy source org's components by short id, Salesforce reports some references (e.g. fields) by a partial name */
  sourceItemNameById?: Map<string, string>,
): OrgAlignmentDependencyFinding[] {
  const selectedKeys = new Set(selectedComponents.map(({ key }) => key));
  const targetLookup = buildTargetNameLookup(targetInventoryByType);
  const findings: OrgAlignmentDependencyFinding[] = [];
  const seenKeys = new Set<string>();

  for (const record of records) {
    const sourceComponent =
      componentIdToSelectedComponent.get(record.MetadataComponentId) ??
      componentIdToSelectedComponent.get(getShortId(record.MetadataComponentId));
    if (!sourceComponent) {
      continue;
    }

    const rawRefType = record.RefMetadataComponentType;
    const refName =
      (record.RefMetadataComponentId && sourceItemNameById?.get(getShortId(record.RefMetadataComponentId))) ||
      record.RefMetadataComponentName;
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
        message: `Part of the managed package "${refNamespace}". Make sure the package is installed in the target org.`,
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
          message: 'Exists in the target org but is different. Add it if your changes depend on the newer version.',
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
        message: 'Not found in the target org.',
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
        message: 'Jetstream could not check whether it exists in the target org.',
        addableComponentKey: sourceCandidate ? sourceCandidate.key : undefined,
      });
    }
  }

  return findings;
}

/** Keys of the custom objects that the selected fields, validation rules, record types etc. belong to */
export function getParentCustomObjectKeys(selectedComponents: OrgAlignmentComponentItem[]): Set<string> {
  const parentKeys = new Set<string>();
  for (const { type, fullName } of selectedComponents) {
    const [objectName] = fullName.split('.');
    if (CUSTOM_OBJECT_CHILD_TYPES.has(type) && fullName.includes('.') && isCustomObjectApiName(objectName)) {
      parentKeys.add(getComponentKey('CustomObject', objectName));
    }
  }
  return parentKeys;
}

/** Referenced metadata types that were not part of the comparison, so nothing is known about them in the target org */
export function getReferencedTypesToList(records: ToolingDependencyRecord[], targetInventoryByType: Record<string, ListMetadataResult[]>) {
  const metadataTypes = new Set<string>();
  for (const { RefMetadataComponentType, RefMetadataComponentNamespace } of records) {
    if (!RefMetadataComponentType || RefMetadataComponentNamespace || IGNORED_TOOLING_REF_TYPES.has(RefMetadataComponentType)) {
      continue;
    }
    const metadataType = TOOLING_TYPE_TO_METADATA_TYPE[RefMetadataComponentType] || RefMetadataComponentType;
    if (!targetInventoryByType[metadataType] && !TYPES_NOT_LISTED_AUTOMATICALLY.has(metadataType)) {
      metadataTypes.add(metadataType);
    }
  }
  return Array.from(metadataTypes);
}

/** Lists a metadata type in both orgs, resolves with null if either org could not list it */
async function listMetadataTypeInBothOrgs(
  metadataType: string,
  deploySourceOrg: SalesforceOrgUi,
  deployTargetOrg: SalesforceOrgUi,
): Promise<ListedMetadataType | null> {
  try {
    const [sourceResult, targetResult] = await Promise.all([
      fetchListMetadataForType(deploySourceOrg, { type: metadataType, inFolder: false }),
      fetchListMetadataForType(deployTargetOrg, { type: metadataType, inFolder: false }),
    ]);
    if (sourceResult.error || targetResult.error) {
      return null;
    }
    return { sourceItems: sourceResult.items || [], targetItems: targetResult.items || [] };
  } catch (ex) {
    logger.warn('[ORG ALIGNMENT][DEPENDENCIES][LIST ERROR]', metadataType, ex);
    return null;
  }
}

/**
 * Referenced components that exist in the deploy source org but not in the target org and that were not part of
 * the comparison. They are returned as components so that they can be added to the deployment like any other.
 */
export function getComponentsMissingFromTarget(
  records: ToolingDependencyRecord[],
  listedTypes: Record<string, ListedMetadataType>,
  direction: 'A_TO_B' | 'B_TO_A',
  /** Components that are required without Salesforce reporting a reference, e.g. the parent object of a field */
  requiredComponentKeys = new Set<string>(),
): OrgAlignmentComponentItem[] {
  const componentsByKey = new Map<string, OrgAlignmentComponentItem>();
  const referencedIds = new Set(records.map(({ RefMetadataComponentId }) => getShortId(RefMetadataComponentId || '')));

  for (const [metadataType, { sourceItems, targetItems }] of Object.entries(listedTypes)) {
    const targetNames = new Set(targetItems.map(getNormalizedListItemName));
    for (const item of sourceItems) {
      const fullName = getNormalizedListItemName(item);
      const key = getComponentKey(metadataType, fullName);
      const isRequired = requiredComponentKeys.has(key) || (!!item.id && referencedIds.has(getShortId(item.id)));
      if (!isRequired || item.namespacePrefix || targetNames.has(fullName)) {
        continue;
      }
      componentsByKey.set(key, {
        key,
        type: metadataType,
        typeLabel: getMetadataLabelFromFullName(metadataType),
        fullName,
        // The component only exists in the org being deployed from, which is the target org when deploying B to A
        status: direction === 'A_TO_B' ? 'onlyInSource' : 'onlyInTarget',
        isManaged: false,
        sourceItem: direction === 'A_TO_B' ? item : undefined,
        targetItem: direction === 'A_TO_B' ? undefined : item,
        files: [],
        filesLoaded: false,
      });
    }
  }
  return Array.from(componentsByKey.values());
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
  /** When provided, referenced types that were not part of the comparison are looked up in both orgs */
  deployTargetOrg?: SalesforceOrgUi | null;
  /** Called with referenced components that are missing from the target org and were not part of the comparison */
  onComponentsDiscovered?: (components: OrgAlignmentComponentItem[]) => void;
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
  deployTargetOrg,
  onComponentsDiscovered,
  selectedComponents,
  allSourceComponents,
  targetInventoryByType,
  direction,
  enabled = true,
}: UseDependenciesOptions) {
  const isMounted = useRef(true);
  const requestIdRef = useRef(0);
  // Types looked up for the dependency check, kept so that changing the selection does not list them again
  const listedTypesRef = useRef<Record<string, ListedMetadataType | null>>({});

  const [loading, setLoading] = useState(false);
  const [toolingFindings, setToolingFindings] = useState<OrgAlignmentDependencyFinding[]>([]);
  const [toolingApiError, setToolingApiError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [recheckCounter, setRecheckCounter] = useState(0);
  // What the target org has for the types that were looked up by the dependency check
  const [listedTargetInventory, setListedTargetInventory] = useState<Record<string, ListMetadataResult[]>>({});

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
    () =>
      enabled
        ? findStructuralDependencies(selectedComponents, allSourceComponentsByKey, { ...listedTargetInventory, ...targetInventoryByType })
        : [],
    [allSourceComponentsByKey, enabled, listedTargetInventory, selectedComponents, targetInventoryByType],
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
    deployTargetOrg,
    onComponentsDiscovered,
    selectedComponents,
    allSourceComponentsByKey,
    targetInventoryByType,
    direction,
  });

  useEffect(() => {
    latestInputsRef.current = {
      deploySourceOrg,
      deployTargetOrg,
      onComponentsDiscovered,
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
      deployTargetOrg: currentTargetOrg,
      onComponentsDiscovered: currentOnComponentsDiscovered,
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

        // Referenced types that were not compared are listed in both orgs so they can be checked instead of left unverified
        const parentObjectKeys = getParentCustomObjectKeys(currentSelected);
        if (currentTargetOrg) {
          const referencedTypes = getReferencedTypesToList(allRecords, currentTargetInventory);
          if (parentObjectKeys.size > 0 && !currentTargetInventory.CustomObject) {
            referencedTypes.push('CustomObject');
          }
          const typesToList = Array.from(new Set(referencedTypes)).filter(
            (metadataType) => listedTypesRef.current[metadataType] === undefined,
          );
          const listedResults = await Promise.all(
            typesToList.map((metadataType) => listMetadataTypeInBothOrgs(metadataType, currentSourceOrg, currentTargetOrg)),
          );
          typesToList.forEach((metadataType, i) => {
            listedTypesRef.current[metadataType] = listedResults[i];
          });
          if (!isMounted.current || requestIdRef.current !== requestId) {
            return;
          }
        }

        const listedTypes: Record<string, ListedMetadataType> = {};
        for (const [metadataType, listedType] of Object.entries(listedTypesRef.current)) {
          if (listedType && !currentTargetInventory[metadataType]) {
            listedTypes[metadataType] = listedType;
          }
        }

        const discoveredComponents = getComponentsMissingFromTarget(allRecords, listedTypes, currentDirection, parentObjectKeys);
        const allByKey = new Map(currentAllByKey);
        discoveredComponents.forEach((component) => {
          if (!allByKey.has(component.key)) {
            allByKey.set(component.key, component);
          }
        });

        const targetInventory = { ...currentTargetInventory };
        const sourceItemNameById = new Map<string, string>();
        for (const [metadataType, { sourceItems, targetItems }] of Object.entries(listedTypes)) {
          targetInventory[metadataType] = targetItems;
          sourceItems.forEach((item) => item.id && sourceItemNameById.set(getShortId(item.id), getNormalizedListItemName(item)));
        }
        for (const component of currentAllByKey.values()) {
          const listItem = currentDirection === 'A_TO_B' ? component.sourceItem : component.targetItem;
          if (listItem?.id) {
            sourceItemNameById.set(getShortId(listItem.id), component.fullName);
          }
        }

        const analyzed = analyzeToolingDependencies(
          currentSelected,
          allRecords,
          allByKey,
          targetInventory,
          componentIdToSelectedComponent,
          sourceItemNameById,
        );
        if (discoveredComponents.length > 0) {
          currentOnComponentsDiscovered?.(discoveredComponents);
        }
        setListedTargetInventory(
          Object.fromEntries(Object.entries(listedTypes).map(([metadataType, { targetItems }]) => [metadataType, targetItems])),
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

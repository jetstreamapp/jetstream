import { fetchListMetadataForType, getMetadataLabelFromFullName } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { queryAllWithCacheUsingOffset } from '@jetstream/shared/data';
import { getErrorMessage, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  OrgAlignmentComponentItem,
  OrgAlignmentDependencyFinding,
  OrgAlignmentDeployDirection,
  OrgAlignmentDiffStatus,
} from './orgAlignmentTypes';
import {
  CUSTOM_OBJECT_CHILD_METADATA_TYPES,
  getComponentKey,
  getDeployFromAndTo,
  getDeployFromItem,
  getNormalizedListItemName,
} from './orgAlignmentUtils';

const DEPENDENCY_QUERY_ID_BATCH_SIZE = 40;
const DEPENDENCY_QUERY_MAX_OFFSET = 2000;

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
    if (CUSTOM_OBJECT_CHILD_METADATA_TYPES.has(component.type) && component.fullName.includes('.')) {
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
    if (CUSTOM_OBJECT_CHILD_METADATA_TYPES.has(type) && fullName.includes('.') && isCustomObjectApiName(objectName)) {
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
  direction: OrgAlignmentDeployDirection,
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
        // The component only exists in the org being deployed from
        status: getDeployFromAndTo<OrgAlignmentDiffStatus>('onlyInSource', 'onlyInTarget', direction).from,
        isManaged: false,
        ...getDeployFromAndTo({ sourceItem: item }, { targetItem: item }, direction).from,
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

/** Salesforce ids are 15 or 18 alphanumeric characters, list items of some metadata types have no usable id */
const isSalesforceId = (id?: string | null): id is string => !!id && /^[a-zA-Z0-9]{15,18}$/.test(id);

interface DependencyCheckParams {
  deploySourceOrg: SalesforceOrgUi;
  deployTargetOrg?: SalesforceOrgUi | null;
  selectedComponents: OrgAlignmentComponentItem[];
  componentsByKey: Map<string, OrgAlignmentComponentItem>;
  targetInventoryByType: Record<string, ListMetadataResult[]>;
  direction: OrgAlignmentDeployDirection;
  /** Types already looked up, added to as more are needed so that changing the selection does not list them again */
  listedTypesCache: Record<string, ListedMetadataType | null>;
  isStale: () => boolean;
}

interface DependencyCheckResult {
  findings: OrgAlignmentDependencyFinding[];
  /** Referenced components that are missing from the target org and were not part of the comparison */
  discoveredComponents: OrgAlignmentComponentItem[];
  /** What the target org has for the types that were looked up */
  listedTargetInventory: Record<string, ListMetadataResult[]>;
  errorMessage: string | null;
}

/**
 * Asks Salesforce what the selected components refer to, looks up the referenced types that were not compared
 * and classifies every reference. Resolves with null when the check was superseded.
 */
async function checkDependencies({
  deploySourceOrg,
  deployTargetOrg,
  selectedComponents,
  componentsByKey,
  targetInventoryByType,
  direction,
  listedTypesCache,
  isStale,
}: DependencyCheckParams): Promise<DependencyCheckResult | null> {
  const selectedComponentById = new Map<string, OrgAlignmentComponentItem>();
  for (const component of selectedComponents) {
    const listItemId = getDeployFromItem(component, direction)?.id;
    if (isSalesforceId(listItemId)) {
      selectedComponentById.set(listItemId, component);
    }
  }

  const records: ToolingDependencyRecord[] = [];
  let errorMessage: string | null = null;
  for (const idChunk of splitArrayToMaxSize(Array.from(selectedComponentById.keys()), DEPENDENCY_QUERY_ID_BATCH_SIZE)) {
    if (isStale()) {
      return null;
    }
    try {
      const response = await queryAllWithCacheUsingOffset<ToolingDependencyRecord>(
        deploySourceOrg,
        buildToolingDependenciesSoql(idChunk),
        true,
        DEPENDENCY_QUERY_MAX_OFFSET,
      );
      records.push(...(response.queryResults.records || []));
    } catch (ex) {
      logger.warn('[ORG ALIGNMENT][DEPENDENCIES][TOOLING ERROR]', ex);
      errorMessage = getErrorMessage(ex);
    }
  }

  // Referenced types that were not compared are listed in both orgs so they can be checked instead of left unverified
  const parentObjectKeys = getParentCustomObjectKeys(selectedComponents);
  if (deployTargetOrg) {
    const referencedTypes = getReferencedTypesToList(records, targetInventoryByType);
    if (parentObjectKeys.size > 0 && !targetInventoryByType.CustomObject) {
      referencedTypes.push('CustomObject');
    }
    const typesToList = Array.from(new Set(referencedTypes)).filter((metadataType) => listedTypesCache[metadataType] === undefined);
    const listedResults = await Promise.all(
      typesToList.map((metadataType) => listMetadataTypeInBothOrgs(metadataType, deploySourceOrg, deployTargetOrg)),
    );
    typesToList.forEach((metadataType, i) => {
      listedTypesCache[metadataType] = listedResults[i];
    });
  }
  if (isStale()) {
    return null;
  }

  const listedTypes: Record<string, ListedMetadataType> = {};
  for (const [metadataType, listedType] of Object.entries(listedTypesCache)) {
    if (listedType && !targetInventoryByType[metadataType]) {
      listedTypes[metadataType] = listedType;
    }
  }

  const discoveredComponents = getComponentsMissingFromTarget(records, listedTypes, direction, parentObjectKeys).filter(
    ({ key }) => !componentsByKey.has(key),
  );
  const allComponentsByKey = new Map(componentsByKey);
  discoveredComponents.forEach((component) => allComponentsByKey.set(component.key, component));

  const targetInventory = { ...targetInventoryByType };
  const listedTargetInventory: Record<string, ListMetadataResult[]> = {};
  const sourceItemNameById = new Map<string, string>();
  for (const [metadataType, { sourceItems, targetItems }] of Object.entries(listedTypes)) {
    targetInventory[metadataType] = targetItems;
    listedTargetInventory[metadataType] = targetItems;
    sourceItems.forEach((item) => item.id && sourceItemNameById.set(getShortId(item.id), getNormalizedListItemName(item)));
  }
  for (const component of componentsByKey.values()) {
    const listItemId = getDeployFromItem(component, direction)?.id;
    if (listItemId) {
      sourceItemNameById.set(getShortId(listItemId), component.fullName);
    }
  }

  return {
    findings: analyzeToolingDependencies(
      selectedComponents,
      records,
      allComponentsByKey,
      targetInventory,
      selectedComponentById,
      sourceItemNameById,
    ),
    discoveredComponents,
    listedTargetInventory,
    errorMessage,
  };
}

/** Structural findings first, then the references Salesforce reported that were not already flagged, most severe first */
function combineFindings(structuralFindings: OrgAlignmentDependencyFinding[], toolingFindings: OrgAlignmentDependencyFinding[]) {
  const getPairKey = ({ sourceComponentKey, referencedType, referencedName }: OrgAlignmentDependencyFinding) =>
    `${sourceComponentKey}->${referencedType}:${referencedName}`;
  const seenPairs = new Set(structuralFindings.map(getPairKey));
  const combined = [...structuralFindings];
  for (const finding of toolingFindings) {
    if (!seenPairs.has(getPairKey(finding))) {
      seenPairs.add(getPairKey(finding));
      combined.push(finding);
    }
  }
  const severityOrder: Record<OrgAlignmentDependencyFinding['severity'], number> = { missing: 0, differs: 1, external: 2 };
  return combined.sort(
    (first, second) =>
      severityOrder[first.severity] - severityOrder[second.severity] || first.referencedName.localeCompare(second.referencedName),
  );
}

export interface UseDependenciesOptions {
  deploySourceOrg: SalesforceOrgUi | null;
  /** When provided, referenced types that were not part of the comparison are looked up in both orgs */
  deployTargetOrg?: SalesforceOrgUi | null;
  /** Keys of the components chosen for the deployment */
  selectedKeys: ReadonlySet<string>;
  /** Every component of the comparison */
  comparedComponents: OrgAlignmentComponentItem[];
  targetInventoryByType: Record<string, ListMetadataResult[]>;
  direction: OrgAlignmentDeployDirection;
  enabled?: boolean;
}

/**
 * Best-effort pre-deploy dependency check of the selected components against:
 * 1. What exists in the org being deployed to (parent object and folder checks)
 * 2. Salesforce's Tooling `MetadataComponentDependency` API on the org being deployed from
 *
 * Dependencies that were not part of the comparison are added to the components the hook returns, so that they
 * can be selected like any other. Results never block deployment.
 */
export function useDependencies({
  deploySourceOrg,
  deployTargetOrg,
  selectedKeys,
  comparedComponents,
  targetInventoryByType,
  direction,
  enabled = true,
}: UseDependenciesOptions) {
  const isMounted = useRef(true);
  const requestIdRef = useRef(0);
  const listedTypesRef = useRef<Record<string, ListedMetadataType | null>>({});

  const [loading, setLoading] = useState(false);
  const [toolingFindings, setToolingFindings] = useState<OrgAlignmentDependencyFinding[]>([]);
  const [toolingApiError, setToolingApiError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [recheckCounter, setRecheckCounter] = useState(0);
  const [listedTargetInventory, setListedTargetInventory] = useState<Record<string, ListMetadataResult[]>>({});
  const [discoveredComponents, setDiscoveredComponents] = useState<OrgAlignmentComponentItem[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const componentsByKey = useMemo(() => {
    const byKey = new Map(comparedComponents.map((component) => [component.key, component]));
    discoveredComponents.forEach((component) => !byKey.has(component.key) && byKey.set(component.key, component));
    return byKey;
  }, [comparedComponents, discoveredComponents]);

  const selectedComponents = useMemo(
    () =>
      Array.from(selectedKeys)
        .map((key) => componentsByKey.get(key))
        .filter((component): component is OrgAlignmentComponentItem => Boolean(component)),
    [componentsByKey, selectedKeys],
  );

  const structuralFindings = useMemo(
    () =>
      enabled
        ? findStructuralDependencies(selectedComponents, componentsByKey, { ...listedTargetInventory, ...targetInventoryByType })
        : [],
    [componentsByKey, enabled, listedTargetInventory, selectedComponents, targetInventoryByType],
  );

  const selectedSignature = useMemo(() => Array.from(selectedKeys).sort().join('|'), [selectedKeys]);

  // The latest inputs are read from a ref so that Salesforce is only asked again when the org, direction,
  // selection or recheck counter change, not every time one of these objects is rebuilt
  const latestInputsRef = useRef({ deploySourceOrg, deployTargetOrg, selectedComponents, componentsByKey, targetInventoryByType });
  useEffect(() => {
    latestInputsRef.current = { deploySourceOrg, deployTargetOrg, selectedComponents, componentsByKey, targetInventoryByType };
  });

  const hasQueryableSelection =
    enabled &&
    Boolean(deploySourceOrg?.uniqueId) &&
    selectedComponents.some((component) => isSalesforceId(getDeployFromItem(component, direction)?.id));

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const { deploySourceOrg: currentSourceOrg, ...currentInputs } = latestInputsRef.current;
    if (!hasQueryableSelection || !currentSourceOrg) {
      return;
    }
    const isStale = () => !isMounted.current || requestIdRef.current !== requestId;

    const runCheck = async () => {
      setLoading(true);
      setToolingApiError(null);
      try {
        const result = await checkDependencies({
          ...currentInputs,
          deploySourceOrg: currentSourceOrg,
          direction,
          listedTypesCache: listedTypesRef.current,
          isStale,
        });
        if (!result || isStale()) {
          return;
        }
        if (result.discoveredComponents.length > 0) {
          setDiscoveredComponents((previous) => [...previous, ...result.discoveredComponents]);
        }
        setListedTargetInventory(result.listedTargetInventory);
        setToolingFindings(result.findings);
        setToolingApiError(result.errorMessage);
        setCheckedAt(new Date());
      } catch (ex) {
        if (isStale()) {
          return;
        }
        logger.warn('[ORG ALIGNMENT][DEPENDENCIES][ERROR]', ex);
        setToolingApiError(getErrorMessage(ex));
        setToolingFindings([]);
      } finally {
        if (!isStale()) {
          setLoading(false);
        }
      }
    };

    void Promise.resolve().then(runCheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploySourceOrg?.uniqueId, direction, hasQueryableSelection, recheckCounter, selectedSignature]);

  const recheck = useCallback(() => {
    setRecheckCounter((count) => count + 1);
  }, []);

  const findings = useMemo(
    () => combineFindings(structuralFindings, hasQueryableSelection ? toolingFindings : []),
    [hasQueryableSelection, structuralFindings, toolingFindings],
  );

  return {
    /** Every component of the comparison plus the dependencies that were found outside of it */
    componentsByKey,
    selectedComponents,
    loading: hasQueryableSelection && loading,
    findings,
    toolingApiError: hasQueryableSelection ? toolingApiError : null,
    checkedAt,
    recheck,
  };
}

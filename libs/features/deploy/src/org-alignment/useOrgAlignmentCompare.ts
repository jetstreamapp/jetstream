import {
  COMMON_METADATA_TYPES,
  fetchListMetadataForType,
  getMetadataLabelFromFullName,
  METADATA_TYPES_TO_OMIT,
} from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { JOB_CANCELED_ERROR_MESSAGE } from '@jetstream/shared/constants';
import { describeMetadata } from '@jetstream/shared/data';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage, orderValues } from '@jetstream/shared/utils';
import {
  DescribeMetadataResult,
  ListMetadataResult,
  MetadataObject,
  OrgAlignmentRunSummaryCounts,
  OrgAlignmentSelectionMode,
  SalesforceOrgUi,
} from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChunkedRetrieveOptions, retrieveMetadataChunked } from '../view-or-compare-metadata/useViewOrCompareMetadata';
import { FilePropertiesWithContent } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { isPermissionXmlType } from '../view-or-compare-metadata/xmlNormalizer';
import {
  getMetadataTypeComparability,
  getProfileCompanions,
  PROFILE_METADATA_TYPE,
  PROFILE_RETRIEVE_CHUNK_SIZE,
  PROFILE_TOO_LARGE_UNCOMPARABLE_REASON,
} from './orgAlignmentMetadataClassification';
import { OrgAlignmentComponentItem, OrgAlignmentProgress, OrgAlignmentTypeResult } from './orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildFilePairsForComponent,
  buildTypeComparisonComponents,
  ComponentFileOptions,
  CONTAINER_PARENT_METADATA_TYPES,
  createEmptySummaryCounts,
  getComponentFilesByName,
  setDiffListMetadata,
} from './orgAlignmentUtils';

export interface RunOrgAlignmentParams {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  selectionMode: OrgAlignmentSelectionMode;
  selectedMetadataTypes: string[];
  includeManaged: boolean;
  normalizePermissionXml: boolean;
  skipRequestCache?: boolean;
  onComplete?: (summary: OrgAlignmentRunSummaryCounts, results: OrgAlignmentTypeResult[]) => void;
}

interface ActiveRunContext {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  includeManaged: boolean;
  normalizePermissionXml: boolean;
  skipRequestCache: boolean;
  sourceDescribeMap: Record<string, MetadataObject>;
  targetDescribeMap: Record<string, MetadataObject>;
}

const INITIAL_PROGRESS: OrgAlignmentProgress = {
  running: false,
  currentType: null,
  completedTypes: 0,
  totalTypes: 0,
  phase: 'idle',
  detailMessage: '',
};

/**
 * Flatten a DescribeMetadataResult into a lookup map of xmlName -> MetadataObject,
 * matching `useDescribeMetadata` (including folder types and childXmlNames).
 */
export function buildDescribeMetadataMap(describeResult: DescribeMetadataResult): Record<string, MetadataObject> {
  const itemMap: Record<string, MetadataObject> = {};
  for (const item of describeResult.metadataObjects || []) {
    if (!item) {
      continue;
    }
    itemMap[item.xmlName] = item;
    if (item.inFolder) {
      itemMap[`${item.xmlName}Folder`] = {
        ...item,
        xmlName: `${item.xmlName}Folder`,
        inFolder: false,
        childXmlNames: [],
      };
      if (item.directoryName === 'email') {
        itemMap['EmailFolder'] = {
          ...item,
          xmlName: 'EmailFolder',
          inFolder: false,
          childXmlNames: [],
        };
      }
    }
    if (Array.isArray(item.childXmlNames)) {
      for (const childXmlName of item.childXmlNames) {
        itemMap[childXmlName] = {
          xmlName: childXmlName,
          inFolder: false,
        };
      }
    }
  }
  return itemMap;
}

function resolveMetadataTypesToCompare(
  selectionMode: OrgAlignmentSelectionMode,
  selectedMetadataTypes: string[],
  sourceDescribeMap: Record<string, MetadataObject>,
  targetDescribeMap: Record<string, MetadataObject>,
): string[] {
  const allAvailableTypes = new Set([...Object.keys(sourceDescribeMap), ...Object.keys(targetDescribeMap)]);
  if (selectionMode === 'common') {
    return orderValues(COMMON_METADATA_TYPES.filter((type) => allAvailableTypes.has(type) && !METADATA_TYPES_TO_OMIT.has(type)));
  }
  if (selectionMode === 'all') {
    return orderValues(Array.from(allAvailableTypes).filter((type) => !METADATA_TYPES_TO_OMIT.has(type)));
  }
  return orderValues(selectedMetadataTypes.filter((type) => !METADATA_TYPES_TO_OMIT.has(type)));
}

/**
 * Types are compared in an order that lets later types use what earlier ones found:
 * parent files (e.g. CustomObject) come after the child types they contain, and profiles come last because
 * they are retrieved together with every component they refer to.
 */
export function getTypeProcessingRank(metadataType: string): number {
  if (metadataType === PROFILE_METADATA_TYPE) {
    return 2;
  }
  return CONTAINER_PARENT_METADATA_TYPES.has(metadataType) ? 1 : 0;
}

/**
 * How many types are compared at the same time. Every type makes requests to both orgs, and Salesforce only
 * serves a few slow requests per org at once (5 on Developer Edition and trial orgs).
 */
export const MAX_TYPES_COMPARED_IN_PARALLEL = 3;

/** Types of the same rank do not depend on each other and can be compared in parallel */
export function groupTypesByProcessingRank<T extends { type: string }>(typeEntries: T[]): T[][] {
  const groupsByRank = new Map<number, T[]>();
  for (const typeEntry of typeEntries) {
    const rank = getTypeProcessingRank(typeEntry.type);
    groupsByRank.set(rank, [...(groupsByRank.get(rank) ?? []), typeEntry]);
  }
  return Array.from(groupsByRank.entries())
    .sort(([rankA], [rankB]) => rankA - rankB)
    .map(([, group]) => group);
}

type OrgSide = 'source' | 'target';

/**
 * How one metadata type must be retrieved from one org, given the types compared so far.
 * `uncomparableReason` is set when the type cannot be retrieved completely.
 */
export function getRetrieveOptionsForType(
  metadataType: string,
  side: OrgSide,
  typeResults: OrgAlignmentTypeResult[],
): { options: ChunkedRetrieveOptions; uncomparableReason?: string } {
  // Only the file contents are compared, the merged zip is never used
  const options: ChunkedRetrieveOptions = { buildZip: false };
  if (metadataType !== PROFILE_METADATA_TYPE) {
    return { options };
  }
  const listItemsByType: Record<string, ListMetadataResult[]> = {};
  for (const { type, executionStatus, sourceListItems, targetListItems } of typeResults) {
    if (executionStatus === 'complete') {
      listItemsByType[type] = side === 'source' ? sourceListItems : targetListItems;
    }
  }
  const companions = getProfileCompanions(listItemsByType);
  if (!companions) {
    return { options, uncomparableReason: PROFILE_TOO_LARGE_UNCOMPARABLE_REASON };
  }
  return {
    options: {
      ...options,
      maxComponentsPerChunk: PROFILE_RETRIEVE_CHUNK_SIZE,
      includeWithEveryChunk: companions,
      includeFile: ({ type }) => type === PROFILE_METADATA_TYPE,
    },
  };
}

/** Child components compared on their own are removed from their parent's file, see `removeSeparatelyComparedChildren` */
export function getComponentFileOptions(metadataType: string, typeResults: OrgAlignmentTypeResult[]): ComponentFileOptions {
  if (!CONTAINER_PARENT_METADATA_TYPES.has(metadataType)) {
    return {};
  }
  const separatelyComparedKeys = new Set<string>();
  for (const { components } of typeResults) {
    components.forEach(({ key }) => separatelyComparedKeys.add(key));
  }
  return { separatelyComparedKeys };
}

/**
 * Orchestrates org-wide metadata alignment, a few types at a time:
 * 1. Describes both orgs and classifies uncomparable types explicitly.
 * 2. Calls `listMetadata` on Org A and Org B and computes a set-diff first.
 * 3. Retrieves ONLY candidates present in both orgs using chunked retrieves (safe under 10,000 files).
 * 4. Supports live progress, clean cancellation, per-type retry, and lazy on-demand file loading.
 */
export function useOrgAlignmentCompare() {
  const isMounted = useRef(true);
  const runIdRef = useRef(0);
  const canceledRef = useRef(false);
  const activeRunContextRef = useRef<ActiveRunContext | null>(null);
  const typeResultsRef = useRef<OrgAlignmentTypeResult[]>([]);

  const [typeResults, setTypeResults] = useState<OrgAlignmentTypeResult[]>([]);
  const [progress, setProgress] = useState<OrgAlignmentProgress>(INITIAL_PROGRESS);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<Date | null>(null);

  const { serverUrl } = useAtomValue(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      canceledRef.current = true;
    };
  }, []);

  /**
   * The ref is the source of truth and is updated synchronously, so a type that has just finished is always
   * visible to the next type that is processed (profiles and parent files depend on the earlier results).
   */
  const replaceTypeResults = useCallback((getNext: (previous: OrgAlignmentTypeResult[]) => OrgAlignmentTypeResult[]) => {
    typeResultsRef.current = getNext(typeResultsRef.current);
    setTypeResults(typeResultsRef.current);
  }, []);

  const updateTypeResult = useCallback(
    (metadataType: string, updater: (prev: OrgAlignmentTypeResult) => OrgAlignmentTypeResult) => {
      replaceTypeResults((previous) => previous.map((entry) => (entry.type === metadataType ? updater(entry) : entry)));
    },
    [replaceTypeResults],
  );

  const processSingleType = useCallback(
    async (metadataType: string, inFolder: boolean, context: ActiveRunContext, runId: number): Promise<void> => {
      const isStaleOrCanceled = () => !isMounted.current || canceledRef.current || runIdRef.current !== runId;
      const typeLabel = getMetadataLabelFromFullName(metadataType);

      if (isStaleOrCanceled()) {
        throw new Error(JOB_CANCELED_ERROR_MESSAGE);
      }

      updateTypeResult(metadataType, (prev) => ({
        ...prev,
        executionStatus: 'listing',
        errorMessage: undefined,
        progressMessage: 'Listing metadata in both orgs...',
      }));

      const sourceHasType = Boolean(context.sourceDescribeMap[metadataType]);
      const targetHasType = Boolean(context.targetDescribeMap[metadataType]);

      const [sourceListResult, targetListResult] = await Promise.all([
        sourceHasType
          ? fetchListMetadataForType(context.sourceOrg, { type: metadataType, inFolder }, { skipRequestCache: context.skipRequestCache })
          : Promise.resolve({ items: [] as ListMetadataResult[] }),
        targetHasType
          ? fetchListMetadataForType(context.targetOrg, { type: metadataType, inFolder }, { skipRequestCache: context.skipRequestCache })
          : Promise.resolve({ items: [] as ListMetadataResult[] }),
      ]);

      if (isStaleOrCanceled()) {
        throw new Error(JOB_CANCELED_ERROR_MESSAGE);
      }

      const sourceListItems = sourceListResult.items || [];
      const targetListItems = targetListResult.items || [];
      const setDiff = setDiffListMetadata(sourceListItems, targetListItems, {
        includeManaged: context.includeManaged,
      });

      let sourceRetrievedFiles: FilePropertiesWithContent[] = [];
      let targetRetrievedFiles: FilePropertiesWithContent[] = [];

      const sourceRetrieveConfig = getRetrieveOptionsForType(metadataType, 'source', typeResultsRef.current);
      const targetRetrieveConfig = getRetrieveOptionsForType(metadataType, 'target', typeResultsRef.current);
      const uncomparableReason = sourceRetrieveConfig.uncomparableReason ?? targetRetrieveConfig.uncomparableReason;

      if (setDiff.candidates.length > 0 && !uncomparableReason) {
        updateTypeResult(metadataType, (prev) => ({
          ...prev,
          executionStatus: 'retrieving',
          sourceListItems,
          targetListItems,
          progressMessage: `Retrieving ${setDiff.candidates.length} shared ${typeLabel} candidates...`,
        }));

        const sourceCandidatePayload: Record<string, ListMetadataResult[]> = {
          [metadataType]: setDiff.candidates.map(({ source }) => source),
        };
        const targetCandidatePayload: Record<string, ListMetadataResult[]> = {
          [metadataType]: setDiff.candidates.map(({ target }) => target),
        };

        const [sourceRetrieve, targetRetrieve] = await Promise.all([
          retrieveMetadataChunked(context.sourceOrg, sourceCandidatePayload, {
            ...sourceRetrieveConfig.options,
            isCanceled: isStaleOrCanceled,
            onChunkProgress: ({ completedChunks, totalChunks }) => {
              if (!isStaleOrCanceled() && totalChunks > 1) {
                const chunkLabel = `Retrieving ${typeLabel}, chunk ${Math.min(completedChunks + 1, totalChunks)} of ${totalChunks}`;
                updateTypeResult(metadataType, (prev) => ({ ...prev, progressMessage: chunkLabel }));
              }
            },
          }),
          retrieveMetadataChunked(context.targetOrg, targetCandidatePayload, {
            ...targetRetrieveConfig.options,
            isCanceled: isStaleOrCanceled,
          }),
        ]);

        if (isStaleOrCanceled()) {
          throw new Error(JOB_CANCELED_ERROR_MESSAGE);
        }

        sourceRetrievedFiles = sourceRetrieve.fileProperties;
        targetRetrievedFiles = targetRetrieve.fileProperties;
      }

      updateTypeResult(metadataType, (prev) => ({
        ...prev,
        executionStatus: 'comparing',
        progressMessage: 'Comparing files...',
      }));

      const { components, counts } = buildTypeComparisonComponents(metadataType, setDiff, sourceRetrievedFiles, targetRetrievedFiles, {
        normalizePermissionXml: context.normalizePermissionXml,
        uncomparableReason,
        ...getComponentFileOptions(metadataType, typeResultsRef.current),
      });

      updateTypeResult(metadataType, (prev) => ({
        ...prev,
        executionStatus: 'complete',
        sourceListItems,
        targetListItems,
        components,
        counts,
        errorMessage: undefined,
        progressMessage: undefined,
      }));
    },
    [updateTypeResult],
  );

  /**
   * Compares the types a few at a time, one rank after the other, and resolves with how many were processed.
   * A type that fails is marked as failed and does not stop the others.
   */
  const processTypes = useCallback(
    async (typeEntries: OrgAlignmentTypeResult[], context: ActiveRunContext, runId: number): Promise<number> => {
      const isStaleOrCanceled = () => !isMounted.current || canceledRef.current || runIdRef.current !== runId;
      const activeTypeLabels = new Set<string>();
      let completedCount = 0;

      const reportProgress = () => {
        if (isStaleOrCanceled()) {
          return;
        }
        setProgress((prev) => ({
          ...prev,
          completedTypes: completedCount,
          detailMessage: activeTypeLabels.size > 0 ? `Comparing ${Array.from(activeTypeLabels).join(', ')}...` : prev.detailMessage,
        }));
      };

      for (const group of groupTypesByProcessingRank(typeEntries)) {
        const queue = [...group];
        const processQueue = async () => {
          while (!isStaleOrCanceled()) {
            const typeEntry = queue.shift();
            if (!typeEntry) {
              return;
            }
            activeTypeLabels.add(typeEntry.typeLabel);
            reportProgress();
            try {
              await processSingleType(typeEntry.type, typeEntry.inFolder, context, runId);
            } catch (ex) {
              if (getErrorMessage(ex) === JOB_CANCELED_ERROR_MESSAGE || isStaleOrCanceled()) {
                return;
              }
              logger.warn('[ORG ALIGNMENT][TYPE ERROR]', typeEntry.type, ex);
              updateTypeResult(typeEntry.type, (prev) => ({
                ...prev,
                executionStatus: 'error',
                errorMessage: getErrorMessage(ex),
                progressMessage: undefined,
              }));
            } finally {
              activeTypeLabels.delete(typeEntry.typeLabel);
            }
            completedCount += 1;
            reportProgress();
          }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_TYPES_COMPARED_IN_PARALLEL, group.length) }, processQueue));
        if (isStaleOrCanceled()) {
          break;
        }
      }
      return completedCount;
    },
    [processSingleType, updateTypeResult],
  );

  const runComparison = useCallback(
    async ({
      sourceOrg,
      targetOrg,
      selectionMode,
      selectedMetadataTypes,
      includeManaged,
      normalizePermissionXml,
      skipRequestCache = false,
      onComplete,
    }: RunOrgAlignmentParams) => {
      const runId = ++runIdRef.current;
      canceledRef.current = false;
      setFatalError(null);
      setTypeResults([]);
      typeResultsRef.current = [];
      setProgress({
        running: true,
        currentType: null,
        completedTypes: 0,
        totalTypes: 0,
        phase: 'describing',
        detailMessage: 'Describing metadata types in both orgs...',
      });

      const isStaleOrCanceled = () => !isMounted.current || canceledRef.current || runIdRef.current !== runId;

      try {
        const [{ data: sourceDescribe }, { data: targetDescribe }] = await Promise.all([
          describeMetadata(sourceOrg),
          describeMetadata(targetOrg),
        ]);

        if (isStaleOrCanceled()) {
          return;
        }

        const sourceDescribeMap = buildDescribeMetadataMap(sourceDescribe);
        const targetDescribeMap = buildDescribeMetadataMap(targetDescribe);

        const context: ActiveRunContext = {
          sourceOrg,
          targetOrg,
          includeManaged,
          normalizePermissionXml,
          skipRequestCache,
          sourceDescribeMap,
          targetDescribeMap,
        };
        activeRunContextRef.current = context;

        const typesToProcess = resolveMetadataTypesToCompare(selectionMode, selectedMetadataTypes, sourceDescribeMap, targetDescribeMap);

        const initialResults: OrgAlignmentTypeResult[] = typesToProcess.map((metadataType) => {
          const comparability = getMetadataTypeComparability(metadataType);
          const describeObj = sourceDescribeMap[metadataType] || targetDescribeMap[metadataType];
          return {
            type: metadataType,
            typeLabel: getMetadataLabelFromFullName(metadataType),
            inFolder: Boolean(describeObj?.inFolder),
            executionStatus: comparability.comparable ? 'pending' : 'uncomparable',
            uncomparableReason: comparability.reason,
            sourceListItems: [],
            targetListItems: [],
            components: [],
            counts: createEmptySummaryCounts(),
          };
        });

        typeResultsRef.current = initialResults;
        setTypeResults(initialResults);

        const comparableTypes = initialResults.filter(({ executionStatus }) => executionStatus === 'pending');
        setProgress({
          running: true,
          currentType: null,
          completedTypes: 0,
          totalTypes: comparableTypes.length,
          phase: 'processing',
          detailMessage: `Preparing to compare ${comparableTypes.length} metadata types...`,
        });

        const completedCount = await processTypes(comparableTypes, context, runId);

        if (!isMounted.current || runIdRef.current !== runId) {
          return;
        }

        if (canceledRef.current) {
          replaceTypeResults((previous) =>
            previous.map((entry) =>
              entry.executionStatus === 'pending' ||
              entry.executionStatus === 'listing' ||
              entry.executionStatus === 'retrieving' ||
              entry.executionStatus === 'comparing'
                ? { ...entry, executionStatus: 'canceled' as const, progressMessage: undefined }
                : entry,
            ),
          );
          setProgress((prev) => ({
            ...prev,
            running: false,
            currentType: null,
            phase: 'canceled',
            detailMessage: `Canceled after ${completedCount} of ${comparableTypes.length} types`,
          }));
          return;
        }

        const finishedAt = new Date();
        setLastCompletedAt(finishedAt);
        setProgress({
          running: false,
          currentType: null,
          completedTypes: comparableTypes.length,
          totalTypes: comparableTypes.length,
          phase: 'complete',
          detailMessage: 'Comparison complete',
        });

        const summary = aggregateSummaryCounts(typeResultsRef.current);
        onComplete?.(summary, typeResultsRef.current);
        notifyUser('Org alignment comparison finished', {
          body: `${summary.different} different, ${summary.onlyInSource} only in ${sourceOrg.label}, ${summary.onlyInTarget} only in ${targetOrg.label}`,
          tag: 'org-alignment',
        });
      } catch (ex) {
        if (!isMounted.current || runIdRef.current !== runId) {
          return;
        }
        if (getErrorMessage(ex) === JOB_CANCELED_ERROR_MESSAGE || canceledRef.current) {
          setProgress((prev) => ({
            ...prev,
            running: false,
            currentType: null,
            phase: 'canceled',
            detailMessage: 'Comparison canceled',
          }));
          return;
        }
        logger.error('[ORG ALIGNMENT][FATAL ERROR]', ex);
        setFatalError(getErrorMessage(ex));
        setProgress({
          ...INITIAL_PROGRESS,
          phase: 'idle',
        });
      }
    },
    [notifyUser, processTypes, replaceTypeResults],
  );

  const retryTypes = useCallback(
    async (metadataTypes: string[]) => {
      const context = activeRunContextRef.current;
      if (!context || metadataTypes.length === 0) {
        return;
      }
      const runId = ++runIdRef.current;
      canceledRef.current = false;
      const targets = typeResultsRef.current.filter(({ type }) => metadataTypes.includes(type));
      if (targets.length === 0) {
        return;
      }

      setProgress({
        running: true,
        currentType: null,
        completedTypes: 0,
        totalTypes: targets.length,
        phase: 'processing',
        detailMessage: `Retrying ${targets.length} metadata type${targets.length === 1 ? '' : 's'}...`,
      });

      const completedCount = await processTypes(targets, context, runId);

      if (!isMounted.current || runIdRef.current !== runId) {
        return;
      }

      setProgress({
        running: false,
        currentType: null,
        completedTypes: completedCount,
        totalTypes: targets.length,
        phase: canceledRef.current ? 'canceled' : 'complete',
        detailMessage: canceledRef.current ? 'Retry canceled' : 'Retry complete',
      });
    },
    [processTypes],
  );

  const cancelComparison = useCallback(() => {
    canceledRef.current = true;
    setProgress((prev) => ({
      ...prev,
      detailMessage: 'Canceling after current request...',
    }));
  }, []);

  /**
   * Re-evaluate match flags on already-retrieved components when the user toggles XML normalization,
   * avoiding any redundant Salesforce API calls.
   */
  const recomputeNormalization = useCallback(
    (normalizePermissionXml: boolean) => {
      if (activeRunContextRef.current) {
        activeRunContextRef.current = { ...activeRunContextRef.current, normalizePermissionXml };
      }
      replaceTypeResults((previous) =>
        previous.map((typeResult) => {
          if (typeResult.executionStatus !== 'complete') {
            return typeResult;
          }
          const counts = {
            ...createEmptySummaryCounts(),
            managedSkipped: typeResult.counts.managedSkipped,
          };
          const countByStatus = (status: OrgAlignmentComponentItem['status']) => {
            counts[status] += 1;
          };
          const components = typeResult.components.map((component) => {
            const isCompared = component.status === 'same' || component.status === 'different';
            // Normalization only changes the outcome for permission files, and only they keep their content once compared
            if (!isCompared || !component.filesLoaded || component.files.length === 0 || !isPermissionXmlType(component.type)) {
              countByStatus(component.status);
              return component;
            }
            const sourceFiles = component.files
              .map(({ source }) => source)
              .filter((file): file is NonNullable<typeof file> => Boolean(file));
            const targetFiles = component.files
              .map(({ target }) => target)
              .filter((file): file is NonNullable<typeof file> => Boolean(file));
            const { files, allMatch } = buildFilePairsForComponent(sourceFiles, targetFiles, { normalizePermissionXml });
            const status = allMatch ? ('same' as const) : ('different' as const);
            countByStatus(status);
            return { ...component, files, status };
          });
          return { ...typeResult, components, counts };
        }),
      );
    },
    [replaceTypeResults],
  );

  /**
   * Lazily retrieve file contents for a component that has none (one-sided components, and matching ones whose
   * content was released) when a user opens it in the diff viewer, caching the retrieved files onto the component row.
   */
  const loadComponentFilesOnDemand = useCallback(
    async (component: OrgAlignmentComponentItem): Promise<OrgAlignmentComponentItem> => {
      const context = activeRunContextRef.current;
      if (!context || component.filesLoaded) {
        return component;
      }

      const retrieveFromOrg = async (org: SalesforceOrgUi, item: ListMetadataResult | undefined, side: OrgSide) => {
        if (!item) {
          return [];
        }
        // A profile that is too large to retrieve completely is still shown, with whatever Salesforce returns for it alone
        const { options, uncomparableReason } = getRetrieveOptionsForType(component.type, side, typeResultsRef.current);
        const { fileProperties } = await retrieveMetadataChunked(
          org,
          { [component.type]: [item] },
          uncomparableReason ? { buildZip: false } : options,
        );
        const componentNames = new Set([component.fullName]);
        const filesByComponent = getComponentFilesByName(
          fileProperties,
          componentNames,
          component.type,
          getComponentFileOptions(component.type, typeResultsRef.current),
        );
        return filesByComponent.get(component.fullName) ?? [];
      };

      const [sourceFiles, targetFiles] = await Promise.all([
        retrieveFromOrg(context.sourceOrg, component.sourceItem, 'source'),
        retrieveFromOrg(context.targetOrg, component.targetItem, 'target'),
      ]);
      const { files } = buildFilePairsForComponent(sourceFiles, targetFiles, {
        normalizePermissionXml: context.normalizePermissionXml,
      });

      const updatedComponent: OrgAlignmentComponentItem = {
        ...component,
        files,
        filesLoaded: true,
      };

      updateTypeResult(component.type, (prev) => ({
        ...prev,
        components: prev.components.map((entry) => (entry.key === component.key ? updatedComponent : entry)),
      }));

      return updatedComponent;
    },
    [updateTypeResult],
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    canceledRef.current = true;
    activeRunContextRef.current = null;
    typeResultsRef.current = [];
    setTypeResults([]);
    setProgress(INITIAL_PROGRESS);
    setFatalError(null);
    setLastCompletedAt(null);
  }, []);

  return {
    typeResults,
    progress,
    fatalError,
    lastCompletedAt,
    runComparison,
    retryTypes,
    cancelComparison,
    recomputeNormalization,
    loadComponentFilesOnDemand,
    reset,
  };
}

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
import { retrieveMetadataChunked } from '../view-or-compare-metadata/useViewOrCompareMetadata';
import { FilePropertiesWithContent } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { getMetadataTypeComparability } from './orgAlignmentMetadataClassification';
import { OrgAlignmentComponentItem, OrgAlignmentProgress, OrgAlignmentTypeResult } from './orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildFilePairsForComponent,
  buildTypeComparisonComponents,
  createEmptySummaryCounts,
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
 * Orchestrates org-wide metadata alignment one type at a time:
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

  const updateTypeResult = useCallback((metadataType: string, updater: (prev: OrgAlignmentTypeResult) => OrgAlignmentTypeResult) => {
    setTypeResults((previous) => {
      const next = previous.map((entry) => (entry.type === metadataType ? updater(entry) : entry));
      typeResultsRef.current = next;
      return next;
    });
  }, []);

  const processSingleType = useCallback(
    async (
      metadataType: string,
      inFolder: boolean,
      context: ActiveRunContext,
      runId: number,
      index: number,
      total: number,
    ): Promise<void> => {
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
      setProgress((prev) => ({
        ...prev,
        currentType: metadataType,
        detailMessage: `Listing ${typeLabel} (${index + 1} of ${total})...`,
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

      if (setDiff.candidates.length > 0) {
        updateTypeResult(metadataType, (prev) => ({
          ...prev,
          executionStatus: 'retrieving',
          sourceListItems,
          targetListItems,
          progressMessage: `Retrieving ${setDiff.candidates.length} shared ${typeLabel} candidates...`,
        }));
        setProgress((prev) => ({
          ...prev,
          currentType: metadataType,
          detailMessage: `Retrieving ${setDiff.candidates.length} shared ${typeLabel} (${index + 1} of ${total})...`,
        }));

        const sourceCandidatePayload: Record<string, ListMetadataResult[]> = {
          [metadataType]: setDiff.candidates.map(({ source }) => source),
        };
        const targetCandidatePayload: Record<string, ListMetadataResult[]> = {
          [metadataType]: setDiff.candidates.map(({ target }) => target),
        };

        const [sourceRetrieve, targetRetrieve] = await Promise.all([
          retrieveMetadataChunked(context.sourceOrg, sourceCandidatePayload, {
            isCanceled: isStaleOrCanceled,
            onChunkProgress: ({ completedChunks, totalChunks }) => {
              if (!isStaleOrCanceled() && totalChunks > 1) {
                const chunkLabel = `Retrieving ${typeLabel} — chunk ${Math.min(completedChunks + 1, totalChunks)} of ${totalChunks}`;
                updateTypeResult(metadataType, (prev) => ({ ...prev, progressMessage: chunkLabel }));
                setProgress((prev) => ({ ...prev, detailMessage: chunkLabel }));
              }
            },
          }),
          retrieveMetadataChunked(context.targetOrg, targetCandidatePayload, {
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

        let completedCount = 0;

        for (let i = 0; i < comparableTypes.length; i++) {
          const typeEntry = comparableTypes[i];
          if (isStaleOrCanceled()) {
            break;
          }
          try {
            await processSingleType(typeEntry.type, typeEntry.inFolder, context, runId, i, comparableTypes.length);
          } catch (ex) {
            if (getErrorMessage(ex) === JOB_CANCELED_ERROR_MESSAGE || isStaleOrCanceled()) {
              break;
            }
            logger.warn('[ORG ALIGNMENT][TYPE ERROR]', typeEntry.type, ex);
            updateTypeResult(typeEntry.type, (prev) => ({
              ...prev,
              executionStatus: 'error',
              errorMessage: getErrorMessage(ex),
              progressMessage: undefined,
            }));
          }
          completedCount += 1;
          if (!isStaleOrCanceled()) {
            setProgress((prev) => ({
              ...prev,
              completedTypes: completedCount,
            }));
          }
        }

        if (!isMounted.current || runIdRef.current !== runId) {
          return;
        }

        if (canceledRef.current) {
          setTypeResults((previous) => {
            const next = previous.map((entry) =>
              entry.executionStatus === 'pending' ||
              entry.executionStatus === 'listing' ||
              entry.executionStatus === 'retrieving' ||
              entry.executionStatus === 'comparing'
                ? { ...entry, executionStatus: 'canceled' as const, progressMessage: undefined }
                : entry,
            );
            typeResultsRef.current = next;
            return next;
          });
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
    [notifyUser, processSingleType, updateTypeResult],
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

      let completedCount = 0;
      for (let i = 0; i < targets.length; i++) {
        const typeEntry = targets[i];
        if (!isMounted.current || canceledRef.current || runIdRef.current !== runId) {
          break;
        }
        try {
          await processSingleType(typeEntry.type, typeEntry.inFolder, context, runId, i, targets.length);
        } catch (ex) {
          if (getErrorMessage(ex) === JOB_CANCELED_ERROR_MESSAGE || canceledRef.current) {
            break;
          }
          updateTypeResult(typeEntry.type, (prev) => ({
            ...prev,
            executionStatus: 'error',
            errorMessage: getErrorMessage(ex),
            progressMessage: undefined,
          }));
        }
        completedCount += 1;
        if (isMounted.current && !canceledRef.current && runIdRef.current === runId) {
          setProgress((prev) => ({ ...prev, completedTypes: completedCount }));
        }
      }

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
    [processSingleType, updateTypeResult],
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
  const recomputeNormalization = useCallback((normalizePermissionXml: boolean) => {
    if (activeRunContextRef.current) {
      activeRunContextRef.current = { ...activeRunContextRef.current, normalizePermissionXml };
    }
    setTypeResults((previous) => {
      const next = previous.map((typeResult) => {
        if (typeResult.executionStatus !== 'complete') {
          return typeResult;
        }
        const counts = {
          ...createEmptySummaryCounts(),
          managedSkipped: typeResult.counts.managedSkipped,
        };
        const components = typeResult.components.map((component) => {
          if (component.status === 'onlyInSource') {
            counts.onlyInSource += 1;
            return component;
          }
          if (component.status === 'onlyInTarget') {
            counts.onlyInTarget += 1;
            return component;
          }
          if (component.isManaged || !component.filesLoaded || component.files.length === 0) {
            counts.uncomparable += 1;
            return component;
          }
          const sourceFiles = component.files.map(({ source }) => source).filter((file): file is NonNullable<typeof file> => Boolean(file));
          const targetFiles = component.files.map(({ target }) => target).filter((file): file is NonNullable<typeof file> => Boolean(file));
          const { files, allMatch, hasReadableContent } = buildFilePairsForComponent(sourceFiles, targetFiles, {
            normalizePermissionXml,
          });
          if (!hasReadableContent) {
            counts.uncomparable += 1;
            return { ...component, files, status: 'uncomparable' as const };
          }
          if (allMatch) {
            counts.same += 1;
            return { ...component, files, status: 'same' as const };
          }
          counts.different += 1;
          return { ...component, files, status: 'different' as const };
        });
        return { ...typeResult, components, counts };
      });
      typeResultsRef.current = next;
      return next;
    });
  }, []);

  /**
   * Lazily retrieve file contents for an `onlyInSource` or `onlyInTarget` component when a user
   * opens it in the diff viewer, caching the retrieved files onto the component row.
   */
  const loadComponentFilesOnDemand = useCallback(
    async (component: OrgAlignmentComponentItem): Promise<OrgAlignmentComponentItem> => {
      const context = activeRunContextRef.current;
      if (!context || component.filesLoaded) {
        return component;
      }

      const [sourceResult, targetResult] = await Promise.all([
        component.sourceItem
          ? retrieveMetadataChunked(context.sourceOrg, { [component.type]: [component.sourceItem] })
          : Promise.resolve({ fileProperties: [] }),
        component.targetItem
          ? retrieveMetadataChunked(context.targetOrg, { [component.type]: [component.targetItem] })
          : Promise.resolve({ fileProperties: [] }),
      ]);

      const sourceFiles = sourceResult.fileProperties.filter(({ fileName }) => fileName !== 'package.xml');
      const targetFiles = targetResult.fileProperties.filter(({ fileName }) => fileName !== 'package.xml');
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

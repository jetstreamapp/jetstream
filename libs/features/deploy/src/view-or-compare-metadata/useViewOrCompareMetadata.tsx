import { JOB_CANCELED_ERROR_MESSAGE, METADATA_TYPES_WITH_FOLDERS } from '@jetstream/shared/constants';
import { getPackageXml, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { TreeItems } from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui/app-state';
import { useAtom } from 'jotai';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FileItemMetadata, FilePropertiesWithContent, OrgType } from './viewOrCompareMetadataTypes';
import { buildTree, chunkListMetadataForRetrieve, populateFileContents } from './viewOrCompareMetadataUtils';

type LoadStatus = 'Not Started' | 'Loading' | 'Success' | 'Failed';

export interface ChunkedRetrieveProgress {
  completedChunks: number;
  totalChunks: number;
}

export interface ChunkedRetrieveOptions {
  maxComponentsPerChunk?: number;
  isCanceled?: () => boolean;
  onChecked?: () => void;
  onChunkProgress?: (progress: ChunkedRetrieveProgress) => void;
}

/**
 * Retrieve metadata in chunks sized well below Salesforce's 10,000-file retrieve limit,
 * merging zip files and fileProperties across chunks. Supports cancellation between and during polls.
 */
export async function retrieveMetadataChunked(
  org: SalesforceOrgUi,
  selectedMetadata: Record<string, ListMetadataResult[]>,
  options: ChunkedRetrieveOptions = {},
): Promise<{ zip: JSZip; fileProperties: FilePropertiesWithContent[] }> {
  const { maxComponentsPerChunk, isCanceled, onChecked, onChunkProgress } = options;
  const chunks = chunkListMetadataForRetrieve(selectedMetadata, maxComponentsPerChunk);
  const mergedZip = new JSZip();
  const mergedFileProperties: FilePropertiesWithContent[] = [];
  const seenFileNames = new Set<string>();

  if (chunks.length === 0) {
    return { zip: mergedZip, fileProperties: mergedFileProperties };
  }

  for (let i = 0; i < chunks.length; i++) {
    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }
    onChunkProgress?.({ completedChunks: i, totalChunks: chunks.length });

    const { id } = await retrieveMetadataFromListMetadata(org, chunks[i]);
    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }

    const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
      isCanceled,
      onChecked: () => {
        onChecked?.();
      },
    });

    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }

    if (!isString(results.zipFile)) {
      throw new Error(results.errorMessage || 'No data was returned from Salesforce');
    }

    const chunkZip = await JSZip.loadAsync(results.zipFile, { base64: true });
    const chunkFiles: FilePropertiesWithContent[] = (results.fileProperties || []).map((file) => {
      // Folders don't have a suffix in the fileProperties response, but there is an associated file, so we must add the extension
      if (METADATA_TYPES_WITH_FOLDERS.has(file.type) && file.fileName.includes('/') && !file.fileName.includes('.')) {
        return { ...file, fileName: `${file.fileName}-meta.xml` };
      }
      return { ...file };
    });

    await populateFileContents(chunkZip, chunkFiles);

    for (const file of chunkFiles) {
      if (file.fileName === 'package.xml' && seenFileNames.has('package.xml')) {
        continue;
      }
      if (!seenFileNames.has(file.fileName)) {
        seenFileNames.add(file.fileName);
        mergedFileProperties.push(file);
      }
    }

    const zipEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
    chunkZip.forEach((relativePath, entry) => {
      if (!entry.dir) {
        zipEntries.push({ path: relativePath, entry });
      }
    });
    await Promise.all(
      zipEntries.map(async ({ path, entry }) => {
        if (path === 'package.xml' && mergedZip.file('package.xml')) {
          return;
        }
        const content = await entry.async('uint8array');
        mergedZip.file(path, content);
      }),
    );

    onChunkProgress?.({ completedChunks: i + 1, totalChunks: chunks.length });
  }

  // When multiple chunks were merged, replace the single-chunk package.xml with a combined manifest
  // so the resulting zip is complete and deployable (e.g. for target org backups).
  if (chunks.length > 1 && !isCanceled?.()) {
    try {
      const combinedPackageXml = await getPackageXml(org, selectedMetadata);
      mergedZip.file('package.xml', combinedPackageXml);
    } catch {
      // Keep the first chunk's package.xml if generating a combined manifest fails
    }
  }

  return { zip: mergedZip, fileProperties: mergedFileProperties };
}

/**
 * Filter a target org retrieve request down to items that also exist in the target org's
 * listMetadata results so we avoid retrieving components known to be absent from the target.
 */
export function filterMetadataToTargetCandidates(
  selectedMetadata: Record<string, ListMetadataResult[]>,
  targetListMetadata?: Record<string, ListMetadataResult[]> | null,
): Record<string, ListMetadataResult[]> {
  if (!targetListMetadata) {
    return selectedMetadata;
  }
  const filtered: Record<string, ListMetadataResult[]> = {};
  for (const [metadataType, sourceItems] of Object.entries(selectedMetadata)) {
    const targetItems = targetListMetadata[metadataType];
    if (!targetItems?.length) {
      continue;
    }
    const targetFullNames = new Set(targetItems.map(({ fullName }) => fullName));
    const candidates = sourceItems.filter(({ fullName }) => targetFullNames.has(fullName));
    if (candidates.length > 0) {
      filtered[metadataType] = candidates;
    }
  }
  return filtered;
}

type Action =
  | { type: 'FETCH'; payload: { which: OrgType; normalizePermissionXml: boolean } }
  | { type: 'LAST_CHECKED'; payload: { which: OrgType } }
  | {
      type: 'FETCH_SUCCESS';
      payload: { which: OrgType; data: JSZip; fileProperties: FilePropertiesWithContent[]; normalizePermissionXml: boolean };
    }
  | { type: 'FETCH_ERROR'; payload: { which: OrgType; error: string } }
  | { type: 'REBUILD_TREE'; payload: { normalizePermissionXml: boolean } };

interface State {
  sourceLoading: boolean;
  sourceStatus: LoadStatus;
  sourceLastChecked: Date | null;
  sourceResults: JSZip | null;
  sourceResultFiles: FilePropertiesWithContent[] | null;
  sourceError?: string | null;

  targetLoading: boolean;
  targetStatus: LoadStatus;
  targetLastChecked: Date | null;
  targetResults: JSZip | null;
  targetResultFiles: FilePropertiesWithContent[] | null;
  targetError?: string | null;

  files: TreeItems<FileItemMetadata | null>[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH': {
      if (action.payload.which === 'SOURCE') {
        return {
          ...state,
          sourceLoading: true,
          sourceStatus: 'Loading',
          sourceLastChecked: new Date(),
          sourceResults: null,
          sourceError: null,
          targetLoading: false,
          targetStatus: 'Not Started',
          targetResults: null,
          targetResultFiles: null,
        };
      } else {
        let files = state.files;
        // if target org was changed, clear out prior target comparison data
        if (state.targetResults) {
          files = buildTree(state.sourceResultFiles, undefined, { normalizePermissionXml: action.payload.normalizePermissionXml });
        }
        return {
          ...state,
          targetLoading: true,
          targetStatus: 'Loading',
          targetLastChecked: new Date(),
          targetResults: null,
          targetError: null,
          files,
        };
      }
    }
    case 'LAST_CHECKED': {
      if (action.payload.which === 'SOURCE') {
        return {
          ...state,
          sourceLastChecked: new Date(),
        };
      } else {
        return {
          ...state,
          targetLastChecked: new Date(),
        };
      }
    }
    case 'FETCH_SUCCESS': {
      if (action.payload.which === 'SOURCE') {
        return {
          ...state,
          sourceLoading: false,
          sourceStatus: 'Success',
          sourceResults: action.payload.data,
          sourceResultFiles: action.payload.fileProperties,
          files: buildTree(action.payload.fileProperties, state.targetResultFiles, {
            normalizePermissionXml: action.payload.normalizePermissionXml,
          }),
          sourceLastChecked: null,
        };
      } else {
        return {
          ...state,
          targetLoading: false,
          targetStatus: 'Success',
          targetResults: action.payload.data,
          targetResultFiles: action.payload.fileProperties,
          files: buildTree(state.sourceResultFiles, action.payload.fileProperties, {
            normalizePermissionXml: action.payload.normalizePermissionXml,
          }),
          targetLastChecked: null,
        };
      }
    }
    case 'FETCH_ERROR':
      if (action.payload.which === 'SOURCE') {
        return {
          ...state,
          sourceLoading: false,
          sourceStatus: 'Failed',
          sourceError: action.payload.error,
          sourceLastChecked: null,
        };
      } else {
        return {
          ...state,
          targetLoading: false,
          targetStatus: 'Failed',
          targetError: action.payload.error,
          targetLastChecked: null,
        };
      }
    case 'REBUILD_TREE':
      return {
        ...state,
        files: buildTree(state.sourceResultFiles, state.targetResultFiles, {
          normalizePermissionXml: action.payload.normalizePermissionXml,
        }),
      };
    default:
      throw new Error('Invalid action');
  }
}

export interface UseViewOrCompareMetadataOptions {
  selectedMetadata: Record<string, ListMetadataResult[]>;
  normalizePermissionXml?: boolean;
  /**
   * Optional target org listMetadata results. When provided, target retrieves only request
   * components that exist in the target org (candidate set-diff) rather than every selected item.
   */
  targetListMetadata?: Record<string, ListMetadataResult[]> | null;
}

export function useViewOrCompareMetadata({
  selectedMetadata,
  normalizePermissionXml = true,
  targetListMetadata,
}: UseViewOrCompareMetadataOptions) {
  const isMounted = useRef(true);

  const [
    {
      sourceLoading,
      sourceStatus,
      sourceLastChecked,
      sourceResults,
      sourceResultFiles,
      sourceError,
      targetLoading,
      targetStatus,
      targetLastChecked,
      targetResults,
      targetResultFiles,
      targetError,
      files,
    },
    dispatch,
  ] = useReducer(reducer, {
    sourceLoading: false,
    sourceStatus: 'Not Started',
    sourceResults: null,
    sourceResultFiles: null,
    sourceError: null,
    sourceLastChecked: null,
    targetLoading: false,
    targetStatus: 'Not Started',
    targetResults: null,
    targetResultFiles: null,
    targetError: null,
    targetLastChecked: null,
    files: [],
  });
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (sourceResultFiles) {
      dispatch({ type: 'REBUILD_TREE', payload: { normalizePermissionXml } });
    }
  }, [normalizePermissionXml, sourceResultFiles]);

  const fetchMetadata = useCallback(
    async (org: SalesforceOrgUi, which: OrgType) => {
      dispatch({ type: 'FETCH', payload: { which, normalizePermissionXml } });

      try {
        const metadataToRetrieve =
          which === 'TARGET' && targetListMetadata
            ? filterMetadataToTargetCandidates(selectedMetadata, targetListMetadata)
            : selectedMetadata;

        const { zip: salesforcePackage, fileProperties } = await retrieveMetadataChunked(org, metadataToRetrieve, {
          isCanceled: () => !isMounted.current,
          onChecked: () => {
            if (isMounted.current) {
              dispatch({ type: 'LAST_CHECKED', payload: { which } });
            }
          },
        });

        if (isMounted.current) {
          dispatch({
            type: 'FETCH_SUCCESS',
            payload: { which, data: salesforcePackage, fileProperties, normalizePermissionXml },
          });
          notifyUser('Your metadata is ready to view', { tag: 'view-or-compare' });
        }
      } catch (ex) {
        if (!isMounted.current || getErrorMessage(ex) === JOB_CANCELED_ERROR_MESSAGE) {
          return;
        }
        notifyUser('There was an error obtaining metadata', { body: getErrorMessage(ex), tag: 'view-or-compare' });
        dispatch({ type: 'FETCH_ERROR', payload: { which, error: getErrorMessage(ex) } });
      }
    },
    [normalizePermissionXml, notifyUser, selectedMetadata, targetListMetadata],
  );

  return {
    fetchMetadata,
    sourceLoading,
    sourceStatus,
    sourceLastChecked,
    sourceResults,
    sourceResultFiles,
    sourceError,
    targetLoading,
    targetStatus,
    targetLastChecked,
    targetResults,
    targetResultFiles,
    targetError,
    files,
  };
}

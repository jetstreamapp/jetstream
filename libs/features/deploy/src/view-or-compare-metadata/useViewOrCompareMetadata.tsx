import { retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { TreeItems } from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui-core';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { FileItemMetadata, FileListItem, FilePropertiesWithContent, OrgType } from './viewOrCompareMetadataTypes';
import { buildTree, populateFileContents } from './viewOrCompareMetadataUtils';

type LoadStatus = 'Not Started' | 'Loading' | 'Success' | 'Failed';

type Action =
  | { type: 'FETCH'; payload: { which: OrgType } }
  | { type: 'LAST_CHECKED'; payload: { which: OrgType } }
  | { type: 'FETCH_SUCCESS'; payload: { which: OrgType; data: JSZip; fileProperties: FilePropertiesWithContent[] } }
  | { type: 'FETCH_ERROR'; payload: { which: OrgType; error: string } };

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

  // fatalError?: string | null;
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
          targetLoading: false,
          targetStatus: 'Not Started',
          targetResults: null,
          targetResultFiles: null,
        };
      } else {
        let files = state.files;
        // if target org was changed, clear out prior target comparison data
        if (state.targetResults) {
          files = buildTree(state.sourceResultFiles, undefined);
        }
        return {
          ...state,
          targetLoading: true,
          targetStatus: 'Loading',
          targetLastChecked: new Date(),
          targetResults: null,
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
      const files: FileListItem[] = action.payload.fileProperties
        .filter((item) => item.fullName !== 'package.xml')
        .map(
          (meta): FileListItem => ({
            key: meta.fileName,
            heading: meta.fileName,
            meta,
          })
        );
      if (action.payload.which === 'SOURCE') {
        return {
          ...state,
          sourceLoading: false,
          sourceStatus: 'Success',
          sourceResults: action.payload.data,
          sourceResultFiles: action.payload.fileProperties,
          files: buildTree(action.payload.fileProperties, state.targetResultFiles),
          sourceLastChecked: null,
        };
      } else {
        return {
          ...state,
          targetLoading: false,
          targetStatus: 'Success',
          targetResults: action.payload.data,
          targetResultFiles: action.payload.fileProperties,
          files: buildTree(state.sourceResultFiles, action.payload.fileProperties),
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
    default:
      throw new Error('Invalid action');
  }
}

/**
 * Give an org and a changeset name
 * Retrieve and re-deploy the metadata to the org while adding to a changeset
 *
 * @param selectedOrg
 * @param changesetName
 */
export function useViewOrCompareMetadata({ selectedMetadata }: { selectedMetadata: Record<string, ListMetadataResult[]> }) {
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
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const rollbar = useRollbar();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMetadata = useCallback(
    async (org: SalesforceOrgUi, which: OrgType) => {
      dispatch({ type: 'FETCH', payload: { which } });

      try {
        const id = (await retrieveMetadataFromListMetadata(org, selectedMetadata)).id;

        const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
          onChecked: () => {
            if (isMounted.current) {
              dispatch({ type: 'LAST_CHECKED', payload: { which } });
            }
          },
        });

        if (isMounted.current) {
          if (isString(results.zipFile)) {
            const salesforcePackage = await JSZip.loadAsync(results.zipFile, { base64: true });
            await populateFileContents(salesforcePackage, results.fileProperties || []);

            dispatch({ type: 'FETCH_SUCCESS', payload: { which, data: salesforcePackage, fileProperties: results.fileProperties } });
            notifyUser('Your metadata is ready to view', { tag: 'view-or-compare' });
          } else {
            throw new Error(results.errorMessage || 'No data was returned from Salesforce');
          }
        }
      } catch (ex) {
        notifyUser('There was an error obtaining metadata', { body: getErrorMessage(ex), tag: 'view-or-compare' });
        dispatch({ type: 'FETCH_ERROR', payload: { which, error: getErrorMessage(ex) } });
        rollbar.error('Error fetching/comparing metadata', { whichOrg: which, ...getErrorMessageAndStackObj(ex) });
      }
    },
    [notifyUser, rollbar, selectedMetadata]
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

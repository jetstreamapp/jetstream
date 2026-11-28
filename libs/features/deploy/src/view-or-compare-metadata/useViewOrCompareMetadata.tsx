import { JOB_CANCELED_ERROR_MESSAGE } from '@jetstream/shared/constants';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { TreeItems } from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui/app-state';
import { useAtom } from 'jotai';
import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { retrieveMetadataChunked } from './retrieveMetadataChunked';
import { FileItemMetadata, FilePropertiesWithContent, OrgType } from './viewOrCompareMetadataTypes';
import { buildTree } from './viewOrCompareMetadataUtils';

type LoadStatus = 'Not Started' | 'Loading' | 'Success' | 'Failed';

type Action =
  | { type: 'FETCH'; payload: { which: OrgType } }
  | { type: 'LAST_CHECKED'; payload: { which: OrgType } }
  | {
      type: 'FETCH_SUCCESS';
      payload: { which: OrgType; data: JSZip; fileProperties: FilePropertiesWithContent[] };
    }
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
        // The files of a previous target org are cleared so the tree stops showing a comparison with it
        return {
          ...state,
          targetLoading: true,
          targetStatus: 'Loading',
          targetLastChecked: new Date(),
          targetResults: null,
          targetResultFiles: null,
          targetError: null,
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
          sourceLastChecked: null,
        };
      } else {
        return {
          ...state,
          targetLoading: false,
          targetStatus: 'Success',
          targetResults: action.payload.data,
          targetResultFiles: action.payload.fileProperties,
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

export interface UseViewOrCompareMetadataOptions {
  selectedMetadata: Record<string, ListMetadataResult[]>;
  normalizePermissionXml?: boolean;
}

export function useViewOrCompareMetadata({ selectedMetadata, normalizePermissionXml = true }: UseViewOrCompareMetadataOptions) {
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
  });
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const files = useMemo<TreeItems<FileItemMetadata | null>[]>(
    () => (sourceResultFiles ? buildTree(sourceResultFiles, targetResultFiles, { normalizePermissionXml }) : []),
    [normalizePermissionXml, sourceResultFiles, targetResultFiles],
  );

  const fetchMetadata = useCallback(
    async (org: SalesforceOrgUi, which: OrgType) => {
      dispatch({ type: 'FETCH', payload: { which } });

      try {
        const { zip: salesforcePackage, fileProperties } = await retrieveMetadataChunked(org, selectedMetadata, {
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
            payload: { which, data: salesforcePackage, fileProperties },
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
    [notifyUser, selectedMetadata],
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

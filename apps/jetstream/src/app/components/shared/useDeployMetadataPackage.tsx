import { logger } from '@jetstream/shared/client-logger';
import { deployMetadataZip } from '@jetstream/shared/data';
import { pollMetadataResultsUntilDone, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import { getSuccessOrFailureChar, pluralizeFromNumber } from '@jetstream/shared/utils';
import { DeployOptions, DeployResult, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

/**
 *
 * NOTICE
 * THIS FILE IS COPIED FROM DEPLOYMENT VERBATIM
 * THIS SHOULD OR COULD BE MOVED SOMEWHERE MORE GENERIC
 * I REMOVED STATUS
 *
 * the other version relies ON applicationCookieState, SO INSTEAD WE MAY NEED TO PASS IN serverUrl
 *
 */

function getNotificationMessageBody(deployResults: DeployResult) {
  const { numberComponentErrors, numberComponentsDeployed, numberTestsCompleted, runTestsEnabled, details, success } = deployResults;
  let { numberTestErrors } = deployResults;
  numberTestErrors = numberTestErrors ?? 0;
  numberTestErrors = numberTestErrors + (details?.runTestResult?.codeCoverageWarnings?.length || 0);
  let output = '';
  if (success) {
    output += `${getSuccessOrFailureChar(
      'success',
      numberComponentsDeployed
    )} ${numberComponentsDeployed.toLocaleString()} ${pluralizeFromNumber('item', numberComponentsDeployed)} deployed successfully.`;
    if (runTestsEnabled) {
      output += ` ${getSuccessOrFailureChar(
        'success',
        numberTestsCompleted
      )} ${numberTestsCompleted.toLocaleString()} unit tests succeeded.`;
    }
  } else {
    if (numberComponentErrors > 0) {
      output += `${getSuccessOrFailureChar(
        'failure',
        numberComponentErrors
      )} ${numberComponentErrors.toLocaleString()} of ${numberComponentsDeployed.toLocaleString()} items failed to deploy.`;
    }
    if (runTestsEnabled) {
      output += ` ${getSuccessOrFailureChar(
        'failure',
        numberTestErrors
      )} ${numberTestErrors.toLocaleString()} of ${numberTestsCompleted.toLocaleString()} unit tests failed.`;
    }
  }
  return output;
}

type Action =
  | { type: 'UPLOAD' }
  | { type: 'DEPLOY_IN_PROG'; payload: { deployId: string; results?: DeployResult } }
  | { type: 'SUCCESS'; payload?: { results: DeployResult } }
  | { type: 'ERROR'; payload?: { errorMessage: string } };

interface State {
  hasLoaded: boolean;
  loading: boolean;
  hasError: boolean;
  errorMessage?: string | null;
  deployId: Maybe<string>;
  results: Maybe<DeployResult>;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UPLOAD':
      return {
        ...state,
        hasLoaded: true,
        loading: true,
        hasError: false,
        errorMessage: null,
        deployId: null,
        results: null,
      };
    case 'DEPLOY_IN_PROG':
      return { ...state, deployId: action.payload.deployId, results: action.payload.results };
    case 'SUCCESS':
      return { ...state, loading: false, results: action.payload?.results };
    case 'ERROR':
      return { ...state, loading: false, hasError: true, errorMessage: action.payload?.errorMessage, results: null };
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
export function useDeployMetadataPackage(serverUrl: string, onFinished?: () => void) {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [{ hasLoaded, loading, hasError, errorMessage, deployId, results }, dispatch] = useReducer(reducer, {
    hasLoaded: false,
    loading: false,
    hasError: false,
    deployId: null,
    results: null,
  });
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const deployMetadata = useCallback(
    async (org: SalesforceOrgUi, file: ArrayBuffer, deployOptions: DeployOptions) => {
      try {
        dispatch({ type: 'UPLOAD' });
        const { id } = await deployMetadataZip(org, file, deployOptions);

        if (isMounted.current) {
          dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: id } });
          const results = await pollMetadataResultsUntilDone(org, id, {
            includeDetails: true,
            onChecked: (results) => {
              dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: id, results } });
              setLastChecked(new Date());
            },
          });
          dispatch({ type: 'SUCCESS', payload: { results } });
          onFinished?.();
          if (results.success) {
            notifyUser(`Deployment finished successfully`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-package',
            });
          } else {
            notifyUser(`Deployment failed`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-package',
            });
          }
          return results;
        }
      } catch (ex) {
        logger.warn('[useDeployMetadataPackage][ERROR]', ex.message);
        rollbar.error('Problem deploying custom metadata', { message: ex.message, stack: ex.stack, deployOptions });
        if (isMounted.current) {
          dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
        }
      }
    },
    [notifyUser, onFinished, rollbar]
  );

  return { deployMetadata, results, deployId, hasLoaded, loading, lastChecked, hasError, errorMessage };
}

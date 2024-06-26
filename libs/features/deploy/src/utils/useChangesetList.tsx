import { logger } from '@jetstream/shared/client-logger';
import { getChangesetsFromDomParse, useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ChangeSet, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef } from 'react';

export function useChangesetList(selectedOrg: SalesforceOrgUi, initialPackages?: Maybe<ListItem<string, ChangeSet>[]>) {
  const isMounted = useRef(true);

  const [{ hasLoaded, loading, data, hasError, errorMessage }, dispatch] = useReducer(useReducerFetchFn<ListItem<string, ChangeSet>[]>(), {
    hasLoaded: !!initialPackages,
    loading: false,
    hasError: false,
    data: initialPackages || [],
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      dispatch({ type: 'REQUEST', payload: [] });
      const changesets = await getChangesetsFromDomParse(selectedOrg);

      logger.log({ changesets });

      if (isMounted.current) {
        dispatch({ type: 'SUCCESS', payload: getListItemFromChangesets(changesets) });
      }
    } catch (ex) {
      logger.warn('[useChangesetList][ERROR]', getErrorMessage(ex));
      if (isMounted.current) {
        dispatch({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
      }
    }
  }, [selectedOrg]);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg && !hasLoaded) {
      loadPackages();
    }
  }, [selectedOrg, hasLoaded, loadPackages]);

  return { loadPackages, loading, changesetPackages: data, hasError, errorMessage };
}

function getListItemFromChangesets(records: ChangeSet[]) {
  return records.map((changesetPackage): ListItem<string, ChangeSet> => {
    return {
      id: changesetPackage.name,
      label: changesetPackage.name,
      secondaryLabel: changesetPackage.description,
      secondaryLabelOnNewLine: true,
      value: changesetPackage.name,
      meta: changesetPackage,
      title: changesetPackage.description,
    };
  });
}

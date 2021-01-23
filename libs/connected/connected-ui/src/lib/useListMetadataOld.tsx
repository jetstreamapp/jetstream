/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, listMetadata as listMetadataApi } from '@jetstream/shared/data';
import { useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import formatRelative from 'date-fns/formatRelative';
import { ListMetadataQuery } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';

let _lastRefreshed: string;

// TODO: we should use this to ensure data types? Or the server could own the transformations?
const defaultTransformFn = (item: ListMetadataResult) => item;

function decodeFullNameAndApplyTransform(item: ListMetadataResult, additionalTransform: (item: ListMetadataResult) => ListMetadataResult) {
  return additionalTransform({ ...item, fullName: decodeURIComponent(item.fullName) });
}

export function useListMetadata(
  selectedOrg: SalesforceOrgUi,
  types: ListMetadataQuery[],
  loadOnInit = true,
  initialItems?: ListMetadataResult[],
  transformItems?: (item: ListMetadataResult) => ListMetadataResult
) {
  const isMounted = useRef(null);
  const rollbar = useRollbar();
  const [listMetadataItems, setListMetadataItems] = useState<ListMetadataResult[]>(initialItems);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [orgIdUsedToFetch, setOrgIdUsedToFetch] = useState<string>();

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useNonInitialEffect(() => {
    if (lastRefreshed) {
      _lastRefreshed = lastRefreshed;
    }
  }, [lastRefreshed]);

  useEffect(() => {
    if (selectedOrg && hasLoaded && selectedOrg.uniqueId !== orgIdUsedToFetch) {
      setHasLoaded(false);
      setListMetadataItems(undefined);
    }
  }, [hasLoaded, orgIdUsedToFetch, selectedOrg]);

  const loadListMetadata = useCallback(
    async (clearCache = false) => {
      if (!selectedOrg || !types?.length) {
        return;
      }
      const uniqueId = selectedOrg.uniqueId;
      if (orgIdUsedToFetch !== uniqueId) {
        setOrgIdUsedToFetch(uniqueId);
      }
      setHasLoaded(true);
      try {
        setLoading(true);
        if (hasError) {
          setHasError(false);
          setErrorMessage(null);
        }

        if (clearCache) {
          clearCacheForOrg(selectedOrg);
        }
        // TODO: create queue here
        // only supports 3 types, we should queue using 1 or 2 or 3 types and make as many calls as required

        const resultsWithCache = await listMetadataApi(selectedOrg, types);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
          return;
        }

        if (resultsWithCache.cache) {
          const cache = resultsWithCache.cache;
          setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
        }
        setListMetadataItems(
          orderObjectsBy(
            resultsWithCache.data.map((item) => decodeFullNameAndApplyTransform(item, transformItems || defaultTransformFn)),
            'fullName'
          )
        );
      } catch (ex) {
        logger.error(ex);
        rollbar.error('List Metadata Failed', ex);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
          return;
        }
        setHasError(true);
        setErrorMessage(ex.message);
      }
      setLoading(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selectedOrg]
  );

  useEffect(() => {
    if (loadOnInit && selectedOrg && (!listMetadataItems || !listMetadataItems.length) && !hasLoaded) {
      loadListMetadata();
    }
  }, [selectedOrg, hasLoaded, loadOnInit, listMetadataItems, loadListMetadata]);

  return {
    loadListMetadata,
    loading,
    hasError,
    errorMessage,
    listMetadataItems,
    lastRefreshed,
  };
}

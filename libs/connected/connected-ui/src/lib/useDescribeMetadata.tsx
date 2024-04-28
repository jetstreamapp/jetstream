import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, describeMetadata as describeMetadataApi } from '@jetstream/shared/data';
import { useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { orderValues } from '@jetstream/shared/utils';
import { DescribeMetadataResult, MetadataObject, SalesforceOrgUi } from '@jetstream/types';
import { formatRelative } from 'date-fns/formatRelative';
import { useCallback, useEffect, useRef, useState } from 'react';
import { METADATA_TYPES_TO_OMIT } from './utils';

let _lastRefreshed: string;

export function useDescribeMetadata(
  selectedOrg: SalesforceOrgUi,
  initialItems?: string[],
  initialMetadataItemMap?: Record<string, MetadataObject>,
  loadOnInit = true
) {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  // map of each item or child item to parent item
  const [metadataItemMap, setMetadataItemMap] = useState<Record<string, MetadataObject>>(initialMetadataItemMap || {});
  const [metadataItems, setMetadataItems] = useState<string[] | undefined>(initialItems);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [orgInformation, setOrgInformation] = useState<Omit<DescribeMetadataResult, 'metadataObjects'> | null>(null);
  const [orgIdUsedToFetch, setOrgIdUsedToFetch] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    if (lastRefreshed) {
      _lastRefreshed = lastRefreshed;
    }
  }, [lastRefreshed]);

  // if org changes, reset everything
  // a different effect will handle re-loading data if loadOnInit
  useNonInitialEffect(() => {
    setHasLoaded(false);
    setMetadataItemMap({});
    setMetadataItems(undefined);
  }, [selectedOrg.uniqueId]);

  const loadDescribeMetadata = useCallback(
    async (clearCache = false) => {
      if (!selectedOrg) {
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
        const { data, cache } = await describeMetadataApi(selectedOrg);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
          return;
        }

        if (cache) {
          setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
        }
        setOrgInformation({
          organizationNamespace: data.organizationNamespace,
          partialSaveAllowed: data.partialSaveAllowed,
          testRequired: data.testRequired,
        });

        const { items, itemMap } = data.metadataObjects
          .filter((item) => !!item)
          .reduce(
            (output: { items: string[]; itemMap: Record<string, MetadataObject> }, item) => {
              // map parent item
              output.items.push(item.xmlName);
              output.itemMap[item.xmlName] = item;
              // map child items
              if (Array.isArray(item.childXmlNames) && item.childXmlNames.length > 0) {
                item.childXmlNames.forEach((childItem) => {
                  output.items.push(childItem);
                  output.itemMap[childItem] = {
                    xmlName: childItem,
                    inFolder: false,
                  };
                });
              }
              return output;
            },
            {
              items: [],
              itemMap: {},
            }
          );

        setMetadataItemMap(itemMap);
        setMetadataItems(orderValues(items.filter((item) => !METADATA_TYPES_TO_OMIT.has(item))));
      } catch (ex) {
        logger.error(ex);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
          return;
        }
        setHasError(true);
        setErrorMessage(ex.message);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg]
  );

  useEffect(() => {
    // automatically load metadata if required
    // This is only called if loadOnInit=true and metadataItems has not been set
    if (loadOnInit && selectedOrg && (!metadataItems || !metadataItems.length) && !hasLoaded) {
      loadDescribeMetadata();
    }
  }, [selectedOrg, hasLoaded, metadataItems, loadOnInit, loadDescribeMetadata]);

  return {
    loadDescribeMetadata,
    loading,
    hasError,
    errorMessage,
    metadataItemMap,
    metadataItems,
    orgInformation,
    lastRefreshed,
  };
}

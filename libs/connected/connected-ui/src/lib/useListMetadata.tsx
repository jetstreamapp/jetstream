import { logger } from '@jetstream/shared/client-logger';
import { listMetadata as listMetadataApi } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getMapOf, orderObjectsBy, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import formatRelative from 'date-fns/formatRelative';
import { ListMetadataQuery } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_listmetadata.htm

// The queries array can contain up to three ListMetadataQuery queries for each call
const MAX_FOLDER_REQUESTS = 3;

export interface ListMetadataQueryExtended extends ListMetadataQuery {
  inFolder?: boolean;
}

export interface ListMetadataResultItem {
  type: string;
  folder: string;
  inFolder: boolean;
  loading: boolean;
  error: boolean;
  lastRefreshed: string | null;
  items: ListMetadataResult[];
}

// helper method
async function fetchListMetadata(
  selectedOrg: SalesforceOrgUi,
  item: ListMetadataResultItem,
  skipRequestCache = false,
  skipCacheIfOlderThan?: number
): Promise<ListMetadataResultItem> {
  const { type, folder } = item;
  const { data: items, cache } = await listMetadataApi(selectedOrg, [{ type, folder }], skipRequestCache, skipCacheIfOlderThan);
  return {
    ...item,
    items: orderObjectsBy(items, 'fullName'),
    loading: false,
    lastRefreshed: cache ? `Last updated ${formatRelative(cache.age, new Date())}` : null,
  };
}

/**
 * Recursively fetch all metadata inside all unmanaged folders
 *
 * Used when inFolder=true (Dashboard, Document, Email, Report)
 *
 * https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_folder.htm
 *
 * @param selectedOrg
 * @param item
 * @param filterFn
 * @param skipRequestCache
 */
async function fetchListMetadataForItemsInFolder(
  selectedOrg: SalesforceOrgUi,
  item: ListMetadataResultItem,
  skipRequestCache = false,
  skipCacheIfOlderThan?: number
): Promise<ListMetadataResultItem> {
  const { type } = item;
  const typeWithFolder = type === 'EmailTemplate' ? 'EmailFolder' : `${type}Folder`;
  let outputItems: ListMetadataResult[] = [];
  // get list of folders
  const { data, cache } = await listMetadataApi(
    selectedOrg,
    [{ type: typeWithFolder, folder: null }],
    skipRequestCache,
    skipCacheIfOlderThan
  );

  // we need to fetch for each folder, split into sets of 3
  const folderItems = splitArrayToMaxSize(
    data.filter((folder) => folder.manageableState === 'unmanaged'),
    MAX_FOLDER_REQUESTS
  );

  for (const currFolderItem of folderItems) {
    if (currFolderItem.length) {
      const { data: items, cache } = await listMetadataApi(
        selectedOrg,
        currFolderItem.map(({ fullName }) => ({ type, folder: fullName })),
        skipRequestCache
      );
      outputItems = outputItems.concat(items);
    }
  }

  return {
    ...item,
    items: orderObjectsBy(outputItems, 'fullName'),
    loading: false,
    lastRefreshed: cache ? `Last updated ${formatRelative(cache.age, new Date())}` : null,
  };
}

function defaultFilterFn(item: ListMetadataResult) {
  return true;
}

/**
 * Hook to call ListMetadata
 * This will make 1 api call per type (or more if folders)
 *
 * This will NOT automatically make api calls
 * loadListMetadata() must be invoked manually
 *
 * @param selectedOrg
 * @param types
 */
export function useListMetadata(selectedOrg: SalesforceOrgUi) {
  const isMounted = useRef(null);
  const rollbar = useRollbar();
  const [listMetadataItems, setListMetadataItems] = useState<MapOf<ListMetadataResultItem>>();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [initialLoadFinished, setInitialLoadFinished] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Load metadata metadata for items
   *
   * @param options.metadataToRetain - If provided, these items will not be re-fetched
   * @param options.skipRequestCache - If true, then the items will be re-fetched without using the cache
   * @param options.skipCacheIfOlderThan - If provided (ms), then skip the cache if the cache is older than this date
   *
   */
  const loadListMetadata = useCallback(
    async (
      types: ListMetadataQueryExtended[],
      options: {
        metadataToRetain?: MapOf<ListMetadataResultItem>;
        skipRequestCache?: boolean;
        skipCacheIfOlderThan?: number;
      } = {}
    ) => {
      if (!selectedOrg || !types?.length) {
        return;
      }

      options = options || {};
      const metadataToRetain = options.metadataToRetain;
      const skipRequestCache = options.skipRequestCache ?? false;
      const skipCacheIfOlderThan = options.skipCacheIfOlderThan;

      try {
        setLoading(true);
        if (hasError) {
          setHasError(false);
        }

        let itemsToProcess = types.map(
          ({ type, folder, inFolder }): ListMetadataResultItem => ({
            type,
            folder,
            inFolder,
            loading: true,
            error: null,
            lastRefreshed: null,
            items: [],
          })
        );

        const newMetadataItems = getMapOf(itemsToProcess, 'type');

        /**
         * If keep if existing flag is set
         * then do not re-fetch metadata for existing types
         * types[] still determines which items are retained, so existing items may be omitted
         * (e.x. user unchecked)
         */
        if (metadataToRetain) {
          const existingMetadataTypes = new Set();
          Object.keys(metadataToRetain).forEach((existingItemKey) => {
            if (newMetadataItems[existingItemKey]) {
              existingMetadataTypes.add(existingItemKey);
              // replace new item with existing item
              newMetadataItems[existingItemKey] = metadataToRetain[existingItemKey];
            }
          });
          // if exists, do not re-fetch
          itemsToProcess = itemsToProcess.filter(({ type }) => !existingMetadataTypes.has(type));
        }

        setListMetadataItems(newMetadataItems);

        // tried queue, but hit a stupid error - we may want a queue in the future for parallel requests
        for (const item of itemsToProcess) {
          const { type, inFolder, folder, loading, error, items } = item;
          try {
            let responseItem: ListMetadataResultItem;
            if (inFolder) {
              // handle additional fetches required if type is in folder
              responseItem = await fetchListMetadataForItemsInFolder(selectedOrg, item, skipRequestCache, skipCacheIfOlderThan);
            } else {
              responseItem = await fetchListMetadata(selectedOrg, item, skipRequestCache, skipCacheIfOlderThan);
            }

            if (!isMounted.current) {
              break;
            }
            setListMetadataItems((previousItems) => ({ ...previousItems, [type]: responseItem }));
          } catch (ex) {
            logger.error(ex);
            rollbar.error('List Metadata Failed for item', ex);
            if (!isMounted.current) {
              break;
            }
            setListMetadataItems((previousItems) => ({
              ...previousItems,
              [type]: { ...previousItems[type], loading: false, error: true, items: [], lastRefreshed: null },
            }));
          }
        }

        if (!isMounted.current) {
          return;
        }
        setInitialLoadFinished(true);
      } catch (ex) {
        logger.error(ex);
        rollbar.error('List Metadata Failed', ex);
        if (!isMounted.current) {
          return;
        }
        setHasError(false);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg]
  );

  /**
   * Load / Reload metadata just for one item
   * Used to allow user to refresh just one item
   * or retry if there was an error
   */
  const loadListMetadataItem = useCallback(
    async (item: ListMetadataResultItem) => {
      const { type } = item;
      try {
        setListMetadataItems((previousItems) => ({
          ...previousItems,
          [type]: { ...previousItems[type], loading: true, error: false, items: [], lastRefreshed: null },
        }));
        const responseItem = await fetchListMetadata(selectedOrg, item, true);
        if (!isMounted.current) {
          return;
        }
        setListMetadataItems((previousItems) => ({ ...previousItems, [type]: responseItem }));
      } catch (ex) {
        if (!isMounted.current) {
          return;
        }
        setListMetadataItems((previousItems) => ({
          ...previousItems,
          [type]: { ...previousItems[type], loading: false, error: true, items: [], lastRefreshed: null },
        }));
      }
    },
    [selectedOrg]
  );

  return {
    loadListMetadata,
    loadListMetadataItem,
    loading,
    listMetadataItems,
    initialLoadFinished,
    hasError,
  };
}

/** @jsx jsx */
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
  filterFn: (item: ListMetadataResult) => boolean,
  skipRequestCache = false
): Promise<ListMetadataResultItem> {
  const { type, folder } = item;
  const { data: items, cache } = await listMetadataApi(selectedOrg, [{ type, folder }], skipRequestCache);
  return {
    ...item,
    items: orderObjectsBy(items.filter(filterFn), 'fullName'),
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
  filterFn: (item: ListMetadataResult) => boolean,
  skipRequestCache = false
): Promise<ListMetadataResultItem> {
  const { type } = item;
  let outputItems: ListMetadataResult[] = [];
  // get list of folders
  const { data, cache } = await listMetadataApi(selectedOrg, [{ type: `${type}Folder`, folder: null }], skipRequestCache);

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
    items: outputItems.filter(filterFn),
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

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const loadListMetadata = useCallback(
    async (
      types: ListMetadataQueryExtended[],
      filterFn: (item: ListMetadataResult) => boolean = defaultFilterFn,
      skipRequestCache = false
    ) => {
      if (!selectedOrg || !types?.length) {
        return;
      }
      try {
        setLoading(true);
        if (hasError) {
          setHasError(false);
        }

        const itemsToProcess = types.map(
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

        setListMetadataItems(getMapOf(itemsToProcess, 'type'));

        // tried queue, but hit a stupid error - we may want a queue in the future for parallel requests
        for (const item of itemsToProcess) {
          const { type, inFolder, folder, loading, error, items } = item;
          try {
            let responseItem: ListMetadataResultItem;
            if (inFolder) {
              // handle additional fetches required if type is in folder
              responseItem = await fetchListMetadataForItemsInFolder(selectedOrg, item, filterFn, skipRequestCache);
            } else {
              responseItem = await fetchListMetadata(selectedOrg, item, filterFn, skipRequestCache);
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
    async (item: ListMetadataResultItem, filterFn: (item: ListMetadataResult) => boolean = defaultFilterFn) => {
      const { type } = item;
      try {
        setListMetadataItems((previousItems) => ({
          ...previousItems,
          [type]: { ...previousItems[type], loading: true, error: false, items: [], lastRefreshed: null },
        }));
        const responseItem = await fetchListMetadata(selectedOrg, item, filterFn, true);
        if (!isMounted.current) {
          return;
        }
        setListMetadataItems((previousItems) => ({ ...previousItems, [type]: responseItem }));
      } catch (ex) {
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
    hasError,
  };
}

import { logger } from '@jetstream/shared/client-logger';
import { METADATA_TYPES_WITH_NESTED_FOLDERS } from '@jetstream/shared/constants';
import { listMetadata as listMetadataApi, queryAll, queryWithCache } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { groupByFlat, orderObjectsBy, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataQuery, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { formatRelative } from 'date-fns/formatRelative';
import uniqWith from 'lodash/uniqWith';
import { useCallback, useEffect, useRef, useState } from 'react';

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_listmetadata.htm

// The queries array can contain up to three ListMetadataQuery queries for each call
const MAX_FOLDER_REQUESTS = 3;

export interface ListMetadataQueryExtended extends ListMetadataQuery {
  inFolder?: boolean;
}

export interface ListMetadataResultItem {
  type: string;
  folder?: string | null;
  inFolder: boolean;
  loading: boolean;
  error: boolean | null;
  lastRefreshed: string | null;
  items: ListMetadataResult[];
}

interface FolderRecord {
  Id: string;
  DeveloperName: string;
  ParentId: string | null;
  Type:
    | 'Document'
    | 'Email'
    | 'Report'
    | 'Dashboard'
    | 'QuickText'
    | 'Macro'
    | 'EmailTemplate'
    | 'ActionCadence'
    | 'AnalyticAssetCollection';
}

const getFolderSoqlQuery = (type: string) => {
  return `SELECT Id, DeveloperName, ParentId, Type FROM Folder WHERE type = '${type}' ORDER BY Type, ParentId NULLS FIRST`;
};

const getPersonTypeSoqlQuery = () => {
  return `SELECT DeveloperName, SobjectType FROM RecordType WHERE IsPersonType = TRUE`;
};

// helper method
async function fetchListMetadata(
  selectedOrg: SalesforceOrgUi,
  item: ListMetadataResultItem,
  skipRequestCache = false,
  skipCacheIfOlderThan?: number,
): Promise<ListMetadataResultItem> {
  const { type, folder } = item;
  // eslint-disable-next-line prefer-const
  let { data: items, cache } = await listMetadataApi(
    selectedOrg,
    [{ type, folder: folder || undefined }],
    skipRequestCache,
    skipCacheIfOlderThan,
  );

  /**
   * Special handling for PersonAccount record types to work around Salesforce nuance
   * The fullName is incorrect for PersonAccount record types, they show up under the `Account.` prefix
   */
  if (item.type === 'RecordType') {
    try {
      // Fetch all person account record types
      const personAccountRecordTypes = await queryWithCache<{ DeveloperName: string; SobjectType: string }>(
        selectedOrg,
        getPersonTypeSoqlQuery(),
      ).then((results) => results.data.queryResults.records);

      if (personAccountRecordTypes.length > 0) {
        const personAccountsWithFullName = personAccountRecordTypes.map((record) => ({
          ...record,
          fullName: `${record.SobjectType}.${record.DeveloperName}`,
        }));
        const recordTypesByFullName = groupByFlat(personAccountsWithFullName, 'fullName');
        // Replace fullName prefix "Account" with "PersonAccount"
        items = items.map((listMetadataItem) => {
          const personAccountRecordType = recordTypesByFullName[listMetadataItem.fullName];
          if (listMetadataItem.type !== 'RecordType' || !personAccountRecordType) {
            return listMetadataItem;
          }
          return { ...listMetadataItem, fullName: `PersonAccount.${personAccountRecordType.DeveloperName}` };
        });
      }
    } catch (ex) {
      // IsPersonType is only available in orgs where this feature is enabled - so if it fails we don't need to monkey-patch
      logger.error('Error monkey-patching PersonAccount record types', ex);
    }
  }

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
 * Used when inFolder=true (Dashboard, Document, Email/EmailTemplate, Report)
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
  skipCacheIfOlderThan?: number,
): Promise<ListMetadataResultItem> {
  const { type } = item;
  const typeWithFolder = type === 'EmailTemplate' ? ['EmailFolder', 'EmailTemplateFolder'] : [`${type}Folder`];
  let outputItems: ListMetadataResult[] = [];
  // get list of folders
  const { data, cache } = await listMetadataApi(
    selectedOrg,
    typeWithFolder.map((folderType): ListMetadataQuery => ({ type: folderType })),
    skipRequestCache,
    skipCacheIfOlderThan,
  );

  /**
   * Some metadata types can have nested folders, but metadata returned does not include the full path of the folder
   * This generally works to download, but the fullName in package.xml would be incorrect and trying to re-upload the data would fail
   *
   * To get around this, we query all folders and figure out the full path for each folder and replace the fullName with the full path
   *
   * @example {'SubSubFolder2': 'RootFolder/SubFolder1/SubSubFolder2'}
   */
  let foldersByPath: Record<string, string> = {};
  if (METADATA_TYPES_WITH_NESTED_FOLDERS.has(type)) {
    foldersByPath = await getFullFolderPathByFolderDeveloperName(selectedOrg, type);
  }

  // we need to fetch for each folder, split into sets of 3
  const folderFullNames = data.filter((folder) => folder.manageableState === 'unmanaged').map(({ fullName }) => fullName);
  const folderItems = splitArrayToMaxSize(folderFullNames, MAX_FOLDER_REQUESTS);

  for (const currFolderItem of folderItems) {
    if (currFolderItem.length) {
      const { data: items } = await listMetadataApi(
        selectedOrg,
        currFolderItem.map((folder) => ({ type, folder })),
        skipRequestCache,
      );

      // replace fullName with full path for reports
      // this ensues exports properly include the correct filePath
      if (METADATA_TYPES_WITH_NESTED_FOLDERS.has(type)) {
        items.forEach((item) => {
          const [folder, name] = item.fullName.split('/');
          if (folder && name && foldersByPath[folder]) {
            item.fullName = `${foldersByPath[folder]}/${name}`;
          }
        });
      }

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

/**
 * Folders need to include their full folder path and must end with "/" so the API knows they are a folder
 * and not a metadata item.
 *
 * Reference: https://github.com/forcedotcom/source-deploy-retrieve/commit/4d35ce333d59ec18ac9fe3ca730dbd2dd34f06ff
 *
 */
export async function mutateFullNameForFolderToIncludeFullPath(selectedOrg: SalesforceOrgUi, responseItem: ListMetadataResultItem) {
  if (!responseItem || !responseItem.items || !responseItem.type.endsWith('Folder')) {
    return;
  }
  const folderType = responseItem.type.replace(/Folder$/, '');
  const foldersByPath = await getFullFolderPathByFolderDeveloperName(selectedOrg, folderType);

  responseItem.items.forEach((item) => {
    if (foldersByPath[item.fullName] && foldersByPath[item.fullName] !== item.fullName) {
      item.fullName = foldersByPath[item.fullName];
    }
    if (!item.fullName.endsWith('/')) {
      item.fullName += '/';
    }
  });
}

export async function getFullFolderPathByFolderDeveloperName(
  selectedOrg: SalesforceOrgUi,
  // Types are listed here mostly for documentation purposes
  type:
    | 'Document'
    | 'Email'
    | 'Report'
    | 'Dashboard'
    | 'QuickText'
    | 'Macro'
    | 'EmailTemplate'
    | 'ActionCadence'
    | 'Capstone'
    | 'AnalyticAssetCollection'
    | string,
) {
  const foldersByPath: Record<string, string> = {};
  const reportFolders = await queryAll<FolderRecord>(selectedOrg, getFolderSoqlQuery(type));
  const foldersById = groupByFlat(reportFolders.queryResults.records, 'Id');

  reportFolders.queryResults.records.reduce((foldersByPath, folder) => {
    const { DeveloperName, ParentId } = folder;

    if (!ParentId) {
      foldersByPath[DeveloperName] = DeveloperName;
    } else if (foldersById[ParentId]?.DeveloperName) {
      const parentFolder = foldersById[ParentId];
      const parentPath = foldersByPath[parentFolder.DeveloperName];
      foldersByPath[DeveloperName] = `${parentPath}/${DeveloperName}`;
    } else {
      logger.warn('[ERROR] Could not find parent folder for folder', folder);
    }
    return foldersByPath;
  }, foldersByPath);

  return foldersByPath;
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
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [listMetadataItems, setListMetadataItems] = useState<Record<string, ListMetadataResultItem>>();
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
        metadataToRetain?: Record<string, ListMetadataResultItem>;
        skipRequestCache?: boolean;
        skipCacheIfOlderThan?: number;
      } = {},
    ) => {
      if (!selectedOrg?.uniqueId || !types?.length) {
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
            inFolder: inFolder ?? false,
            loading: true,
            error: null,
            lastRefreshed: null,
            items: [],
          }),
        );

        const newMetadataItems = groupByFlat(itemsToProcess, 'type');

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

        for (const item of itemsToProcess) {
          const { type, inFolder } = item;
          try {
            let responseItem: ListMetadataResultItem;
            if (inFolder) {
              // handle additional fetches required if type is in folder
              responseItem = await fetchListMetadataForItemsInFolder(selectedOrg, item, skipRequestCache, skipCacheIfOlderThan);
            } else {
              responseItem = await fetchListMetadata(selectedOrg, item, skipRequestCache, skipCacheIfOlderThan);
            }

            // Ensure nested folders have the full path in their name
            if (item.type.endsWith('Folder')) {
              await mutateFullNameForFolderToIncludeFullPath(selectedOrg, responseItem);
            }

            // Some sobjects are in the list twice (Salesforce bug - specifically Account shows up twice)
            if (responseItem?.items) {
              responseItem.items = uniqWith(
                responseItem.items,
                (currValue, otherValue) => `${currValue.type}:${currValue.fullName}` === `${otherValue.type}:${otherValue.fullName}`,
              );
            }

            if (!isMounted.current) {
              break;
            }
            setListMetadataItems((previousItems) => ({ ...previousItems, [type]: responseItem }));
          } catch (ex) {
            logger.error(ex);
            if (!isMounted.current) {
              break;
            }
            setListMetadataItems((previousItems) =>
              previousItems && previousItems[type]
                ? {
                    ...previousItems,
                    [type]: { ...previousItems[type], loading: false, error: true, items: [], lastRefreshed: null },
                  }
                : previousItems,
            );
          }
        }

        if (!isMounted.current) {
          return;
        }
        setInitialLoadFinished(true);
      } catch (ex) {
        logger.error(ex);
        rollbar.error('List Metadata Failed', { message: ex.message, stack: ex.stack });
        if (!isMounted.current) {
          return;
        }
        setHasError(false);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg],
  );

  /**
   * Load / Reload metadata just for one item
   * Used to allow user to refresh just one item
   * or retry if there was an error
   */
  const loadListMetadataItem = useCallback(
    async (item: ListMetadataResultItem) => {
      const { type, inFolder } = item;
      try {
        setListMetadataItems((previousItems) =>
          previousItems && previousItems[type]
            ? {
                ...previousItems,
                [type]: { ...previousItems[type], loading: true, error: false, items: [], lastRefreshed: null },
              }
            : previousItems,
        );

        let responseItem = await fetchListMetadata(selectedOrg, item, true);
        if (inFolder) {
          // handle additional fetches required if type is in folder
          responseItem = await fetchListMetadataForItemsInFolder(selectedOrg, item, true);
        } else {
          responseItem = await fetchListMetadata(selectedOrg, item, true);
        }

        // Ensure nested folders have the full path in their name
        if (item.type.endsWith('Folder')) {
          await mutateFullNameForFolderToIncludeFullPath(selectedOrg, responseItem);
        }

        if (!isMounted.current) {
          return;
        }
        setListMetadataItems((previousItems) => ({ ...previousItems, [type]: responseItem }));
      } catch (ex) {
        if (!isMounted.current) {
          return;
        }
        setListMetadataItems((previousItems) =>
          previousItems && previousItems[type]
            ? {
                ...previousItems,
                [type]: { ...previousItems[type], loading: false, error: true, items: [], lastRefreshed: null },
              }
            : previousItems,
        );
      }
    },
    [selectedOrg],
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

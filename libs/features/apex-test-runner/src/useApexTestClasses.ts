import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { getLocalStore } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApexClassManifest, fetchSymbolTables } from './apex-test-runner-data.utils';
import { distillSymbolTable } from './apex-test-runner-symbol-table.utils';
import type { ApexClassCache, TestClassListItem } from './apex-test-runner-types';

function getCacheKey(org: SalesforceOrgUi) {
  return `${INDEXED_DB.KEYS.apexTestClassCache}:${org.uniqueId}`;
}

async function readCache(org: SalesforceOrgUi): Promise<ApexClassCache> {
  try {
    return (await getLocalStore().getItem<ApexClassCache>(getCacheKey(org))) ?? {};
  } catch (ex) {
    logger.warn('[APEX TESTS] Unable to read class cache', ex);
    return {};
  }
}

async function writeCache(org: SalesforceOrgUi, cache: ApexClassCache) {
  try {
    await getLocalStore().setItem(getCacheKey(org), cache);
  } catch (ex) {
    logger.warn('[APEX TESTS] Unable to save class cache', ex);
  }
}

/**
 * Discover the org's test classes and their test methods.
 *
 * A cheap manifest query lists every active unmanaged class, then SymbolTables are fetched in
 * chunks only for classes missing from the IndexedDB cache or modified since it was written.
 * SymbolTables are distilled to `{ isTest, methods }` immediately and never retained.
 */
export function useApexTestClasses(org: SalesforceOrgUi) {
  const isMounted = useRef(true);
  const currentFetchToken = useRef(0);
  /** Cancels in-flight scanning (up to ~100 sequential queries on large orgs) on unmount or when a newer load supersedes it */
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testClasses, setTestClasses] = useState<TestClassListItem[]>([]);
  /** Classes whose SymbolTable was unavailable — could be test classes, only class-level runs allowed */
  const [unknownClasses, setUnknownClasses] = useState<TestClassListItem[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const loadClasses = useCallback(
    async ({ skipCache }: { skipCache?: boolean } = {}) => {
      const fetchToken = new Date().getTime();
      currentFetchToken.current = fetchToken;
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      try {
        setLoading(true);
        setErrorMessage(null);
        const manifest = await fetchApexClassManifest(org, abortController.signal);
        const manifestById = new Map(manifest.map((record) => [record.Id, record]));
        const cache = skipCache ? {} : await readCache(org);

        const missingIds = manifest
          .filter((record) => !cache[record.Id] || cache[record.Id].lastModifiedDate !== record.LastModifiedDate)
          .map(({ Id }) => Id);

        if (missingIds.length) {
          const symbolTableRecords = await fetchSymbolTables(
            org,
            missingIds,
            (fetchedCount, totalCount) => {
              if (isMounted.current && fetchToken === currentFetchToken.current) {
                setProgressText(`Analyzing classes ${fetchedCount.toLocaleString()} of ${totalCount.toLocaleString()}…`);
              }
            },
            abortController.signal,
          );
          for (const record of symbolTableRecords) {
            const manifestRecord = manifestById.get(record.Id);
            if (manifestRecord) {
              cache[record.Id] = distillSymbolTable(record, manifestRecord.LastModifiedDate);
            }
          }
        }

        // Drop cache entries for classes that no longer exist
        const prunedCache: ApexClassCache = {};
        for (const [classId, entry] of Object.entries(cache)) {
          if (manifestById.has(classId)) {
            prunedCache[classId] = entry;
          }
        }

        // A superseded load must not write its (older) view of the org over the newer load's cache
        if (!isMounted.current || fetchToken !== currentFetchToken.current) {
          return;
        }
        await writeCache(org, prunedCache);
        if (!isMounted.current || fetchToken !== currentFetchToken.current) {
          return;
        }

        const testClassItems: TestClassListItem[] = [];
        const unknownClassItems: TestClassListItem[] = [];
        for (const record of manifest) {
          const entry = prunedCache[record.Id];
          if (!entry) {
            continue;
          }
          const item: TestClassListItem = {
            classId: record.Id,
            name: record.Name,
            lastModifiedDate: record.LastModifiedDate,
            methods: entry.methods,
            symbolTableUnavailable: entry.isTest === 'unknown',
          };
          if (entry.isTest === true) {
            testClassItems.push(item);
          } else if (entry.isTest === 'unknown') {
            unknownClassItems.push(item);
          }
        }
        setTestClasses(testClassItems);
        setUnknownClasses(unknownClassItems);
        setProgressText(null);
        setLoading(false);
      } catch (ex) {
        if (isMounted.current && fetchToken === currentFetchToken.current) {
          setErrorMessage(getErrorMessage(ex));
          setProgressText(null);
          setLoading(false);
        }
      }
    },
    [org],
  );

  useEffect(() => {
    setTestClasses([]);
    setUnknownClasses([]);
    loadClasses();
  }, [loadClasses]);

  const refresh = useCallback(() => loadClasses(), [loadClasses]);
  const refreshIgnoringCache = useCallback(() => loadClasses({ skipCache: true }), [loadClasses]);

  return { testClasses, unknownClasses, loading, progressText, errorMessage, refresh, refreshIgnoringCache };
}

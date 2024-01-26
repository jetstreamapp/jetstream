import { logger } from '@jetstream/shared/client-logger';
import { MapOf, Maybe, SalesforceOrgUi } from '@jetstream/types';
import type { Field } from 'jsforce';
import { useCallback, useEffect, useState } from 'react';
import { Query } from 'soql-parser-js';
import { fetchMetadataFromSoql } from '../utils/query-soql-utils';

/**
 * If query changes, fetch all metadata for all the fields in the query
 *
 * @param org
 * @param parsedQuery
 * @returns
 */
export function useQueryResultsFetchMetadata(org: SalesforceOrgUi, parsedQuery: Maybe<Query>, isTooling = false) {
  const [parsedQueryStr, setParsedQueryStr] = useState<string | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<MapOf<Field> | null>(null);
  const [fieldMetadataSubquery, setFieldMetadataSubquery] = useState<MapOf<MapOf<Field>> | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      if (org && parsedQuery && (!parsedQueryStr || parsedQueryStr !== JSON.stringify(parsedQuery.fields))) {
        const queryMetadata = await fetchMetadataFromSoql(org, parsedQuery, false, isTooling);

        const subqueryMetadata: MapOf<MapOf<Field>> = {};
        for (const key in queryMetadata.childMetadata) {
          subqueryMetadata[key.toLowerCase()] = queryMetadata.childMetadata[key].lowercaseFieldMap;
        }

        setParsedQueryStr(JSON.stringify(parsedQuery.fields));
        setFieldMetadata(queryMetadata.lowercaseFieldMap);
        setFieldMetadataSubquery(subqueryMetadata);
      }
    } catch (ex) {
      logger.log('[useQueryResultsFetchMetadata][ERROR]', ex);
    }
  }, [isTooling, org, parsedQuery, parsedQueryStr]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { fieldMetadata, fieldMetadataSubquery };
}

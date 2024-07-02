import { logger } from '@jetstream/shared/client-logger';
import { Field, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Query } from '@jetstreamapp/soql-parser-js';
import { useCallback, useEffect, useState } from 'react';
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
  const [fieldMetadata, setFieldMetadata] = useState<Record<string, Field> | null>(null);
  const [fieldMetadataSubquery, setFieldMetadataSubquery] = useState<Record<string, Record<string, Field>> | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      if (org && parsedQuery && (!parsedQueryStr || parsedQueryStr !== JSON.stringify(parsedQuery.fields))) {
        const queryMetadata = await fetchMetadataFromSoql(org, parsedQuery, false, isTooling);

        const subqueryMetadata: Record<string, Record<string, Field>> = {};
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

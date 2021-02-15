import { logger } from '@jetstream/shared/client-logger';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Field } from 'jsforce';
import { useCallback, useEffect, useState } from 'react';
import { Query } from 'soql-parser-js';
import { fetchMetadataFromSoql } from '../utils/query-soql-utils';

export function useQueryResultsFetchMetadata(org: SalesforceOrgUi, parsedQuery: Query) {
  const [parsedQueryStr, setParsedQueryStr] = useState<string>(null);
  const [fieldMetadata, setFieldMetadata] = useState<MapOf<Field>>(null);

  const fetchMetadata = useCallback(async () => {
    if (org && parsedQuery && (!parsedQueryStr || parsedQueryStr !== JSON.stringify(parsedQuery.fields))) {
      const queryMetadata = await fetchMetadataFromSoql(org, parsedQuery);
      setParsedQueryStr(JSON.stringify(parsedQuery.fields));
      setFieldMetadata(queryMetadata.lowercaseFieldMap);
      logger.info({ fieldMetadata: queryMetadata.lowercaseFieldMap });
    }
  }, [org, parsedQuery, parsedQueryStr]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { fieldMetadata };
}

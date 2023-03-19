import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useReducer, useRef } from 'react';

export interface MetadataDependencyEntityDefinition {
  Id: string;
  DeveloperName: string;
  EntityDefinitionId: string;
  TableEnumOrId: string;
}

export interface MetadataDependency {
  MetadataComponentId: string;
  MetadataComponentName: string;
  MetadataComponentNamespace: string;
  MetadataComponentType: string;
}

function getEntityDefinitionQuery(sobject: string, field: string) {
  let namespace: string | undefined = undefined;
  if (field.includes('__')) {
    const [_namespace, fieldWithoutNamespace] = field.split('__');
    namespace = _namespace;
    field = fieldWithoutNamespace;
  }
  return `SELECT Id, DeveloperName, EntityDefinitionId, TableEnumOrId
  FROM CustomField
  WHERE EntityDefinition.QualifiedApiName = '${sobject}'
  AND DeveloperName = '${field}'
  ${namespace ? `AND NamespacePrefix = '${namespace}'` : ''}
  LIMIT 1`;
}

function getDependencyQuery(RefMetadataComponentId: string) {
  return `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentNamespace, MetadataComponentType
  FROM MetadataComponentDependency
  WHERE RefMetadataComponentId = '${RefMetadataComponentId}'
  ORDER BY MetadataComponentType`;
}

export function useWhereIsThisUsed(org: SalesforceOrgUi, sobject: string, field: string) {
  const isMounted = useRef(true);

  const [{ hasLoaded, loading, data, hasError, errorMessage }, dispatch] = useReducer(
    useReducerFetchFn<ListItem<string, MetadataDependency>[]>(),
    {
      hasLoaded: false,
      loading: false,
      hasError: false,
      data: [],
    }
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (clearCache = false) => {
      try {
        dispatch({ type: 'REQUEST', payload: [] });
        if (clearCache) {
          clearCacheForOrg(org);
        }
        const entityDefinition = (
          await queryWithCache<MetadataDependencyEntityDefinition>(org, getEntityDefinitionQuery(sobject, field), true)
        ).data.queryResults.records[0];
        if (!entityDefinition) {
          if (isMounted.current) {
            dispatch({ type: 'SUCCESS', payload: [] });
          }
          return;
        }
        const dependencies = (await queryWithCache<MetadataDependency>(org, getDependencyQuery(entityDefinition.Id), true)).data
          .queryResults.records;

        if (isMounted.current) {
          dispatch({ type: 'SUCCESS', payload: getListItemFromQueryResults(dependencies) });
        }
      } catch (ex) {
        logger.warn('[useWhereIsThisUsed][ERROR]', ex.message);
        if (isMounted.current) {
          dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
        }
      }
    },
    [org, sobject, field]
  );

  return { loadDependencies: load, loading, items: data, hasLoaded, hasError, errorMessage };
}

/**
 * Convert records into ListItem
 * @param records
 */
function getListItemFromQueryResults(records: MetadataDependency[]) {
  return orderBy(records, ['MetadataComponentType', 'MetadataComponentName']).map((record): ListItem<string, MetadataDependency> => {
    let label = record.MetadataComponentName;
    if (record.MetadataComponentNamespace) {
      label += ` (${record.MetadataComponentNamespace})`;
    }
    return {
      id: record.MetadataComponentId,
      label,
      secondaryLabel: record.MetadataComponentType,
      value: record.MetadataComponentId,
      meta: record,
      title: label,
    };
  });
}

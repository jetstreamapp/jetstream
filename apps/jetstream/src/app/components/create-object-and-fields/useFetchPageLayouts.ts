import { logger } from '@jetstream/shared/client-logger';
import { queryWithCache } from '@jetstream/shared/data';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { groupBy } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { composeQuery, getField, Query } from 'soql-parser-js';

const MAX_OBJ_IN_QUERY = 100;

interface PageLayout {
  Id: string;
  Name: string;
  EntityDefinition: { QualifiedApiName: string };
  FullName?: string;
  Metadata?: any;
}

function getPageLayoutQueries(sObjects: string[]): string[] {
  const queries = splitArrayToMaxSize(sObjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    const query: Query = {
      fields: [getField('Id'), getField('Name'), getField('EntityDefinition.QualifiedApiName')],
      sObject: 'Layout',
      where: {
        left: {
          field: 'EntityDefinition.QualifiedApiName',
          operator: 'IN',
          value: sobjects,
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'LayoutType',
            operator: '=',
            value: 'Standard',
            literalType: 'STRING',
          },
        },
      },
      orderBy: [
        {
          field: 'EntityDefinitionId',
        },
        {
          field: 'Name',
        },
      ],
    };
    return composeQuery(query);
  });
  logger.log('getPageLayoutQueries()', queries);
  return queries;
}

export function useFetchPageLayouts(selectedOrg: SalesforceOrgUi, sObjects: string[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [layouts, setLayouts] = useState<MapOf<PageLayout[]>>({});
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<Set<string>>(new Set());

  const fetchLayouts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const _layouts: PageLayout[] = [];
      for (const query of getPageLayoutQueries(sObjects)) {
        (await queryWithCache<PageLayout>(selectedOrg, query, true)).data.queryResults.records.forEach((layout) => _layouts.push(layout));
      }
      setLayouts(groupBy(_layouts, 'EntityDefinition.QualifiedApiName') as MapOf<PageLayout[]>);
    } catch (ex) {
      logger.warn('[LAYOUT][FETCH][ERROR]', ex);
      setError('There was a problem getting page layouts');
    } finally {
      setLoading(false);
    }
  }, [sObjects, selectedOrg]);

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts, selectedOrg]);

  function handleSelectLayout(id: string) {
    if (selectedLayoutIds.has(id)) {
      selectedLayoutIds.delete(id);
    } else {
      selectedLayoutIds.add(id);
    }
    setSelectedLayoutIds(new Set(selectedLayoutIds));
  }

  return {
    loading,
    error,
    layouts,
    selectedLayoutIds,
    handleSelectLayout,
  };
}

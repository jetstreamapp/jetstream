import { logger } from '@jetstream/shared/client-logger';
import { queryWithCache } from '@jetstream/shared/data';
import { groupByFlat, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Query, composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import groupBy from 'lodash/groupBy';
import { useCallback, useEffect, useState } from 'react';
import { useRollbar } from './useRollbar';

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
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [layoutsByObject, setLayoutsByObject] = useState<Record<string, PageLayout[]>>({});
  const [layoutsById, setLayoutsById] = useState<Record<string, PageLayout>>({});
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<Set<string>>(new Set());

  const fetchLayouts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const _layouts: PageLayout[] = [];
      for (const query of getPageLayoutQueries(sObjects)) {
        (await queryWithCache<PageLayout>(selectedOrg, query, true)).data.queryResults.records.forEach((layout) => _layouts.push(layout));
      }
      setLayouts(_layouts);
      setLayoutsByObject(groupBy(_layouts, 'EntityDefinition.QualifiedApiName') as Record<string, PageLayout[]>);
      setLayoutsById(groupByFlat(_layouts, 'Id'));
    } catch (ex) {
      logger.warn('[LAYOUT][FETCH][ERROR]', ex);
      setError('There was a problem getting page layouts');
      rollbar.error('Create fields - fetch layouts error', {
        message: ex.message,
        stack: ex.stack,
      });
    } finally {
      setLoading(false);
    }
  }, [rollbar, sObjects, selectedOrg]);

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

  function handleSelectAll(value: boolean) {
    if (value) {
      setSelectedLayoutIds(new Set(layouts.map((layout) => layout.Id)));
    } else {
      setSelectedLayoutIds(new Set());
    }
  }

  return {
    loading,
    error,
    layouts,
    layoutsByObject,
    layoutsById,
    selectedLayoutIds,
    handleSelectLayout,
    handleSelectAll,
  };
}

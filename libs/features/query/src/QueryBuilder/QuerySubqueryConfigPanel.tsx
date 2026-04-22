import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getListItemsFromFieldWithRelatedItems, sortQueryFields, unFlattenedListItemsById } from '@jetstream/shared/ui-utils';
import { groupByFlat } from '@jetstream/shared/utils';
import { ExpressionType, Field, ListItem, QueryFields, QueryOrderByClause, SalesforceOrgUi } from '@jetstream/types';
import { Panel, Spinner } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { getSubqueryFieldBaseKey } from '@jetstream/ui-core/shared';
import { useAtom, useAtomValue } from 'jotai';
import isEmpty from 'lodash/isEmpty';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import QueryFilter from '../QueryOptions/QueryFilter';
import QueryLimit from '../QueryOptions/QueryLimit';
import QueryOrderBy from '../QueryOptions/QueryOrderBy';

export interface QuerySubqueryConfigPanelProps {
  org: SalesforceOrgUi;
  relationshipName: string;
  childSObject: string;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FILTER: ExpressionType = {
  action: 'AND',
  rows: [
    {
      key: 0,
      selected: {
        resource: null,
        resourceGroup: null,
        function: null,
        operator: 'eq',
        value: '',
      },
    },
  ],
};

const INITIAL_ORDER_BY: QueryOrderByClause[] = [fromQueryState.initOrderByClause(0)];

export const QuerySubqueryConfigPanel: FunctionComponent<QuerySubqueryConfigPanelProps> = ({
  org,
  relationshipName,
  childSObject,
  isOpen,
  onClose,
}) => {
  const [queryFieldsMap, setQueryFieldsMap] = useAtom(fromQueryState.queryFieldsMapState);
  const isTooling = useAtomValue(fromQueryState.isTooling);
  const [subqueryFilters, setSubqueryFilters] = useAtom(fromQueryState.querySubqueryFiltersState);
  const [subqueryOrderBy, setSubqueryOrderBy] = useAtom(fromQueryState.querySubqueryOrderByState);
  const [subqueryLimit, setSubqueryLimit] = useAtom(fromQueryState.querySubqueryLimitState);

  const childBaseKey = useMemo(() => getSubqueryFieldBaseKey(childSObject, relationshipName), [childSObject, relationshipName]);

  const [isFetchingBaseFields, setIsFetchingBaseFields] = useState(false);

  // If the user opens the panel on a child relationship they've never expanded in the field picker,
  // queryFieldsMap is empty for this subquery. Lazily populate it using the same fetch path as QueryChildFields.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!isEmpty(queryFieldsMap[childBaseKey])) {
      return;
    }
    setIsFetchingBaseFields(true);
    const loadingEntry: QueryFields = {
      key: childBaseKey,
      isPolymorphic: false,
      expanded: true,
      loading: true,
      hasError: false,
      filterTerm: '',
      sobject: childSObject,
      fields: {},
      visibleFields: new Set(),
      selectedFields: new Set(),
    };
    setQueryFieldsMap((prev) => ({ ...prev, [childBaseKey]: loadingEntry }));
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchFields(org, loadingEntry, childBaseKey, isTooling);
        if (cancelled) {
          return;
        }
        setQueryFieldsMap((prev) => ({ ...prev, [childBaseKey]: { ...fetched, loading: false } }));
      } catch (ex) {
        logger.warn('[SUBQUERY PANEL] Error fetching base fields', ex);
        if (cancelled) {
          return;
        }
        setQueryFieldsMap((prev) => ({ ...prev, [childBaseKey]: { ...loadingEntry, loading: false, hasError: true } }));
      } finally {
        if (!cancelled) {
          setIsFetchingBaseFields(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      // If the fetch hasn't resolved, drop the loading placeholder so the next
      // mount retries instead of short-circuiting on a stale `{ loading: true }` entry.
      setQueryFieldsMap((prev) => {
        if (prev[childBaseKey]?.loading) {
          const next = { ...prev };
          delete next[childBaseKey];
          return next;
        }
        return prev;
      });
    };
    // We intentionally depend only on open + base key; queryFieldsMap is a moving target
    // and isTooling is stable for the life of a panel instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, childBaseKey]);

  const { filterFields, orderByFields } = useMemo(() => {
    const allListItems = Object.values(queryFieldsMap)
      .filter((queryField) => queryField.key === childBaseKey || queryField.key.startsWith(childBaseKey))
      .flatMap((item) => {
        const path = item.key.slice(childBaseKey.length);
        const parentKey = path ? path.slice(0, -1) : ``;
        return getListItemsFromFieldWithRelatedItems(sortQueryFields(item.metadata?.fields || []), parentKey);
      });
    return {
      filterFields: unFlattenedListItemsById(
        groupByFlat(
          allListItems.filter((item) => item.meta?.filterable),
          'id',
        ),
      ),
      orderByFields: unFlattenedListItemsById(
        groupByFlat(
          allListItems.filter((item) => item.meta?.sortable),
          'id',
        ),
      ),
    };
  }, [queryFieldsMap, childBaseKey]);

  const filters = subqueryFilters[relationshipName] ?? EMPTY_FILTER;
  const orderByClauses = subqueryOrderBy[relationshipName] ?? INITIAL_ORDER_BY;
  const limit = subqueryLimit[relationshipName] ?? '';

  const handleFiltersChange = useCallback(
    (next: ExpressionType) => {
      setSubqueryFilters((prev) => ({ ...prev, [relationshipName]: next }));
    },
    [relationshipName, setSubqueryFilters],
  );

  const handleOrderByChange = useCallback(
    (next: QueryOrderByClause[]) => {
      setSubqueryOrderBy((prev) => ({ ...prev, [relationshipName]: next }));
    },
    [relationshipName, setSubqueryOrderBy],
  );

  const handleLimitChange = useCallback(
    (next: string) => {
      setSubqueryLimit((prev) => ({ ...prev, [relationshipName]: next }));
    },
    [relationshipName, setSubqueryLimit],
  );

  const handleClearAll = useCallback(() => {
    const omit = (prev: Record<string, unknown>) => {
      if (!(relationshipName in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[relationshipName];
      return next;
    };
    setSubqueryFilters((prev) => omit(prev) as typeof prev);
    setSubqueryOrderBy((prev) => omit(prev) as typeof prev);
    setSubqueryLimit((prev) => omit(prev) as typeof prev);
  }, [relationshipName, setSubqueryFilters, setSubqueryOrderBy, setSubqueryLimit]);

  const summary = useAtomValue(fromQueryState.subqueryOptionsSummaryState)[relationshipName];
  const hasAnyConfigured = !!summary && (summary.filterCount > 0 || summary.hasOrderBy || !!summary.limit);

  // Describe-on-demand drill-in for related fields in filter/orderBy rows.
  // Also seeds queryFieldsMap so that a later restore of a saved query can resolve
  // filter/orderBy fields that live behind a relationship the user never expanded
  // in the field picker.
  const loadRelatedFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      try {
        const field = item.meta as Field;
        if (!Array.isArray(field.referenceTo) || field.referenceTo.length <= 0) {
          return [];
        }
        const nestedKey = `${childBaseKey}${item.id}.`;
        const initialEntry: QueryFields = {
          key: nestedKey,
          isPolymorphic: field.referenceTo.length > 1,
          expanded: true,
          loading: false,
          hasError: false,
          filterTerm: '',
          sobject: field.referenceTo[0],
          fields: {},
          visibleFields: new Set(),
          selectedFields: new Set(),
        };
        const fetched = await fetchFields(org, initialEntry, nestedKey, isTooling);
        setQueryFieldsMap((prev) => (prev[nestedKey] ? prev : { ...prev, [nestedKey]: { ...fetched, loading: false } }));
        const sorted = sortQueryFields(fetched.metadata?.fields || []);
        return getListItemsFromFieldWithRelatedItems(sorted, item.id);
      } catch (ex) {
        logger.warn('Error fetching related fields for subquery panel', ex);
        return [];
      }
    },
    [org, isTooling, childBaseKey, setQueryFieldsMap],
  );

  const loadFilterRelatedFields = useCallback(
    async (item: ListItem) => {
      const items = await loadRelatedFields(item);
      return items.filter((child) => child.meta?.filterable);
    },
    [loadRelatedFields],
  );

  const loadOrderByRelatedFields = useCallback(
    async (item: ListItem) => {
      const items = await loadRelatedFields(item);
      return items.filter((child) => child.meta?.sortable);
    },
    [loadRelatedFields],
  );

  const hasChildMetadata = !isEmpty(queryFieldsMap[childBaseKey]) && !queryFieldsMap[childBaseKey]?.loading;

  return (
    <Panel
      heading={`Subquery Options · ${relationshipName} (${childSObject})`}
      isOpen={isOpen}
      position="right"
      size="xl"
      fullHeight
      closeOnEscape
      onClosed={onClose}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        <div
          className="slds-p-around_medium slds-is-relative"
          css={css`
            flex: 1 1 auto;
            overflow-y: auto;
          `}
        >
          {isFetchingBaseFields && <Spinner />}
          {!hasChildMetadata && !isFetchingBaseFields && (
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_medium">Loading fields…</p>
          )}
          {hasChildMetadata && (
            <Fragment>
              <section className="slds-m-bottom_medium">
                <h3 className="slds-text-heading_small slds-m-bottom_x-small">Filters</h3>
                <QueryFilter
                  org={org}
                  sobject={childSObject}
                  fields={filterFields}
                  filtersOrHaving={filters}
                  setFiltersOrHaving={handleFiltersChange}
                  onLoadRelatedFields={loadFilterRelatedFields}
                />
              </section>

              <section className="slds-m-bottom_medium">
                <h3 className="slds-text-heading_small slds-m-bottom_x-small">Order By</h3>
                <QueryOrderBy
                  sobject={childSObject}
                  fields={orderByFields}
                  orderByClauses={orderByClauses}
                  setOrderByClauses={handleOrderByChange}
                  onLoadRelatedFields={loadOrderByRelatedFields}
                />
              </section>

              <section>
                <h3 className="slds-text-heading_small slds-m-bottom_x-small">Limit</h3>
                <QueryLimit idPrefix={`subquery-limit-${relationshipName}`} limit={limit} setLimit={handleLimitChange} />
              </section>
            </Fragment>
          )}
        </div>
        <div
          className="slds-p-around_small slds-border_top"
          css={css`
            flex: 0 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          <button
            className="slds-button slds-button"
            type="button"
            onClick={handleClearAll}
            disabled={!hasAnyConfigured}
            title="Remove all filter, order by, and limit settings for this subquery"
          >
            Clear
          </button>
          <button className="slds-button slds-button_neutral" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Panel>
  );
};

export default QuerySubqueryConfigPanel;

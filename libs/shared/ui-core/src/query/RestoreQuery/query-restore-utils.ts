import { logger } from '@jetstream/shared/client-logger';
import { MAX_SUBQUERY_DEPTH } from '@jetstream/shared/constants';
import {
  convertDescribeToDescribeSObjectWithExtendedTypes,
  fetchFieldsProcessResults,
  getListItemsFromFieldWithRelatedItems,
  getLowercaseFieldFunctionMap,
  getOperatorFromWhereClause,
  sortQueryFields,
  unescapeSoqlString,
  unFlattenedListItemsById,
} from '@jetstream/shared/ui-utils';
import { getSubqueryPathDepth, groupByFlat, isSubqueryPathBelow, REGEX, walkSubqueries } from '@jetstream/shared/utils';
import {
  ChildRelationship,
  DescribeGlobalSObjectResult,
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  Field,
  FieldWrapper,
  ListItem,
  QueryFields,
  QueryFieldWithPolymorphic,
  QueryGroupByClause,
  QueryOrderByClause,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  BASE_FIELD_SEPARATOR,
  CHILD_FIELD_SEPARATOR,
  ensureFieldSelectItemsIncludesSelectionsFromRestore,
  fetchMetadataFromSoql,
  getFieldResourceTypes,
  getFieldSelectItems,
  getQueryFieldBaseKey,
  getQueryFieldKey,
  getSubqueryFieldBaseKey,
  getTypeFromMetadata,
  initQueryFieldStateItem,
  SoqlFetchMetadataOutput,
  SoqlMetadataTree,
} from '@jetstream/ui-core/shared';
import {
  Condition,
  DateLiteral,
  HavingClause,
  isGroupByField,
  isGroupByFn,
  isNegationCondition,
  isOrderByField,
  isValueFunctionCondition,
  isValueQueryCondition,
  isWhereClauseWithRightCondition,
  Operator,
  Query,
  FieldType as QueryFieldType,
  WhereClause,
} from '@jetstreamapp/soql-parser-js';
import isString from 'lodash/isString';
import { fromQueryState } from '../..';

export interface QueryRestoreErrors {
  missingFields: string[];
  /** Keyed by the subquery's relationship path from the root object, e.x. `Contacts` or `Contacts.Cases` */
  missingSubqueryFields: Record<string, string[]>;
  missingMisc: string[];
}

interface QueryRestoreStateItems extends QueryRestoreErrors {
  sObjectsState: DescribeGlobalSObjectResult[];
  selectedSObjectState: DescribeGlobalSObjectResult;
  queryFieldsKey: string;
  queryChildRelationships: ChildRelationship[];
  queryFieldsMapState: Record<string, QueryFields>;
  selectedQueryFieldsState: QueryFieldWithPolymorphic[];
  selectedSubqueryFieldsState: Record<string, QueryFieldWithPolymorphic[]>;
  querySubqueryFiltersState: Record<string, ExpressionType>;
  querySubqueryOrderByState: Record<string, QueryOrderByClause[]>;
  querySubqueryLimitState: Record<string, string>;
  fieldFilterFunctions: fromQueryState.FieldFilterFunction[];
  filterQueryFieldsState: ListItem[];
  orderByQueryFieldsState: ListItem[];
  groupByQueryFieldsState: ListItem[];
  queryGroupByState: QueryGroupByClause[];
  queryFiltersState: ExpressionType;
  queryHavingState: ExpressionType;
  queryLimit: string;
  queryLimitSkip: string;
  queryOrderByState: QueryOrderByClause[];
  querySoqlState: string;
}

interface FieldWrapperWithParentKey {
  parentKey: string;
  fieldKey: string;
  fieldMetadata: FieldWrapper;
}

export class UserFacingRestoreError extends Error {}

/**
 * Entry Point
 *
 * Build all state data structures based on a passed in query
 * An exception will be thrown if there are errors processing the data
 * Invalid object will throw
 * Missing fields will not throw, but will be returned for each part of query
 * Some parts of query may be ignored if not supported in builder (e.x. field functions)
 *
 * @param org
 * @param query
 */
export async function restoreQuery(org: SalesforceOrgUi, query: Query, isTooling = false): Promise<QueryRestoreStateItems> {
  // get metadata for all selected fields
  let SoqlFetchMetadataOutput: SoqlFetchMetadataOutput;
  try {
    SoqlFetchMetadataOutput = await fetchMetadataFromSoql(org, query, true, isTooling);
  } catch (ex) {
    if (ex instanceof UserFacingRestoreError) {
      throw ex;
    }
    logger.warn(ex);
    throw new UserFacingRestoreError(`There was an error obtaining the metadata from the org`);
  }
  // build state object
  const queryRestoreState = await queryRestoreBuildState(org, query, SoqlFetchMetadataOutput);
  logger.log('[QUERY RESTORE]', {
    SoqlFetchMetadataOutput,
    queryRestoreState,
  });
  return queryRestoreState;
}

async function queryRestoreBuildState(org: SalesforceOrgUi, query: Query, data: SoqlFetchMetadataOutput): Promise<QueryRestoreStateItems> {
  const outputStateItems: Partial<QueryRestoreStateItems> = {};
  outputStateItems.missingFields = [];
  outputStateItems.missingSubqueryFields = {};
  outputStateItems.missingMisc = [];
  outputStateItems.sObjectsState = data.sobjectMetadata;
  outputStateItems.selectedSObjectState = data.selectedSobjectMetadata.global;
  outputStateItems.queryFieldsKey = getQueryFieldKey(org, data.selectedSobjectMetadata.global.name);
  outputStateItems.queryChildRelationships = data.selectedSobjectMetadata.sobject.childRelationships.filter(
    (childRelationship) => !!childRelationship.relationshipName,
  );
  outputStateItems.queryFieldsMapState = {};
  outputStateItems.selectedQueryFieldsState = [];
  outputStateItems.selectedSubqueryFieldsState = {};

  processFields(data, outputStateItems, query.fields || []);

  processFieldFunctions(outputStateItems, query.fields || []);

  // Calculate all ListItems for filters and order by
  const allListItems = Object.values(outputStateItems.queryFieldsMapState)
    .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
    .flatMap((item) => {
      const [, path] = item.key.split('|');
      const parentKey = path ? path.slice(0, -1) : ``;
      return getListItemsFromFieldWithRelatedItems(sortQueryFields(item.metadata?.fields || []), parentKey);
    });

  outputStateItems.filterQueryFieldsState = unFlattenedListItemsById(
    groupByFlat(
      allListItems.filter((item) => item.meta.filterable),
      'id',
    ),
  );
  outputStateItems.orderByQueryFieldsState = unFlattenedListItemsById(
    groupByFlat(
      allListItems.filter((item) => item.meta.sortable),
      'id',
    ),
  );
  outputStateItems.groupByQueryFieldsState = unFlattenedListItemsById(
    groupByFlat(
      allListItems.filter((item) => item.meta?.groupable || item.meta?.type === 'datetime'),
      'id',
    ),
  );

  const fieldWrapperWithParentKey = getFieldWrapperPath(outputStateItems.queryFieldsMapState);

  processGroupBy(outputStateItems, query, fieldWrapperWithParentKey);
  processFilters(outputStateItems, query, fieldWrapperWithParentKey);
  processHavingClause(outputStateItems, query, fieldWrapperWithParentKey);
  processOrderBy(outputStateItems, query, fieldWrapperWithParentKey);
  processLimit(outputStateItems, query);
  processSubqueryOptions(outputStateItems, query, data);

  return outputStateItems as QueryRestoreStateItems;
}

/**
 * Build state objects for all fields including subqueries
 *
 * @param data
 * @param stateItems
 * @param queryFields
 */
function processFields(data: SoqlFetchMetadataOutput, stateItems: Partial<QueryRestoreStateItems>, queryFields: QueryFieldType[]) {
  const { queryFieldsMapState: queryFieldsMap } = stateItems;
  if (!queryFieldsMap) {
    return;
  }
  const baseKey = getQueryFieldBaseKey(data.selectedSobjectMetadata.global.name);
  const baseQueryFieldMap = initQueryFieldStateItem(baseKey, data.selectedSobjectMetadata.global.name);
  const baseObjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(data.selectedSobjectMetadata.sobject);
  queryFieldsMap[baseKey] = fetchFieldsProcessResults(baseObjectResults, baseQueryFieldMap, baseKey);

  // adds entries to queryFieldsMap
  updateQueryFieldsMapForRelatedFields(queryFieldsMap, baseKey, data.metadata);

  // Set all fields as selected or mark as missing
  setSelectedFields(baseKey, data.selectedSobjectMetadata.sobject.fields, queryFields, data.metadata, stateItems);

  // process subqueries, including any nested within another subquery
  processSubqueryFields(data, stateItems, queryFields);
}

/**
 * The query may not use the same casing as Salesforce metadata, so subqueries are matched on a lowercased
 * relationship path and then referred to by their canonical path everywhere downstream.
 */
function getCanonicalSubqueryPathMap(data: SoqlFetchMetadataOutput): Record<string, string> {
  return Object.keys(data.childMetadata).reduce((output: Record<string, string>, canonicalPath) => {
    output[canonicalPath.toLowerCase()] = canonicalPath;
    return output;
  }, {});
}

/**
 * Build state for every subquery within `queryFields`, including nested ones.
 * Each subquery is identified by its relationship path from the root object, e.x. `Contacts.Cases`.
 *
 * mutates data in stateItems
 */
function processSubqueryFields(data: SoqlFetchMetadataOutput, stateItems: Partial<QueryRestoreStateItems>, queryFields: QueryFieldType[]) {
  const { queryFieldsMapState: queryFieldsMap } = stateItems;
  if (!queryFieldsMap) {
    return;
  }
  const canonicalPathByLowercasePath = getCanonicalSubqueryPathMap(data);
  // Anything below an unresolved subquery is unresolvable too, so report only the shallowest failure
  const unresolvedPaths: string[] = [];

  for (const { subquery, relationshipPath } of walkSubqueries(queryFields)) {
    if (unresolvedPaths.some((unresolvedPath) => isSubqueryPathBelow(relationshipPath, unresolvedPath))) {
      continue;
    }
    const canonicalPath = canonicalPathByLowercasePath[relationshipPath.toLowerCase()];

    if (!canonicalPath) {
      unresolvedPaths.push(relationshipPath);
      stateItems.missingMisc = stateItems.missingMisc || [];
      stateItems.missingMisc.push(
        getSubqueryPathDepth(relationshipPath) > MAX_SUBQUERY_DEPTH
          ? `Subquery '${relationshipPath}' is nested more than ${MAX_SUBQUERY_DEPTH} levels deep`
          : `Child relationship '${relationshipPath}' was not found`,
      );
      continue;
    }

    const { objectMetadata, metadataTree } = data.childMetadata[canonicalPath];
    const childBaseKey = getSubqueryFieldBaseKey(objectMetadata.name, canonicalPath);

    const childBaseQueryFieldMap = initQueryFieldStateItem(childBaseKey, objectMetadata.name);
    const childBaseObjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(objectMetadata);
    queryFieldsMap[childBaseKey] = fetchFieldsProcessResults(childBaseObjectResults, childBaseQueryFieldMap, childBaseKey);

    updateQueryFieldsMapForRelatedFields(queryFieldsMap, childBaseKey, metadataTree);

    // Set all fields as selected or mark as missing
    setSelectedFields(childBaseKey, objectMetadata.fields, subquery.fields || [], metadataTree, stateItems, canonicalPath);
  }
}

/**
 * This relies on selectedQueryFieldsState having been set first.
 * Only fields that are valid and selected are processed.
 * @param stateItems
 */
function processFieldFunctions(stateItems: Partial<QueryRestoreStateItems>, queryFields: QueryFieldType[]) {
  const selectedQueryFieldsState = groupByFlat(stateItems.selectedQueryFieldsState || [], 'field');
  stateItems.fieldFilterFunctions = [];
  const lowercaseFieldFnMap = getLowercaseFieldFunctionMap();

  queryFields.forEach((field) => {
    if (field.type !== 'FieldFunctionExpression' || !isString(field.parameters[0]) || !selectedQueryFieldsState[field.parameters[0]]) {
      return;
    }

    stateItems.fieldFilterFunctions?.push({
      selectedField: selectedQueryFieldsState[field.parameters[0]],
      selectedFunction: lowercaseFieldFnMap[field.functionName.toLocaleLowerCase()] || field.functionName,
      alias: field.alias || null,
    });
  });

  if (!stateItems.fieldFilterFunctions.length) {
    stateItems.fieldFilterFunctions.push({
      selectedField: null,
      selectedFunction: null,
      alias: null,
    });
  }
}

function processGroupBy(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  _fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>,
) {
  if (!query.groupBy) {
    return;
  }
  const groupBys = Array.isArray(query.groupBy) ? query.groupBy : [query.groupBy];
  stateItems.queryGroupByState = [];
  let key = 0;
  groupBys.forEach((groupBy) => {
    if (isGroupByField(groupBy)) {
      stateItems.queryGroupByState?.push({
        key: key++,
        field: groupBy.field, // TODO: case-sensitive check?
        fieldLabel: groupBy.field, // TODO: what is this used for?
        function: null,
      });
    } else if (isGroupByFn(groupBy) && isString(groupBy.fn.parameters?.[0])) {
      stateItems.queryGroupByState?.push({
        key: key++,
        field: groupBy.fn.parameters?.[0] || null,
        fieldLabel: groupBy.fn.parameters?.[0] || null,
        function: groupBy.fn.functionName || null,
      });
    }
  });

  if (stateItems.queryGroupByState.length === 0) {
    stateItems.queryGroupByState = undefined;
  }
}

function processFilters(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>,
) {
  if (query.where) {
    const condition = query.where;
    stateItems.queryFiltersState = {
      action: isWhereClauseWithRightCondition(condition) && condition.operator === 'OR' ? 'OR' : 'AND',
      rows: flattenWhereClause(stateItems.missingMisc || [], fieldWrapperWithParentKey, condition, 0),
    };
  }
}

function processHavingClause(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>,
) {
  if (query.having) {
    const condition = query.having;
    stateItems.queryHavingState = {
      action: isWhereClauseWithRightCondition(condition) && condition.operator === 'OR' ? 'OR' : 'AND',
      rows: flattenWhereClause(stateItems.missingMisc || [], fieldWrapperWithParentKey, condition, 0),
    };
  }
}

function flattenWhereClause(
  missingMisc: string[],
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>,
  where: WhereClause | HavingClause,
  currKey: number,
  rows: (ExpressionConditionType | ExpressionGroupType)[] = [],
  previousCondition?: ExpressionConditionType,
  currentGroup?: ExpressionGroupType,
) {
  let expressionCondition: ExpressionConditionType | undefined = undefined;
  let expressionGroup: ExpressionGroupType | undefined = currentGroup;
  let closeGroup = false;
  /** if a new group is initialized, the operator is following the first condition */
  let needsGroupOperator = false;

  let condition = where.left as Condition;
  let isNegation = condition == null || isNegationCondition(condition);
  let priorConditionIsNegation = false;

  if (!isValueQueryCondition(condition)) {
    // init group if there are open parens
    const requiredOpeningParens = isNegation ? 2 : 1;
    if ((where.left?.openParen || 0) >= requiredOpeningParens && !expressionGroup) {
      expressionGroup = {
        key: currKey,
        action: 'AND', // Potentially updated later
        rows: [],
      };
      currKey++;
      needsGroupOperator = true;
      rows.push(expressionGroup);
    }

    if (isNegation) {
      // only item supported: NOT foo LIKE -> isNegationOperator()
      if (isWhereClauseWithRightCondition(where)) {
        condition = where.right.left as Condition;
        where = where.right;
        isNegation = false;
        priorConditionIsNegation = true;
      }
    }

    // we should never have double nested negation conditions as it is not allowed in UI
    // this is just here to narrow type, it is the common path
    if (!isNegation && !isNegationCondition(condition)) {
      // Get field and optional function
      let queryField = '';
      let clauseFunction: string | null = null;
      if (isValueFunctionCondition(condition) && isString(condition.fn.parameters?.[0])) {
        queryField = condition.fn.parameters?.[0] || '';
        clauseFunction = condition.fn.functionName || null;
      } else if (!isValueFunctionCondition(condition)) {
        queryField = condition.field.toLowerCase();
      }
      const foundField = fieldWrapperWithParentKey[queryField.toLowerCase()];
      clauseFunction = clauseFunction ? getLowercaseFieldFunctionMap()[clauseFunction.toLowerCase()] : null;

      if (foundField && (!isValueFunctionCondition(condition) || !!clauseFunction)) {
        const { fieldMetadata, fieldKey, parentKey } = foundField;
        const field = fieldMetadata.metadata;
        const operator = getOperatorFromWhereClause(condition.operator, condition.value as string, priorConditionIsNegation);

        if (field) {
          const value = ['isNull', 'isNotNull'].includes(operator) ? '' : removeQuotesAndPercentage(condition.operator, condition.value);
          expressionCondition = {
            key: currKey,
            resourceSelectItems: ensureFieldSelectItemsIncludesSelectionsFromRestore(field, getFieldSelectItems(field), value),
            // FIXME: for picklist restore, what if one or more values are not valid in metadata?
            // we could turn into text/area instead
            // ABOVE SHOULD BE FIXED, BUT NEEDS MORE TESTING
            resourceType: getTypeFromMetadata(field.type, operator, value),
            resourceTypes: getFieldResourceTypes(field, operator),
            selected: {
              resource: fieldKey,
              resourceMeta: fieldMetadata.metadata,
              resourceGroup: parentKey,
              function: clauseFunction,
              operator,
              value,
            },
          };
          // for non-list resourceTypes, ensure that value is always a string
          if (
            Array.isArray(value) &&
            (expressionCondition.resourceType === 'TEXT' ||
              expressionCondition.resourceType === 'TEXTAREA' ||
              expressionCondition.resourceType === 'NUMBER')
          ) {
            expressionCondition.selected.value = (expressionCondition.selected.value as string[]).join('\n');
          }
        } else {
          missingMisc.push(`Filter ${queryField} was not found`);
        }
      } else {
        missingMisc.push(`Filter is not supported or field was not found`);
      }

      const requiredClosingParens = priorConditionIsNegation ? 2 : 1;
      closeGroup = (condition?.closeParen || 0) >= requiredClosingParens;
    } else if (!isNegation) {
      // skip - we cannot process a value condition
      missingMisc.push(`Filter is not supported or field was not found`);
    }
  } else {
    // skip - we cannot process a value condition
    missingMisc.push(`Filter is not supported`);
  }

  if (expressionGroup) {
    if (expressionCondition) {
      expressionGroup.rows.push(expressionCondition);
    }
    if (needsGroupOperator && isWhereClauseWithRightCondition(where) && (where.operator === 'AND' || where.operator === 'OR')) {
      expressionGroup.action = where.operator;
    }
    if (closeGroup) {
      expressionGroup = undefined;
    }
  } else {
    if (expressionCondition) {
      rows.push(expressionCondition);
    }
  }

  if (isWhereClauseWithRightCondition(where)) {
    flattenWhereClause(missingMisc, fieldWrapperWithParentKey, where.right, currKey + 1, rows, expressionCondition, expressionGroup);
  }
  return rows;
}

function removeQuotesAndPercentage(operator: Operator, values: string | string[] | DateLiteral[]): string | string[] | DateLiteral[] {
  operator = (operator?.toUpperCase() as Operator) || operator;
  if (isString(values)) {
    values = values.replace(REGEX.START_END_SINGLE_QUOTE, '');
    if (operator === 'LIKE') {
      values = values.replace(REGEX.START_END_PERCENTAGE, '');
    }
    return unescapeSoqlString(values);
  } else if (Array.isArray(values)) {
    values = values.map((value) => (isString(value) ? unescapeSoqlString(value.replace(REGEX.START_END_SINGLE_QUOTE, '')) : value));
  }
  return values;
}

function processOrderBy(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>,
) {
  if (query.orderBy) {
    const orderByClauses = (Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy]) as QueryOrderByClause[];
    stateItems.queryOrderByState = orderByClauses
      .map((orderBy, i) => {
        if (!isOrderByField(orderBy)) {
          return null;
        }
        const foundField = fieldWrapperWithParentKey[orderBy.field.toLowerCase()];
        if (!foundField) {
          stateItems.missingFields = stateItems.missingFields || [];
          stateItems.missingFields.push(`Filter ${orderBy.field} was not found`);
          return undefined;
        }
        const { fieldMetadata, fieldKey, parentKey } = foundField;
        // used for field label
        const [base, path] = parentKey.split('|');
        const groupLabel = path ? path.substring(0, path.length - 1) : base;

        if (fieldMetadata) {
          return {
            key: i,
            field: fieldKey,
            fieldLabel: `${groupLabel} - ${fieldMetadata.label} (${fieldMetadata.name})`,
            order: orderBy.order,
            nulls: orderBy.nulls || null,
          };
        }
        return undefined;
      })
      .filter((orderBy) => !!orderBy) as QueryOrderByClause[];
  }
}

function processLimit(stateItems: Partial<QueryRestoreStateItems>, query: Query) {
  if (query.limit) {
    stateItems.queryLimit = `${query.limit}`;
  }
  if (query.offset) {
    stateItems.queryLimitSkip = `${query.offset}`;
  }
}

/**
 * Walk every FieldSubquery in the query, including nested ones, and populate per-relationship
 * filter / orderBy / limit state keyed by relationship path.
 * Restores SOQL features that were previously silently dropped during restore.
 */
function processSubqueryOptions(stateItems: Partial<QueryRestoreStateItems>, query: Query, data: SoqlFetchMetadataOutput) {
  stateItems.querySubqueryFiltersState = {};
  stateItems.querySubqueryOrderByState = {};
  stateItems.querySubqueryLimitState = {};

  const canonicalPathByLowercasePath = getCanonicalSubqueryPathMap(data);
  const queryFieldsMap = stateItems.queryFieldsMapState || {};

  for (const { subquery, relationshipPath: queryRelationshipPath } of walkSubqueries(query.fields)) {
    // Unresolved subqueries are reported by processSubqueryFields, so just skip them here
    const relationshipPath = canonicalPathByLowercasePath[queryRelationshipPath.toLowerCase()];
    if (!relationshipPath) {
      continue;
    }
    const childMeta = data.childMetadata[relationshipPath];
    const childBaseKey = getSubqueryFieldBaseKey(childMeta.objectMetadata.name, relationshipPath);
    const fieldWrapperForSubquery = getFieldWrapperPathForSubquery(queryFieldsMap, childBaseKey);

    if (subquery.where) {
      const missingForSubquery: string[] = [];
      const rows = flattenWhereClause(missingForSubquery, fieldWrapperForSubquery, subquery.where, 0);
      if (rows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        stateItems.querySubqueryFiltersState![relationshipPath] = {
          action: isWhereClauseWithRightCondition(subquery.where) && subquery.where.operator === 'OR' ? 'OR' : 'AND',
          rows,
        };
      }
      if (missingForSubquery.length > 0) {
        stateItems.missingMisc = stateItems.missingMisc || [];
        missingForSubquery.forEach((message) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stateItems.missingMisc!.push(`Subquery '${relationshipPath}': ${message}`);
        });
      }
    }

    if (subquery.orderBy) {
      const orderByClauses = Array.isArray(subquery.orderBy) ? subquery.orderBy : [subquery.orderBy];
      const restoredOrderBys = orderByClauses
        .map((orderBy, i) => {
          if (!isOrderByField(orderBy)) {
            return null;
          }
          const foundField = fieldWrapperForSubquery[orderBy.field.toLowerCase()];
          if (!foundField) {
            stateItems.missingMisc = stateItems.missingMisc || [];
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            stateItems.missingMisc!.push(`Subquery '${relationshipPath}': Order By ${orderBy.field} was not found`);
            return null;
          }
          const { fieldMetadata, fieldKey, parentKey } = foundField;
          const [, path] = parentKey.split('|');
          // For a field directly on the subquery the base segment is the internal `${childSObject}~${relationshipPath}`
          // key, which is not user-facing — use the relationship path so the restored label reads cleanly.
          const groupLabel = path ? path.substring(0, path.length - 1) : relationshipPath;
          if (!fieldMetadata) {
            return null;
          }
          return {
            key: i,
            field: fieldKey,
            fieldLabel: `${groupLabel} - ${fieldMetadata.label} (${fieldMetadata.name})`,
            order: orderBy.order,
            nulls: orderBy.nulls || null,
          } as QueryOrderByClause;
        })
        .filter((orderBy): orderBy is QueryOrderByClause => !!orderBy);

      if (restoredOrderBys.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        stateItems.querySubqueryOrderByState![relationshipPath] = restoredOrderBys;
      }
    }

    if (subquery.limit != null) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      stateItems.querySubqueryLimitState![relationshipPath] = `${subquery.limit}`;
    }
  }
}

/**
 * Sibling of getFieldWrapperPath, scoped to a single subquery's base key.
 * Walks every queryFieldsMap entry under `${childBaseKey}...` and returns a
 * lowercase-field → FieldWrapperWithParentKey lookup usable by flattenWhereClause.
 */
function getFieldWrapperPathForSubquery(
  queryFields: Record<string, QueryFields>,
  childBaseKey: string,
): Record<string, FieldWrapperWithParentKey> {
  return Object.keys(queryFields)
    .filter((key) => key.startsWith(childBaseKey))
    .reduce((output: Record<string, FieldWrapperWithParentKey>, key) => {
      const queryField = queryFields[key];
      // Keys for subqueries look like `${childSobject}~${relationshipPath}|{optional.path.}`.
      // The "path" portion (after the pipe) is what should prefix each field key,
      // matching how soql-parser-js emits dotted field paths in subquery WHERE/ORDER BY.
      const fieldPath = key.slice(childBaseKey.length);
      Object.keys(queryField.fields).forEach((fieldName) => {
        output[`${fieldPath}${fieldName}`.toLowerCase()] = {
          parentKey: queryField.key,
          fieldKey: `${fieldPath}${fieldName}`,
          fieldMetadata: queryField.fields[fieldName],
        };
      });
      return output;
    }, {});
}

/**
 * Attempt to find each field in query and mark as selected
 * This is called for base query and each subquery individually
 *
 * mutates data in stateItems
 */
function setSelectedFields(
  baseKey: string,
  baseFields: Field[],
  queryFields: QueryFieldType[],
  metadataTree: Record<string, SoqlMetadataTree>,
  stateItems: Partial<QueryRestoreStateItems>,
  subqueryRelationshipPath?: string,
) {
  const {
    missingFields: missingFieldsTemp = [],
    missingSubqueryFields = {},
    missingMisc = [],
    queryFieldsMapState: queryFieldsMap = {},
    selectedQueryFieldsState: selectedQueryFieldsTemp = [],
    selectedSubqueryFieldsState: selectedSubqueryFields = {},
  } = stateItems;

  let selectedQueryFields = selectedQueryFieldsTemp;
  let missingFields = missingFieldsTemp;
  // change target if working on subquery
  if (subqueryRelationshipPath) {
    selectedSubqueryFields[subqueryRelationshipPath] = selectedSubqueryFields[subqueryRelationshipPath] || [];
    selectedQueryFields = selectedSubqueryFields[subqueryRelationshipPath];

    missingSubqueryFields[subqueryRelationshipPath] = missingSubqueryFields[subqueryRelationshipPath] || [];
    missingFields = missingSubqueryFields[subqueryRelationshipPath];
  }
  const baseFieldLowercaseMap = getLowercaseFieldMap(baseFields);
  const keyToMetadataTreeNode = getMapOfKeyToMetadataTreeNode(metadataTree);

  // Only fields and field relationships are supported
  queryFields.forEach((field) => {
    if (field.type === 'Field') {
      const lowercaseField = field.field.toLowerCase();
      if (baseFieldLowercaseMap[lowercaseField]) {
        const fieldName = baseFieldLowercaseMap[lowercaseField].name;
        queryFieldsMap[baseKey].selectedFields.add(fieldName);
        selectedQueryFields.push({ field: fieldName, polymorphicObj: undefined, metadata: baseFieldLowercaseMap[lowercaseField] });
      } else {
        missingFields.push(field.field);
      }
    } else if (field.type === 'FieldFunctionExpression' && isString(field.parameters[0])) {
      const lowercaseField = field.parameters[0].toLowerCase();
      if (baseFieldLowercaseMap[lowercaseField]) {
        const fieldName = baseFieldLowercaseMap[lowercaseField].name;
        queryFieldsMap[baseKey].selectedFields.add(fieldName);
        selectedQueryFields.push({ field: fieldName, polymorphicObj: undefined, metadata: baseFieldLowercaseMap[lowercaseField] });
      } else if (lowercaseField.includes('.')) {
        const baseField = lowercaseField.split('.').slice(-1)[0];
        const relationship = lowercaseField.split('.').slice(0, -1).join('.');
        if (keyToMetadataTreeNode[relationship]?.lowercaseFieldMap[baseField]) {
          const node = keyToMetadataTreeNode[relationship];
          const fieldName = node.lowercaseFieldMap[baseField].name;
          const [, relationshipPath] = node.fieldKey.split('|');
          queryFieldsMap[node.fieldKey].selectedFields.add(fieldName);
          selectedQueryFields.push({
            field: `${relationshipPath}${fieldName}`,
            polymorphicObj: undefined,
            metadata: keyToMetadataTreeNode[relationship].lowercaseFieldMap[baseField],
          });
        } else {
          missingFields.push(field.rawValue || field.functionName);
        }
      } else {
        missingFields.push(field.rawValue || field.functionName);
      }
    } else if (field.type === 'FieldRelationship') {
      const lowercaseField = field.field.toLowerCase();
      const relationship = field.relationships.join('.').toLowerCase();
      if (keyToMetadataTreeNode[relationship]?.lowercaseFieldMap[lowercaseField]) {
        const node = keyToMetadataTreeNode[relationship];
        const fieldName = node.lowercaseFieldMap[lowercaseField].name;
        const [, relationshipPath] = node.fieldKey.split('|');
        queryFieldsMap[node.fieldKey].selectedFields.add(fieldName);
        selectedQueryFields.push({
          field: `${relationshipPath}${fieldName}`,
          polymorphicObj: undefined,
          metadata: keyToMetadataTreeNode[relationship].lowercaseFieldMap[lowercaseField],
        });
      } else if (field.rawValue) {
        missingFields.push(field.rawValue);
      }
    } else if (field.type === 'FieldTypeof') {
      const [firstCondition] = field.conditions;
      firstCondition.fieldList.forEach((relatedField) => {
        const lowercaseField = relatedField.toLowerCase();
        const relationship = field.field.toLowerCase();
        if (keyToMetadataTreeNode[relationship]?.lowercaseFieldMap[lowercaseField]) {
          const node = keyToMetadataTreeNode[relationship];
          const fieldName = node.lowercaseFieldMap[lowercaseField].name;
          const [, relationshipPath] = node.fieldKey.split('|');
          queryFieldsMap[node.fieldKey].selectedFields.add(fieldName);
          selectedQueryFields.push({
            field: `${relationshipPath}${fieldName}`,
            polymorphicObj: firstCondition.objectType,
            metadata: keyToMetadataTreeNode[relationship].lowercaseFieldMap[lowercaseField],
          });
        } else {
          missingFields.push(`${field.field}.${relatedField}`);
        }
      });
    } else if (field.type !== 'FieldSubquery') {
      // Subqueries at any level are handled by processSubqueryFields, which reports the ones it cannot resolve
      missingMisc.push(`${field.type} is not supported`);
    }
  });
}

/**
 * Traverse all children relationships and add them to queryFieldsMap
 *
 * Mutates queryFieldsMap
 *
 * @param queryFieldsMap
 * @param baseKey
 * @param metadataTree
 */
function updateQueryFieldsMapForRelatedFields(
  queryFieldsMap: Record<string, QueryFields>,
  baseKey: string,
  metadataTree: Record<string, SoqlMetadataTree>,
) {
  function traverseChildren(children: SoqlMetadataTree[], _parentKey: string) {
    children.forEach((currNode) => {
      const fieldMapItem = initQueryFieldStateItem(currNode.fieldKey, currNode.metadata.name, { expanded: false });
      const sobjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(currNode.metadata);
      queryFieldsMap[currNode.fieldKey] = fetchFieldsProcessResults(sobjectResults, fieldMapItem, currNode.fieldKey);
      traverseChildren(currNode.children, currNode.fieldKey);
    });
  }

  Object.keys(metadataTree).forEach((key) => {
    const currNode = metadataTree[key];
    const fieldMapItem = initQueryFieldStateItem(currNode.fieldKey, currNode.metadata.name, { expanded: false });
    const sobjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(currNode.metadata);
    queryFieldsMap[currNode.fieldKey] = fetchFieldsProcessResults(sobjectResults, fieldMapItem, currNode.fieldKey);
    traverseChildren(currNode.children, currNode.fieldKey);
  });
}

function getMapOfKeyToMetadataTreeNode(metadataTree: Record<string, SoqlMetadataTree>) {
  const output: Record<string, SoqlMetadataTree> = {};

  function traverseChildren(children: SoqlMetadataTree[]) {
    children.forEach((child) => {
      output[child.key] = child;
      traverseChildren(child.children);
    });
  }

  Object.keys(metadataTree).forEach((key) => {
    output[key] = metadataTree[key];
    traverseChildren(metadataTree[key].children);
  });

  return output;
}

function getLowercaseFieldMap(fields: Field[]) {
  return fields.reduce((lowercaseFieldMap: Record<string, Field>, field) => {
    lowercaseFieldMap[field.name.toLowerCase()] = field;
    return lowercaseFieldMap;
  }, {});
}

/**
 * Get a map of all fields with normalized (lowercase) fields as the key
 * and a modified FieldWrapper
 *
 * This is used to build the filters based on which fields are selected
 *
 * @param queryFields
 */
function getFieldWrapperPath(queryFields: Record<string, QueryFields>): Record<string, FieldWrapperWithParentKey> {
  return Object.keys(queryFields)
    .filter((key) => !key.includes(CHILD_FIELD_SEPARATOR))
    .reduce((output: Record<string, FieldWrapperWithParentKey>, key) => {
      const queryField = queryFields[key];
      const fieldPath = key.split(BASE_FIELD_SEPARATOR)[1] || '';
      Object.keys(queryField.fields).forEach((fieldName) => {
        output[`${fieldPath}${fieldName}`.toLowerCase()] = {
          parentKey: queryField.key,
          fieldKey: `${fieldPath}${fieldName}`,
          fieldMetadata: queryField.fields[fieldName],
        };
      });
      return output;
    }, {});
}

export const __TEST_EXPORTS__ = {
  processFields,
  processSubqueryOptions,
  getFieldWrapperPathForSubquery,
};

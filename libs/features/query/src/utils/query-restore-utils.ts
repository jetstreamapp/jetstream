import { logger } from '@jetstream/shared/client-logger';
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
import { groupByFlat, REGEX } from '@jetstream/shared/utils';
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
import { fromQueryState } from '@jetstream/ui-core';
import {
  Condition,
  DateLiteral,
  FieldSubquery,
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
import {
  BASE_FIELD_SEPARATOR,
  CHILD_FIELD_SEPARATOR,
  getQueryFieldBaseKey,
  getQueryFieldKey,
  getSubqueryFieldBaseKey,
  initQueryFieldStateItem,
} from './query-fields-utils';
import {
  ensureFieldSelectItemsIncludesSelectionsFromRestore,
  getFieldResourceTypes,
  getFieldSelectItems,
  getTypeFromMetadata,
} from './query-filter.utils';
import { fetchMetadataFromSoql, SoqlFetchMetadataOutput, SoqlMetadataTree } from './query-soql-utils';

export interface QueryRestoreErrors {
  missingFields: string[];
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
    (childRelationship) => !!childRelationship.relationshipName
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
      'id'
    )
  );
  outputStateItems.orderByQueryFieldsState = unFlattenedListItemsById(
    groupByFlat(
      allListItems.filter((item) => item.meta.sortable),
      'id'
    )
  );
  outputStateItems.groupByQueryFieldsState = unFlattenedListItemsById(
    groupByFlat(
      allListItems.filter((item) => item.meta.groupable),
      'id'
    )
  );

  const fieldWrapperWithParentKey = getFieldWrapperPath(outputStateItems.queryFieldsMapState);

  processGroupBy(outputStateItems, query, fieldWrapperWithParentKey);
  processFilters(outputStateItems, query, fieldWrapperWithParentKey);
  processHavingClause(outputStateItems, query, fieldWrapperWithParentKey);
  processOrderBy(outputStateItems, query, fieldWrapperWithParentKey);
  processLimit(outputStateItems, query);

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

  // process subqueries
  Object.keys(data.childMetadata).forEach((relationshipName) => {
    const { objectMetadata, metadataTree } = data.childMetadata[relationshipName];
    const childBaseKey = getSubqueryFieldBaseKey(objectMetadata.name, relationshipName);

    const childBaseQueryFieldMap = initQueryFieldStateItem(childBaseKey, objectMetadata.name);
    const childBaseObjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(objectMetadata);
    queryFieldsMap[childBaseKey] = fetchFieldsProcessResults(childBaseObjectResults, childBaseQueryFieldMap, childBaseKey);

    updateQueryFieldsMapForRelatedFields(queryFieldsMap, childBaseKey, metadataTree);

    // Set all fields as selected or mark as missing
    const subqueryField = queryFields.find(
      (field) => field.type === 'FieldSubquery' && field.subquery.relationshipName.toLowerCase() === relationshipName.toLowerCase()
    ) as FieldSubquery;
    if (subqueryField) {
      setSelectedFields(
        childBaseKey,
        objectMetadata.fields,
        subqueryField.subquery.fields || [],
        metadataTree,
        stateItems,
        relationshipName
      );
    } else {
      // ERROR - this should not happen (confirm if it is possible or not and remove this path if so)
      // otherwise handle error
    }
  });
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
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>
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
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>
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
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>
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
  currentGroup?: ExpressionGroupType
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
              resourceMeta: fieldMetadata,
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
    values = (values as any[]).map((value) =>
      isString(value) ? unescapeSoqlString(value.replace(REGEX.START_END_SINGLE_QUOTE, '')) : value
    );
  }
  return values;
}

function processOrderBy(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: Record<string, FieldWrapperWithParentKey>
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
  subqueryRelationshipName?: string
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
  if (subqueryRelationshipName) {
    selectedSubqueryFields[subqueryRelationshipName] = selectedSubqueryFields[subqueryRelationshipName] || [];
    selectedQueryFields = selectedSubqueryFields[subqueryRelationshipName];

    missingSubqueryFields[subqueryRelationshipName] = missingSubqueryFields[subqueryRelationshipName] || [];
    missingFields = missingSubqueryFields[subqueryRelationshipName];
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
          const [_, relationshipPath] = node.fieldKey.split('|');
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
        const [_, relationshipPath] = node.fieldKey.split('|');
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
          const [_, relationshipPath] = node.fieldKey.split('|');
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
  metadataTree: Record<string, SoqlMetadataTree>
) {
  function traverseChildren(children: SoqlMetadataTree[], parentKey: string) {
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

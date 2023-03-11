import { logger } from '@jetstream/shared/client-logger';
import {
  convertDescribeToDescribeSObjectWithExtendedTypes,
  fetchFieldsProcessResults,
  getOperatorFromWhereClause,
  unescapeSoqlString,
} from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import {
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  FieldWrapper,
  ListItemGroup,
  MapOf,
  QueryFields,
  QueryFieldWithPolymorphic,
  QueryOrderByClause,
  SalesforceOrgUi,
} from '@jetstream/types';
import type { ChildRelationship, DescribeGlobalSObjectResult, Field } from 'jsforce';
import { isString } from 'lodash';
import {
  Condition,
  DateLiteral,
  FieldSubquery,
  FieldType as QueryFieldType,
  isNegationCondition,
  isOrderByField,
  isValueFunctionCondition,
  isValueQueryCondition,
  isWhereClauseWithRightCondition,
  Operator,
  OrderByFieldClause,
  Query,
  WhereClause,
} from 'soql-parser-js';
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
import { calculateFilterAndOrderByListGroupFields } from './query-utils';

export interface QueryRestoreErrors {
  missingFields: string[];
  missingSubqueryFields: MapOf<string[]>;
  missingMisc: string[];
}

interface QueryRestoreStateItems extends QueryRestoreErrors {
  sObjectsState: DescribeGlobalSObjectResult[];
  selectedSObjectState: DescribeGlobalSObjectResult;
  queryFieldsKey: string;
  queryChildRelationships: ChildRelationship[];
  queryFieldsMapState: MapOf<QueryFields>;
  selectedQueryFieldsState: QueryFieldWithPolymorphic[];
  selectedSubqueryFieldsState: MapOf<QueryFieldWithPolymorphic[]>;
  filterQueryFieldsState: ListItemGroup[];
  orderByQueryFieldsState: ListItemGroup[];
  queryFiltersState: ExpressionType;
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
export async function restoreQuery(org: SalesforceOrgUi, query: Query, isTooling): Promise<QueryRestoreStateItems> {
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

  outputStateItems.filterQueryFieldsState = calculateFilterAndOrderByListGroupFields(outputStateItems.queryFieldsMapState, ['filterable']);
  outputStateItems.orderByQueryFieldsState = calculateFilterAndOrderByListGroupFields(outputStateItems.queryFieldsMapState, ['sortable']);

  const fieldWrapperWithParentKey = getFieldWrapperPath(outputStateItems.queryFieldsMapState);

  processFilters(data, outputStateItems, query, fieldWrapperWithParentKey);
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

function processFilters(
  data: SoqlFetchMetadataOutput,
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: MapOf<FieldWrapperWithParentKey>
) {
  if (query.where) {
    const condition = query.where;
    stateItems.queryFiltersState = {
      action: isWhereClauseWithRightCondition(condition) && condition.operator === 'OR' ? 'OR' : 'AND',
      rows: flattenWhereClause(stateItems.missingMisc || [], fieldWrapperWithParentKey, condition, 0),
    };
  }
}

function flattenWhereClause(
  missingMisc: string[],
  fieldWrapperWithParentKey: MapOf<FieldWrapperWithParentKey>,
  where: WhereClause,
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
    if (
      !isNegation &&
      !isNegationCondition(condition) &&
      !isValueFunctionCondition(condition) &&
      fieldWrapperWithParentKey[condition.field.toLowerCase()]
    ) {
      const foundField = fieldWrapperWithParentKey[condition.field.toLowerCase()];
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
          // TODO:
          resourceType: getTypeFromMetadata(field.type, operator, value),
          resourceTypes: getFieldResourceTypes(field, operator),
          selected: {
            resource: fieldKey,
            resourceMeta: fieldMetadata,
            resourceGroup: parentKey,
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
        missingMisc.push(`Filter ${condition.field} was not found`);
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
  fieldWrapperWithParentKey: MapOf<FieldWrapperWithParentKey>
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
  metadataTree: MapOf<SoqlMetadataTree>,
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
        selectedQueryFields.push({ field: fieldName, polymorphicObj: undefined });
      } else {
        missingFields.push(field.field);
      }
    } else if (field.type === 'FieldRelationship') {
      const lowercaseField = field.field.toLowerCase();
      const relationship = field.relationships.join('.').toLowerCase();
      if (keyToMetadataTreeNode[relationship]?.lowercaseFieldMap[lowercaseField]) {
        const node = keyToMetadataTreeNode[relationship];
        const fieldName = node.lowercaseFieldMap[lowercaseField].name;
        const [_, relationshipPath] = node.fieldKey.split('|');
        queryFieldsMap[node.fieldKey].selectedFields.add(fieldName);
        selectedQueryFields.push({ field: `${relationshipPath}${fieldName}`, polymorphicObj: undefined });
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
          selectedQueryFields.push({ field: `${relationshipPath}${fieldName}`, polymorphicObj: firstCondition.objectType });
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
function updateQueryFieldsMapForRelatedFields(queryFieldsMap: MapOf<QueryFields>, baseKey: string, metadataTree: MapOf<SoqlMetadataTree>) {
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

function getMapOfKeyToMetadataTreeNode(metadataTree: MapOf<SoqlMetadataTree>) {
  const output: MapOf<SoqlMetadataTree> = {};

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
  return fields.reduce((lowercaseFieldMap: MapOf<Field>, field) => {
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
function getFieldWrapperPath(queryFields: MapOf<QueryFields>): MapOf<FieldWrapperWithParentKey> {
  return Object.keys(queryFields)
    .filter((key) => !key.includes(CHILD_FIELD_SEPARATOR))
    .reduce((output: MapOf<FieldWrapperWithParentKey>, key) => {
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

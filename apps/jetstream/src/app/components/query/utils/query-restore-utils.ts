import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, describeSObject } from '@jetstream/shared/data';
import {
  convertDescribeToDescribeSObjectWithExtendedTypes,
  fetchFieldsProcessResults,
  getFieldKey,
  getOperatorFromWhereClause,
  isNegationOperator,
} from '@jetstream/shared/ui-utils';
import { orderStringsBy, REGEX } from '@jetstream/shared/utils';
import {
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionRowValueType,
  ExpressionType,
  FieldWrapper,
  ListItem,
  ListItemGroup,
  MapOf,
  QueryFields,
  QueryFieldWithPolymorphic,
  QueryOrderByClause,
  SalesforceOrgUi,
} from '@jetstream/types';
import { ChildRelationship, DescribeGlobalSObjectResult, DescribeSObjectResult, Field } from 'jsforce';
import { isString } from 'lodash';
import {
  Condition,
  DateLiteral,
  FieldSubquery,
  FieldType as QueryFieldType,
  isNegationCondition,
  isOrderByField,
  isValueCondition,
  isValueFunctionCondition,
  isValueQueryCondition,
  isWhereClauseWithRightCondition,
  isWhereOrHavingClauseWithRightCondition,
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
import { getDateResourceTypes, getDateTimeResourceTypes, getTypeFromMetadata } from './query-filter.utils';
import { calculateFilterAndOrderByListGroupFields } from './query-utils';

interface QueryRestoreMetadataTree {
  key: string;
  parentField: Field;
  fieldKey: string;
  parentKey?: string;
  level: number; // do not allow beyond 5
  metadata: DescribeSObjectResult;
  lowercaseFieldMap: MapOf<Field>;
  children: QueryRestoreMetadataTree[];
}

interface QueryRestoreFetchOutput {
  sobjectMetadata: DescribeGlobalSObjectResult[];
  selectedSobjectMetadata: { global: DescribeGlobalSObjectResult; sobject: DescribeSObjectResult };
  metadata: MapOf<QueryRestoreMetadataTree>;
  childMetadata: {
    [childRelationshipName: string]: {
      objectMetadata: DescribeSObjectResult;
      metadataTree: MapOf<QueryRestoreMetadataTree>;
    };
  };
  // includes full path
  lowercaseFieldMap: MapOf<Field>;
}
interface ParsableFields {
  fields: string[];
  subqueries: { [childRelationshipName: string]: string[] };
}

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

const TYPEOF_SEPARATOR = '!';

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
  let queryRestoreFetchOutput: QueryRestoreFetchOutput;
  try {
    queryRestoreFetchOutput = await queryRestoreFetchData(org, query, isTooling);
  } catch (ex) {
    if (ex instanceof UserFacingRestoreError) {
      throw ex;
    }
    logger.warn(ex);
    throw new UserFacingRestoreError(`There was an error obtaining the metadata from the org`);
  }
  // build state object
  const queryRestoreState = await queryRestoreBuildState(org, query, queryRestoreFetchOutput);
  logger.log('[QUERY RESTORE]', {
    queryRestoreFetchOutput,
    queryRestoreState,
  });
  return queryRestoreState;
}

async function queryRestoreBuildState(org: SalesforceOrgUi, query: Query, data: QueryRestoreFetchOutput): Promise<QueryRestoreStateItems> {
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

  processFields(data, outputStateItems, query.fields);

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
function processFields(data: QueryRestoreFetchOutput, stateItems: Partial<QueryRestoreStateItems>, queryFields: QueryFieldType[]) {
  const { queryFieldsMapState: queryFieldsMap } = stateItems;
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
      setSelectedFields(childBaseKey, objectMetadata.fields, subqueryField.subquery.fields, metadataTree, stateItems, relationshipName);
    } else {
      // ERROR - this should not happen (confirm if it is possible or not and remove this path if so)
      // otherwise handle error
    }
  });
}

function processFilters(
  data: QueryRestoreFetchOutput,
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: MapOf<FieldWrapperWithParentKey>
) {
  if (query.where) {
    const condition = query.where;
    stateItems.queryFiltersState = {
      action: isWhereClauseWithRightCondition(condition) && condition.operator === 'OR' ? 'OR' : 'AND',
      rows: flattenWhereClause(stateItems.missingMisc, fieldWrapperWithParentKey, condition, 0),
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
  let expressionCondition: ExpressionConditionType;
  let expressionGroup: ExpressionGroupType = currentGroup;
  let closeGroup = false;
  /** if a new group is initialized, the operator is following the first condition */
  let needsGroupOperator = false;

  let condition = where.left as Condition;
  const isNegation = condition == null || isNegationCondition(condition);
  let priorConditionIsNegation = false;

  if (!isValueQueryCondition(condition)) {
    // init group if there are open parens
    const requiredOpeningParens = isNegationCondition(where) ? 2 : 1;
    if (where.left?.openParen >= requiredOpeningParens && !expressionGroup) {
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
      let resourceTypes: ListItem<ExpressionRowValueType, any>[] = undefined;
      const operator = getOperatorFromWhereClause(condition.operator, condition.value as string, priorConditionIsNegation);
      if (field.type === 'date') {
        resourceTypes = getDateResourceTypes();
      } else if (field.type === 'datetime') {
        resourceTypes = getDateTimeResourceTypes();
      }
      if (field) {
        expressionCondition = {
          key: currKey,
          resourceSelectItems: [],
          resourceType: getTypeFromMetadata(field.type, operator),
          resourceTypes,
          selected: {
            resource: fieldKey,
            resourceMeta: fieldMetadata,
            resourceGroup: parentKey,
            operator,
            value: ['isNull', 'isNotNull'].includes(operator) ? '' : removeQuotes(condition.value),
          },
        };
      } else {
        missingMisc.push(`Filter ${condition.field} was not found`);
      }

      const requiredClosingParens = isNegationOperator(previousCondition?.selected?.operator) ? 2 : 1;
      closeGroup = condition?.closeParen >= requiredClosingParens;
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

function removeQuotes(values: string | string[] | DateLiteral[]): string | string[] | DateLiteral[] {
  if (isString(values)) {
    return values.replace(REGEX.START_END_SINGLE_QUOTE, '');
  } else if (Array.isArray(values)) {
    return (values as any[]).map((value) => (isString(value) ? value.replace(REGEX.START_END_SINGLE_QUOTE, '') : value));
  }
  return values;
}

function processOrderBy(
  stateItems: Partial<QueryRestoreStateItems>,
  query: Query,
  fieldWrapperWithParentKey: MapOf<FieldWrapperWithParentKey>
) {
  if (query.orderBy) {
    const orderByClauses = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    stateItems.queryOrderByState = orderByClauses
      .filter((orderBy) => isOrderByField(orderBy))
      .map((orderBy: OrderByFieldClause, i) => {
        const foundField = fieldWrapperWithParentKey[orderBy.field.toLowerCase()];
        if (!foundField) {
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
      .filter((orderBy) => !!orderBy);
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
  metadataTree: MapOf<QueryRestoreMetadataTree>,
  stateItems: Partial<QueryRestoreStateItems>,
  subqueryRelationshipName?: string
) {
  const {
    missingFields: missingFieldsTemp,
    missingSubqueryFields,
    missingMisc,
    queryFieldsMapState: queryFieldsMap,
    selectedQueryFieldsState: selectedQueryFieldsTemp,
    selectedSubqueryFieldsState: selectedSubqueryFields,
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
      } else {
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
function updateQueryFieldsMapForRelatedFields(
  queryFieldsMap: MapOf<QueryFields>,
  baseKey: string,
  metadataTree: MapOf<QueryRestoreMetadataTree>
) {
  function traverseChildren(children: QueryRestoreMetadataTree[], parentKey: string) {
    children.forEach((currNode) => {
      const fieldMapItem = initQueryFieldStateItem(currNode.fieldKey, currNode.metadata.name);
      const sobjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(currNode.metadata);
      queryFieldsMap[currNode.fieldKey] = fetchFieldsProcessResults(sobjectResults, fieldMapItem, currNode.fieldKey);
      traverseChildren(currNode.children, currNode.fieldKey);
    });
  }

  Object.keys(metadataTree).forEach((key) => {
    const currNode = metadataTree[key];
    const fieldMapItem = initQueryFieldStateItem(currNode.fieldKey, currNode.metadata.name);
    const sobjectResults = convertDescribeToDescribeSObjectWithExtendedTypes(currNode.metadata);
    queryFieldsMap[currNode.fieldKey] = fetchFieldsProcessResults(sobjectResults, fieldMapItem, currNode.fieldKey);
    traverseChildren(currNode.children, currNode.fieldKey);
  });
}

function getMapOfKeyToMetadataTreeNode(metadataTree: MapOf<QueryRestoreMetadataTree>) {
  const output: MapOf<QueryRestoreMetadataTree> = {};

  function traverseChildren(children: QueryRestoreMetadataTree[]) {
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

/**
 * 1. Parse Query
 * 2. Traverse entire query and fetch metadata for all objects included in query
 * 3. return results
 *
 * @param soql
 */
async function queryRestoreFetchData(org: SalesforceOrgUi, query: Query, isTooling = false): Promise<QueryRestoreFetchOutput> {
  // fetch initial sobject metadata
  const { data: describeResults } = await describeGlobal(org, isTooling);
  const selectedSobjectMetadata = describeResults.sobjects.find((item) => item.name.toLowerCase() === query.sObject.toLowerCase());
  if (!selectedSobjectMetadata) {
    throw new UserFacingRestoreError(`Object ${query.sObject} was not found in org`);
  }

  const { data: rootSobjectDescribe } = await describeSObject(org, selectedSobjectMetadata.name, isTooling);

  const output: QueryRestoreFetchOutput = {
    sobjectMetadata: describeResults.sobjects,
    selectedSobjectMetadata: {
      global: selectedSobjectMetadata,
      sobject: rootSobjectDescribe,
    },
    metadata: {},
    childMetadata: {},
    lowercaseFieldMap: getLowercaseFieldMap(rootSobjectDescribe.fields),
  };

  const parsableFields = getFieldsFromAllPartsOfQuery(query);
  output.metadata = await fetchAllMetadata(org, isTooling, rootSobjectDescribe, parsableFields.fields);

  getLowercaseFieldMapWithFullPath(output.metadata, output.lowercaseFieldMap);

  for (const childRelationship in parsableFields.subqueries) {
    const foundRelationship = rootSobjectDescribe.childRelationships.find(
      (currChildRelationship) => currChildRelationship.relationshipName === childRelationship
    );
    if (foundRelationship) {
      const { data: rootSobjectChildDescribe } = await describeSObject(org, foundRelationship.childSObject, isTooling);
      output.childMetadata[childRelationship] = {
        objectMetadata: rootSobjectChildDescribe,
        metadataTree: await fetchAllMetadata(
          org,
          isTooling,
          rootSobjectChildDescribe,
          parsableFields.subqueries[childRelationship],
          childRelationship
        ),
      };
    }
  }
  // return output as QueryRestoreFetchOutput;
  return output;
}

function getFieldsFromAllPartsOfQuery(query: Query): ParsableFields {
  const parsableFields = getParsableFields(query.fields);

  parsableFields.fields = parsableFields.fields.concat(getParsableFieldsFromFilter(query.where));

  if (query.orderBy) {
    const orderBy = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    orderBy
      .filter((clause) => isOrderByField(clause))
      .forEach((orderBy: OrderByFieldClause) => {
        parsableFields.fields.push(orderBy.field);
      });
  }

  return parsableFields;
}

/**
 * Extract and sort all fields from a parsed query
 * recursive for subqueries
 *
 * All fields are normalized to lowercase
 *
 * @param fields
 */
function getParsableFields(fields: QueryFieldType[]): ParsableFields {
  const sortedOutput = fields.reduce(
    (output: ParsableFields, field) => {
      if (field.type === 'Field') {
        output.fields.push(field.field);
      } else if (field.type === 'FieldRelationship') {
        output.fields.push(field.rawValue);
      } else if (field.type === 'FieldTypeof') {
        const [firstCondition] = field.conditions;
        firstCondition.fieldList.forEach((typeofField) =>
          output.fields.push(`${firstCondition.objectType}${TYPEOF_SEPARATOR}${field.field}.${typeofField}`)
        );
      } else if (field.type === 'FieldSubquery') {
        output.subqueries[field.subquery.relationshipName] = getParsableFields(field.subquery.fields).fields;
      }
      return output;
    },
    { fields: [], subqueries: {} }
  );

  sortedOutput.fields = orderStringsBy(sortedOutput.fields.map((field) => field.toLowerCase()));

  return sortedOutput;
}

function getParsableFieldsFromFilter(where: WhereClause, fields: string[] = []): string[] {
  if (!where) {
    return fields;
  }
  if (isValueCondition(where.left)) {
    fields.push(where.left.field);
  }
  if (isWhereOrHavingClauseWithRightCondition(where)) {
    getParsableFieldsFromFilter(where.right, fields);
  }
  return fields;
}

/**
 * Fetch all metadata
 * @param describeSobject
 * @param fields
 */
async function fetchAllMetadata(
  org: SalesforceOrgUi,
  isTooling: boolean,
  describeSobject: DescribeSObjectResult,
  parsableFields: string[],
  subqueryRelationshipName?: string
) {
  const fields = findRequiredRelationships(parsableFields);
  const baseKey = subqueryRelationshipName
    ? getSubqueryFieldBaseKey(describeSobject.name, subqueryRelationshipName)
    : getQueryFieldBaseKey(describeSobject.name);
  const metadata = await fetchRecursiveMetadata(org, isTooling, fields, describeSobject, baseKey);
  return metadata;
}

/**
 * Reduce all fields into a set of relationships
 * Input: ['LastModifiedBy.Account.LastModifiedBy.Foo', 'Parent.Name'];
 * Output: ["LastModifiedBy", "LastModifiedBy.Account", "LastModifiedBy.Account.LastModifiedBy", "Parent"]
 *
 *
 * @param fields
 * @returns required relationships
 */
function findRequiredRelationships(fields: string[]): string[] {
  const fieldRelationships = new Set<string>();
  fields
    .map((field) => {
      const fieldParts = field.split('.');
      fieldParts.pop();
      return fieldParts;
    })
    .forEach((field) => {
      let currPart = '';
      field.forEach((part) => {
        if (currPart) {
          currPart += '.';
        }
        currPart += part;
        fieldRelationships.add(currPart);
      });
    });
  return Array.from(fieldRelationships);
}

async function fetchRecursiveMetadata(
  org: SalesforceOrgUi,
  isTooling: boolean,
  fieldRelationships: string[],
  parentMetadata: DescribeSObjectResult,
  parentKey: string,
  output: MapOf<QueryRestoreMetadataTree> = {},
  parentNode: QueryRestoreMetadataTree = null
): Promise<MapOf<QueryRestoreMetadataTree>> {
  // filter items to keep fields without any children relationships to fetch metadata
  const currRelationships = fieldRelationships.filter((field) => field.indexOf('.') === -1);
  if (currRelationships.length === 0) {
    return output;
  }

  for (let currRelationship of currRelationships) {
    try {
      let relatedObject: string;
      if (currRelationship.includes(TYPEOF_SEPARATOR)) {
        const [typeofObject, relationship] = currRelationship.split(TYPEOF_SEPARATOR);
        relatedObject = typeofObject;
        currRelationship = relationship;
      }
      const field = parentMetadata.fields.find(
        (field) => field.relationshipName && field.relationshipName.toLowerCase() === currRelationship
      );

      if (field && Array.isArray(field.referenceTo) && field.referenceTo.length) {
        // TYPEOF fields use a different object aside from the first one
        // if the data is available, then find the exact object and fallback to the first object
        let relatedSObject = field.referenceTo[0];
        if (field.referenceTo.length > 1 && relatedObject) {
          relatedSObject = field.referenceTo.find((obj) => obj.toLowerCase() === relatedObject) || field.referenceTo[0];
        }
        const { data: relatedDescribeResults } = await describeSObject(org, relatedSObject, isTooling);

        let currNode: QueryRestoreMetadataTree;
        const lowercaseFieldMap = getLowercaseFieldMap(relatedDescribeResults.fields);

        if (parentNode == null) {
          output[currRelationship] = {
            key: currRelationship,
            parentField: field,
            fieldKey: getFieldKey(parentKey, field),
            level: 0,
            metadata: relatedDescribeResults,
            lowercaseFieldMap,
            children: [],
          };
          currNode = output[currRelationship];
        } else {
          currNode = {
            key: `${parentNode.key}.${currRelationship}`,
            parentField: field,
            fieldKey: getFieldKey(parentKey, field),
            level: parentNode.level + 1,
            metadata: relatedDescribeResults,
            lowercaseFieldMap,
            children: [],
          };
          parentNode.children.push(currNode);
        }

        // Fetch all ancestor metadata, ignore results because output is mutated
        // remove first segment as it has been fetched
        const ancestorRelationships = fieldRelationships
          .filter((field) => field.indexOf('.') > -1 && field.startsWith(`${currRelationship}.`))
          .map((field) => field.slice(field.indexOf('.') + 1));
        if (ancestorRelationships.length > 0 && currNode.level <= 5) {
          await fetchRecursiveMetadata(org, isTooling, ancestorRelationships, relatedDescribeResults, currNode.fieldKey, output, currNode);
        }
      }
    } catch (ex) {
      // could not get metadata - will be handled later
      logger.error('Restore Error', ex);
    }
  }
  return output;
}

function getLowercaseFieldMap(fields: Field[]) {
  return fields.reduce((lowercaseFieldMap: MapOf<Field>, field) => {
    lowercaseFieldMap[field.name.toLowerCase()] = field;
    return lowercaseFieldMap;
  }, {});
}

/**
 * Combine all lowercaseFieldMaps into one object with the full field path
 *
 * @param metadata
 * @param output - optional, object to add items to
 */
function getLowercaseFieldMapWithFullPath(metadata: MapOf<QueryRestoreMetadataTree>, output: MapOf<Field> = {}) {
  function updateOutput(lowercaseFieldMap: MapOf<Field>, parentKey: string) {
    Object.keys(lowercaseFieldMap).forEach((fieldKey) => {
      output[`${parentKey}.${fieldKey}`] = lowercaseFieldMap[fieldKey];
    });
  }

  function handleChildren({ key, lowercaseFieldMap, children }: QueryRestoreMetadataTree) {
    updateOutput(lowercaseFieldMap, key);
    children.forEach(handleChildren);
  }

  Object.values(metadata).forEach(({ key, lowercaseFieldMap, children }) => {
    updateOutput(lowercaseFieldMap, key);
    children.forEach(handleChildren);
  });

  return output;
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

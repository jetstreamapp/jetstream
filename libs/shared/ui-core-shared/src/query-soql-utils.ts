import { logger } from '@jetstream/shared/client-logger';
import { MAX_SUBQUERY_DEPTH } from '@jetstream/shared/constants';
import { describeGlobal, describeSObject } from '@jetstream/shared/data';
import { getFieldKey } from '@jetstream/shared/ui-utils';
import {
  getSubqueryParentPath,
  getSubqueryPath,
  getSubqueryPathDepth,
  getSubqueryRelationshipName,
  orderValues,
} from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, DescribeSObjectResult, Field, Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
  OrderByClause,
  Query,
  FieldType as QueryFieldType,
  WhereClause,
  isOrderByField,
  isValueCondition,
  isValueFunctionCondition,
  isWhereOrHavingClauseWithRightCondition,
} from '@jetstreamapp/soql-parser-js';
import isString from 'lodash/isString';
import { getQueryFieldBaseKey, getSubqueryFieldBaseKey } from './query-fields-utils';

export interface SoqlMetadataTree {
  key: string;
  parentField: Field;
  fieldKey: string;
  parentKey?: string;
  level: number; // do not allow beyond 5
  metadata: DescribeSObjectResult;
  lowercaseFieldMap: Record<string, Field>;
  children: SoqlMetadataTree[];
}

export interface SoqlFetchMetadataOutput {
  sobjectMetadata: DescribeGlobalSObjectResult[];
  selectedSobjectMetadata: { global: DescribeGlobalSObjectResult; sobject: DescribeSObjectResult };
  metadata: Record<string, SoqlMetadataTree>;
  /** Keyed by the canonical relationship path from the root object, e.x. `Contacts` or `Contacts.Cases` */
  childMetadata: {
    [childRelationshipPath: string]: {
      objectMetadata: DescribeSObjectResult;
      metadataTree: Record<string, SoqlMetadataTree>;
      // includes full path
      lowercaseFieldMap: Record<string, Field>;
    };
  };
  // includes full path
  lowercaseFieldMap: Record<string, Field>;
}
interface ParsableFields {
  fields: string[];
  /** Keyed by the relationship path from the root object, using the casing found in the query */
  subqueries: { [childRelationshipPath: string]: string[] };
}

const TYPEOF_SEPARATOR = '!';

/**
 * Use provided cache if available
 * This skips the cache at the data-helper layer to avoid unnecessary serialization/de-serialization
 *
 * @param org
 * @param SObject
 * @param isTooling
 * @param describeCache
 * @returns
 */
async function describeSObjectWithLocalCache(
  org: SalesforceOrgUi,
  SObject: string,
  isTooling = false,
  describeCache: Record<string, DescribeSObjectResult>,
): Promise<DescribeSObjectResult> {
  if (describeCache[SObject]) {
    return describeCache[SObject];
  }
  const { data } = await describeSObject(org, SObject, isTooling);
  describeCache[SObject] = data;
  return data;
}

/**
 * Get metadata for every object
 *
 * 1. Parse Query
 * 2. Traverse fields OR entire query and fetch metadata for all objects included in query
 * 3. return results
 *
 * @param includeEntireQuery Include just fields from query or entire query
 */
export async function fetchMetadataFromSoql(
  org: SalesforceOrgUi,
  query: Query,
  includeEntireQuery = false,
  isTooling = false,
): Promise<SoqlFetchMetadataOutput> {
  // fetch initial sobject metadata
  const { data: describeResults } = await describeGlobal(org, isTooling);
  const selectedSobjectMetadata = describeResults.sobjects.find((item) => item.name.toLowerCase() === query.sObject?.toLowerCase());
  if (!selectedSobjectMetadata) {
    throw new Error(`Object ${query.sObject} was not found in org`);
  }

  const describeCache: Record<string, DescribeSObjectResult> = {};

  const rootSobjectDescribe = await describeSObjectWithLocalCache(org, selectedSobjectMetadata.name, isTooling, describeCache);

  const output: SoqlFetchMetadataOutput = {
    sobjectMetadata: describeResults.sobjects,
    selectedSobjectMetadata: {
      global: selectedSobjectMetadata,
      sobject: rootSobjectDescribe,
    },
    metadata: {},
    childMetadata: {},
    lowercaseFieldMap: getLowercaseFieldMap(rootSobjectDescribe.fields),
  };

  const parsableFields = includeEntireQuery ? getFieldsFromAllPartsOfQuery(query) : getParsableFields(query.fields || []);
  output.metadata = await fetchAllMetadata(org, isTooling, rootSobjectDescribe, parsableFields.fields, describeCache);

  // add entries to lowercaseFieldMap for all related objects
  getLowercaseFieldMapWithFullPath(output.metadata, output.lowercaseFieldMap);

  // Subqueries are resolved shallowest first so that each level can be looked up against its own parent's describe
  const describeByCanonicalPath: Record<string, DescribeSObjectResult> = { '': rootSobjectDescribe };
  const canonicalPathByQueryPath: Record<string, string> = { '': '' };
  const relationshipPaths = Object.keys(parsableFields.subqueries).sort(
    (pathA, pathB) => getSubqueryPathDepth(pathA) - getSubqueryPathDepth(pathB),
  );

  for (const relationshipPath of relationshipPaths) {
    if (getSubqueryPathDepth(relationshipPath) > MAX_SUBQUERY_DEPTH) {
      continue;
    }
    // An unresolved parent means nothing nested within it can be resolved either
    const parentCanonicalPath = canonicalPathByQueryPath[getSubqueryParentPath(relationshipPath).toLowerCase()];
    if (parentCanonicalPath === undefined) {
      continue;
    }
    const relationshipName = getSubqueryRelationshipName(relationshipPath);
    const foundRelationship = describeByCanonicalPath[parentCanonicalPath].childRelationships.find(
      (currChildRelationship) => currChildRelationship.relationshipName?.toLowerCase() === relationshipName.toLowerCase(),
    );
    if (!foundRelationship?.relationshipName) {
      continue;
    }
    // Use the canonical relationship name from Salesforce metadata for consistent downstream lookups
    const canonicalPath = getSubqueryPath(parentCanonicalPath, foundRelationship.relationshipName);
    const childDescribe = await describeSObjectWithLocalCache(org, foundRelationship.childSObject, isTooling, describeCache);

    describeByCanonicalPath[canonicalPath] = childDescribe;
    canonicalPathByQueryPath[relationshipPath.toLowerCase()] = canonicalPath;

    output.childMetadata[canonicalPath] = {
      objectMetadata: childDescribe,
      metadataTree: await fetchAllMetadata(
        org,
        isTooling,
        childDescribe,
        parsableFields.subqueries[relationshipPath],
        describeCache,
        canonicalPath,
      ),
      lowercaseFieldMap: getLowercaseFieldMap(childDescribe.fields),
    };

    // add entries to lowercaseFieldMap for all related objects
    getLowercaseFieldMapWithFullPath(
      output.childMetadata[canonicalPath].metadataTree,
      output.childMetadata[canonicalPath].lowercaseFieldMap,
    );
  }
  // return output as SoqlFetchMetadataOutput;
  return output;
}

function getFieldsFromAllPartsOfQuery(query: Query): ParsableFields {
  const parsableFields = getParsableFields(query.fields || []);

  parsableFields.fields = parsableFields.fields.concat(getParsableFieldsFromFilter(query.where));
  parsableFields.fields = parsableFields.fields.concat(getParsableFieldsFromOrderBy(query.orderBy));

  return parsableFields;
}

function getParsableFieldsFromOrderBy(orderBy: Maybe<OrderByClause | OrderByClause[]>): string[] {
  if (!orderBy) {
    return [];
  }
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return clauses.filter(isOrderByField).map((clause) => clause.field.toLowerCase());
}

/**
 * Extract and sort all fields from a parsed query
 * recursive for subqueries, which are keyed by their full relationship path from the root object
 *
 * All fields are normalized to lowercase
 *
 * @param fields
 * @param parentRelationshipPath path to the subquery these fields belong to, empty for the root object
 */
function getParsableFields(fields: QueryFieldType[], parentRelationshipPath = ''): ParsableFields {
  const sortedOutput = fields.reduce(
    (output: ParsableFields, field) => {
      if (field.type === 'Field') {
        output.fields.push(field.field);
      }
      if (field.type === 'FieldFunctionExpression') {
        if (isString(field.parameters[0])) {
          output.fields.push(field.parameters[0]);
        }
      } else if (field.type === 'FieldRelationship') {
        output.fields.push(field.rawValue || '');
      } else if (field.type === 'FieldTypeof') {
        const [firstCondition] = field.conditions;
        firstCondition.fieldList.forEach((typeofField) =>
          output.fields.push(`${firstCondition.objectType}${TYPEOF_SEPARATOR}${field.field}.${typeofField}`),
        );
      } else if (field.type === 'FieldSubquery') {
        const relationshipPath = getSubqueryPath(parentRelationshipPath, field.subquery.relationshipName);
        const nestedFields = getParsableFields(field.subquery.fields || [], relationshipPath);
        const subqueryFilterFields = getParsableFieldsFromFilter(field.subquery.where).map((fieldName) => fieldName.toLowerCase());
        const subqueryOrderByFields = getParsableFieldsFromOrderBy(field.subquery.orderBy).map((fieldName) => fieldName.toLowerCase());
        output.subqueries[relationshipPath] = orderValues(
          Array.from(new Set([...nestedFields.fields, ...subqueryFilterFields, ...subqueryOrderByFields])),
        );
        // Nested subqueries are already keyed by their full path, so they can be hoisted into the flat map
        Object.assign(output.subqueries, nestedFields.subqueries);
      }
      return output;
    },
    { fields: [], subqueries: {} },
  );

  sortedOutput.fields = orderValues(sortedOutput.fields.map((field) => field.toLowerCase()));

  return sortedOutput;
}

function getParsableFieldsFromFilter(where: Maybe<WhereClause>, fields: string[] = []): string[] {
  if (!where) {
    return fields;
  }
  if (isValueCondition(where.left)) {
    fields.push(where.left.field?.toLowerCase());
  }
  if (isValueFunctionCondition(where.left) && Array.isArray(where.left.fn.parameters) && isString(where.left.fn.parameters[0])) {
    fields.push(where.left.fn.parameters[0].toLowerCase());
  }
  if (isWhereOrHavingClauseWithRightCondition(where)) {
    getParsableFieldsFromFilter(where.right, fields);
  }
  return Array.from(new Set(fields));
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
  describeCache: Record<string, DescribeSObjectResult>,
  subqueryRelationshipPath?: string,
) {
  const fields = findRequiredRelationships(parsableFields);
  const baseKey = subqueryRelationshipPath
    ? getSubqueryFieldBaseKey(describeSobject.name, subqueryRelationshipPath)
    : getQueryFieldBaseKey(describeSobject.name);
  const metadata = await fetchRecursiveMetadata(org, isTooling, fields, describeSobject, baseKey, describeCache);
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
  describeCache: Record<string, DescribeSObjectResult>,
  output: Record<string, SoqlMetadataTree> = {},
  parentNode: SoqlMetadataTree | null = null,
): Promise<Record<string, SoqlMetadataTree>> {
  // filter items to keep fields without any children relationships to fetch metadata
  const currRelationships = fieldRelationships.filter((field) => field.indexOf('.') === -1);
  if (currRelationships.length === 0) {
    return output;
  }

  for (let currRelationship of currRelationships) {
    try {
      let relatedObject: string | undefined = undefined;
      if (currRelationship.includes(TYPEOF_SEPARATOR)) {
        const [typeofObject, relationship] = currRelationship.split(TYPEOF_SEPARATOR);
        relatedObject = typeofObject;
        currRelationship = relationship;
      }
      const field = parentMetadata.fields.find(
        (field) => field.relationshipName && field.relationshipName.toLowerCase() === currRelationship,
      );

      if (field && Array.isArray(field.referenceTo) && field.referenceTo.length) {
        // TYPEOF fields use a different object aside from the first one
        // if the data is available, then find the exact object and fallback to the first object
        let relatedSObject = field.referenceTo[0];
        if (field.referenceTo.length > 1 && relatedObject) {
          relatedSObject = field.referenceTo.find((obj) => obj.toLowerCase() === relatedObject) || field.referenceTo[0];
        }
        const relatedDescribeResults = await describeSObjectWithLocalCache(org, relatedSObject, isTooling, describeCache);

        let currNode: SoqlMetadataTree;
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
          await fetchRecursiveMetadata(
            org,
            isTooling,
            ancestorRelationships,
            relatedDescribeResults,
            currNode.fieldKey,
            describeCache,
            output,
            currNode,
          );
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
  return fields.reduce((lowercaseFieldMap: Record<string, Field>, field) => {
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
function getLowercaseFieldMapWithFullPath(metadata: Record<string, SoqlMetadataTree>, output: Record<string, Field> = {}) {
  function updateOutput(lowercaseFieldMap: Record<string, Field>, parentKey: string) {
    Object.keys(lowercaseFieldMap).forEach((fieldKey) => {
      output[`${parentKey}.${fieldKey}`] = lowercaseFieldMap[fieldKey];
    });
  }

  function handleChildren({ key, lowercaseFieldMap, children }: SoqlMetadataTree) {
    updateOutput(lowercaseFieldMap, key);
    children.forEach(handleChildren);
  }

  Object.values(metadata).forEach(({ key, lowercaseFieldMap, children }) => {
    updateOutput(lowercaseFieldMap, key);
    children.forEach(handleChildren);
  });

  return output;
}

export const __TEST_EXPORTS__ = {
  getFieldsFromAllPartsOfQuery,
  getParsableFields,
  getParsableFieldsFromFilter,
  getParsableFieldsFromOrderBy,
  fetchAllMetadata,
  findRequiredRelationships,
  fetchRecursiveMetadata,
  getLowercaseFieldMap,
  getLowercaseFieldMapWithFullPath,
};

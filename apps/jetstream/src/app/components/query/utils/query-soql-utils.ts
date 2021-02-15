import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, describeSObject } from '@jetstream/shared/data';
import { getFieldKey } from '@jetstream/shared/ui-utils';
import { orderStringsBy } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { DescribeGlobalSObjectResult, DescribeSObjectResult, Field } from 'jsforce';
import {
  FieldType as QueryFieldType,
  isOrderByField,
  isValueCondition,
  isWhereOrHavingClauseWithRightCondition,
  OrderByFieldClause,
  Query,
  WhereClause,
} from 'soql-parser-js';
import { getQueryFieldBaseKey, getSubqueryFieldBaseKey } from './query-fields-utils';

export interface SoqlMetadataTree {
  key: string;
  parentField: Field;
  fieldKey: string;
  parentKey?: string;
  level: number; // do not allow beyond 5
  metadata: DescribeSObjectResult;
  lowercaseFieldMap: MapOf<Field>;
  children: SoqlMetadataTree[];
}

export interface SoqlFetchMetadataOutput {
  sobjectMetadata: DescribeGlobalSObjectResult[];
  selectedSobjectMetadata: { global: DescribeGlobalSObjectResult; sobject: DescribeSObjectResult };
  metadata: MapOf<SoqlMetadataTree>;
  childMetadata: {
    [childRelationshipName: string]: {
      objectMetadata: DescribeSObjectResult;
      metadataTree: MapOf<SoqlMetadataTree>;
    };
  };
  // includes full path
  lowercaseFieldMap: MapOf<Field>;
}
interface ParsableFields {
  fields: string[];
  subqueries: { [childRelationshipName: string]: string[] };
}

const TYPEOF_SEPARATOR = '!';

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
  isTooling = false
): Promise<SoqlFetchMetadataOutput> {
  // fetch initial sobject metadata
  const { data: describeResults } = await describeGlobal(org, isTooling);
  const selectedSobjectMetadata = describeResults.sobjects.find((item) => item.name.toLowerCase() === query.sObject.toLowerCase());
  if (!selectedSobjectMetadata) {
    throw new Error(`Object ${query.sObject} was not found in org`);
  }

  const { data: rootSobjectDescribe } = await describeSObject(org, selectedSobjectMetadata.name, isTooling);

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

  const parsableFields = includeEntireQuery ? getFieldsFromAllPartsOfQuery(query) : getParsableFields(query.fields);
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
  // return output as SoqlFetchMetadataOutput;
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
  output: MapOf<SoqlMetadataTree> = {},
  parentNode: SoqlMetadataTree = null
): Promise<MapOf<SoqlMetadataTree>> {
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
function getLowercaseFieldMapWithFullPath(metadata: MapOf<SoqlMetadataTree>, output: MapOf<Field> = {}) {
  function updateOutput(lowercaseFieldMap: MapOf<Field>, parentKey: string) {
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

import { describeSObject, genericRequest, query, queryWithCache } from '@jetstream/shared/data';
import { CompositeRequest, CompositeRequestBody, CompositeResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FieldDefinition } from '@jetstream/types';
import { REGEX, getMapOf, alwaysResolve, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { FieldWrapper, QueryFields } from '@jetstream/types';
import { Field } from 'jsforce';
import { composeQuery, getField } from 'soql-parser-js';
import { getFieldDefinitionQuery } from './queries';
import { polyfillFieldDefinition, sortQueryFields } from './shared-ui-utils';

export function buildQuery(sObject: string, fields: string[]) {
  return composeQuery({ sObject, fields: fields.map((field) => getField(field)) }, { format: true });
}

export function getFieldKey(parentKey: string, field: Field) {
  return `${parentKey}${field.relationshipName}.`;
}

/**
 * Fetch fields and add to queryFields
 */
export async function fetchFields(org: SalesforceOrgUi, queryFields: QueryFields, parentKey: string): Promise<QueryFields> {
  const { sobject } = queryFields;
  const [describeResultsWithCache, queryResultsWithCache] = await Promise.all([
    describeSObject(org, sobject),
    alwaysResolve(queryWithCache<FieldDefinition>(org, getFieldDefinitionQuery(sobject), true), undefined),
  ]);
  // unwrap cache
  const describeResults = describeResultsWithCache.data;
  const queryResults = queryResultsWithCache.data;

  // TODO: we can possibly remove this - roll-up fields and some others might not be optimal
  // but some objects (user) fail and it does require an additional api call - so ditching it could be a benefit
  const fieldDefByApiName: MapOf<FieldDefinition> = {};
  if (queryResults?.queryResults?.records) {
    // fieldDefByApiName = getMapOf(queryResults?.queryResults?.records, 'QualifiedApiName');
  }

  const childRelationships = describeResults.childRelationships.filter((relationship) => !!relationship.relationshipName);

  const fields: MapOf<FieldWrapper> = getMapOf(
    sortQueryFields(describeResults.fields).map((field: Field) => {
      const type = fieldDefByApiName[field.name]?.DataType || polyfillFieldDefinition(field);
      const filterText = `${field.name || ''}${field.label || ''}${type}${type.replace(REGEX.NOT_ALPHA, '')}`.toLowerCase();
      return {
        name: field.name,
        label: field.label,
        type,
        sobject,
        relatedSobject: field.type === 'reference' && field.referenceTo?.length ? field.referenceTo[0] : undefined,
        filterText,
        metadata: field,
        fieldDefinition: fieldDefByApiName[field.name],
        relationshipKey: field.type === 'reference' && field.referenceTo?.length ? getFieldKey(parentKey, field) : undefined,
      };
    }),
    'name'
  );

  return { ...queryFields, fields, visibleFields: new Set(Object.keys(fields)), childRelationships };
}

/**
 * For the provided ids, fetch each record using the composite API
 * These are automatically split into sets of up to 25 records
 *
 * The referenceId is set to the recordId
 *
 * @param selectedOrg
 * @param metadataType
 * @param recordIds
 * @param fields
 * @param apiVersion
 */
export async function getToolingRecords<T>(
  selectedOrg: SalesforceOrgUi,
  metadataType: string,
  recordIds: string[],
  fields: string[] = ['Id', 'FullName', 'Metadata'],
  apiVersion = 'v49.0' // TODO: remove hard-coded id
): Promise<CompositeResponse<T>> {
  const compositeRequests = recordIds.map(
    (id): CompositeRequestBody => ({
      method: 'GET',
      url: `/services/data/${apiVersion}/tooling/sobjects/${metadataType}/${id}?fields=${fields.join(',')}`,
      referenceId: id,
    })
  );
  return await makeToolingRequests<T>(selectedOrg, compositeRequests, apiVersion, false);
}

/**
 * Submit tooling requests using the composite API which allows 25 records to be processed at once
 * Requests are automatically split into sets of 25 records
 *
 * @param selectedOrg
 * @param compositeRequests
 * @param apiVersion
 * @param allOrNone
 */
export async function makeToolingRequests<T>(
  selectedOrg: SalesforceOrgUi,
  compositeRequests: CompositeRequestBody[],
  apiVersion = 'v49.0', // TODO: remove hard-coded id
  allOrNone = false
): Promise<CompositeResponse<T>> {
  const compositeRequestSets = splitArrayToMaxSize(compositeRequests, 25);
  let results: CompositeResponse<T>;
  for (const compositeRequest of compositeRequestSets) {
    const response = await genericRequest<CompositeResponse<T>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: { allOrNone, compositeRequest },
    });
    if (!results) {
      results = response;
    } else {
      results.compositeResponse = results.compositeResponse.concat(response.compositeResponse);
    }
  }
  return results;
}

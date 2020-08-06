import { describeSObject, query } from '@jetstream/shared/data';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FieldDefinition } from '@jetstream/types';
import { REGEX, getMapOf, alwaysResolve } from '@jetstream/shared/utils';
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
  const [describeResults, queryResults] = await Promise.all([
    describeSObject(org, sobject),
    alwaysResolve(query<FieldDefinition>(org, getFieldDefinitionQuery(sobject), true), undefined),
  ]);

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

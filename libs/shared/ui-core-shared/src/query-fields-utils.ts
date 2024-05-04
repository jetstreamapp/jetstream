import { sortQueryFieldsPolymorphicComparable } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { QueryFields, QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';

export const CHILD_FIELD_SEPARATOR = `~`;
export const BASE_FIELD_SEPARATOR = `|`;

// used to uniquely identify the current object being processed
export function getQueryFieldKey(selectedOrg: SalesforceOrgUi, selectedSObject: string): string {
  return `${selectedOrg?.uniqueId}-${selectedSObject}`;
}

export function getChildQueryFieldKey(selectedOrg: SalesforceOrgUi, selectedSObject: string, parentRelationshipName: string): string {
  return `${selectedOrg?.uniqueId}-${selectedSObject}-${parentRelationshipName}`;
}

// all field keys start with the based key
export function getQueryFieldBaseKey(selectedSObject: string) {
  return `${selectedSObject}${BASE_FIELD_SEPARATOR}`;
}

export function getSubqueryFieldBaseKey(childSobject: string, relationshipName: string) {
  return `${childSobject}${CHILD_FIELD_SEPARATOR}${relationshipName}${BASE_FIELD_SEPARATOR}`;
}

export function initQueryFieldStateItem(key: string, sobject: string, props: Partial<QueryFields> = {}): QueryFields {
  return {
    key,
    expanded: true,
    loading: false,
    isPolymorphic: false,
    hasError: false,
    filterTerm: '',
    sobject,
    fields: {},
    visibleFields: new Set(),
    selectedFields: new Set(),
    ...props,
  };
}

export function getSelectedFieldsFromQueryFields(fieldsMap: Record<string, QueryFields>): QueryFieldWithPolymorphic[] {
  const fields: QueryFieldWithPolymorphic[] = orderObjectsBy(
    Object.values(fieldsMap)
      .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
      .flatMap((queryField) => {
        const basePath = queryField.key.replace(/.+\|/, '');
        return Array.from(queryField.selectedFields).map((field): QueryFieldWithPolymorphic => {
          return {
            field: `${basePath}${field}`,
            polymorphicObj: queryField.isPolymorphic ? queryField.sobject : undefined,
            metadata: queryField.fields[field]?.metadata,
          };
        });
      }),
    'field'
  ).sort(sortQueryFieldsPolymorphicComparable);
  return fields;
}

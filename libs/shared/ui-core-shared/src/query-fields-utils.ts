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

export function getSubqueryFieldBaseKey(childSobject: string, relationshipPath: string) {
  return `${childSobject}${CHILD_FIELD_SEPARATOR}${relationshipPath}${BASE_FIELD_SEPARATOR}`;
}

/**
 * Pull the subquery relationship path back out of a fields map key, which looks like
 * `${childSobject}~${relationshipPath}|${optional.parent.path.}`.
 * Returns null for keys belonging to the base object, which have no `~` segment.
 */
export function getSubqueryPathFromFieldKey(key: string): string | null {
  const childSeparatorIndex = key.indexOf(CHILD_FIELD_SEPARATOR);
  if (childSeparatorIndex === -1) {
    return null;
  }
  const baseSeparatorIndex = key.indexOf(BASE_FIELD_SEPARATOR, childSeparatorIndex);
  return baseSeparatorIndex === -1 ? key.slice(childSeparatorIndex + 1) : key.slice(childSeparatorIndex + 1, baseSeparatorIndex);
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
    'field',
  ).sort(sortQueryFieldsPolymorphicComparable);
  return fields;
}

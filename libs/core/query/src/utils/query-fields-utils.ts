import { CHILD_FIELD_SEPARATOR } from '@jetstream/core/shared-ui';
import { sortQueryFieldsPolymorphicComparable } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { MapOf, QueryFields, QueryFieldWithPolymorphic } from '@jetstream/types';

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

export function getSelectedFieldsFromQueryFields(fieldsMap: MapOf<QueryFields>): QueryFieldWithPolymorphic[] {
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

import { ExpressionType, ListItemGroup, MapOf, QueryFields } from '@jetstream/types';
import { composeQuery, Query } from 'soql-parser-js';
import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';
import { Field } from 'jsforce';

const CHILD_FIELD_SEPARATOR = `~`;

export function composeSoqlQuery(query: Query, whereExpression: ExpressionType) {
  return composeQuery(
    { ...query, where: convertFiltersToWhereClause(whereExpression) },
    { format: true, formatOptions: { fieldMaxLineLength: 80 } }
  );
}

/**
 * Build all the data to show in the field filter
 * This omits any field that is not filterable
 *
 * @param queryFieldsMap Query fields with filter data
 */
export function calculateSoqlQueryFilter(queryFieldsMap: MapOf<QueryFields>, requiredMetadataProps?: [keyof Field]): ListItemGroup[] {
  const newFilterFields: ListItemGroup[] = [];

  function includeField(metadata: Field) {
    if (Array.isArray(requiredMetadataProps) && requiredMetadataProps.length > 0) {
      return requiredMetadataProps.every((prop) => metadata[prop]);
    }
    return true;
  }

  Object.values(queryFieldsMap)
    .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
    .forEach((queryField) => {
      const [base, path] = queryField.key.split('|');
      const currGroup: ListItemGroup = {
        id: queryField.key,
        label: path ? path.substring(0, path.length - 1) : base,
        items: [],
      };
      newFilterFields.push(currGroup);
      if (!path) {
        Object.values(queryField.fields)
          .filter(({ metadata }) => includeField(metadata))
          .forEach((field) => {
            const value = `${path || ''}${field.name}`;
            currGroup.items.push({
              id: value,
              label: field.label,
              secondaryLabel: `(${field.name})`,
              value: value,
              meta: field,
            });
          });
      } else {
        queryField.selectedFields.forEach((selectedFieldKey) => {
          const field = queryField.fields[selectedFieldKey];
          if (includeField(field.metadata)) {
            const value = `${path || ''}${field.name}`;
            currGroup.items.push({
              id: value,
              label: field.label,
              secondaryLabel: `(${field.name})`,
              value: value,
              meta: field,
            });
          }
        });
      }
    });
  return newFilterFields;
}

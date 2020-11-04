import { ExpressionType, ListItemGroup, MapOf, QueryFields } from '@jetstream/types';
import { composeQuery, Query } from 'soql-parser-js';
import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';

const CHILD_FIELD_SEPARATOR = `~`;

export function composeSoqlQuery(query: Query, whereExpression: ExpressionType) {
  return composeQuery(
    { ...query, where: convertFiltersToWhereClause(whereExpression) },
    { format: true, formatOptions: { fieldMaxLineLength: 80 } }
  );
}

/**
 * @param queryFieldsMap Query fields with filter data
 */
export function calculateSoqlQueryFilter(queryFieldsMap: MapOf<QueryFields>): ListItemGroup[] {
  const newFilterFields: ListItemGroup[] = [];
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
        Object.values(queryField.fields).forEach((field) => {
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
          const value = `${path || ''}${field.name}`;
          currGroup.items.push({
            id: value,
            label: field.label,
            secondaryLabel: `(${field.name})`,
            value: value,
            meta: field,
          });
        });
      }
    });
  return newFilterFields;
}

import { FieldType as QueryFieldType, isFieldSubquery } from '@jetstreamapp/soql-parser-js';

/**
 * Applies `columnOrder` to a subquery's own fields.
 *
 * The displayed columns are a flattened view of the query, so a subquery containing TYPEOF or FIELDS()
 * shows more columns than it has AST fields. Applying that permutation to the fields array would
 * reorder against the wrong list, so bail unless it maps onto the fields 1:1.
 */
export function applyColumnOrderToFields(subqueryFields: QueryFieldType[], columnOrder: number[]): QueryFieldType[] | null {
  if (columnOrder.length !== subqueryFields.length) {
    return null;
  }
  const reordered = columnOrder.map((index) => subqueryFields[index]);
  return reordered.every(Boolean) ? reordered : null;
}

/**
 * Returns a copy of `fields` with the subquery at `relationshipPathSegments` having its own fields reordered.
 * Recurses one relationship segment at a time so nested subqueries can be targeted.
 * Returns null when the path does not resolve, so the caller can leave the query alone.
 */
export function reorderSubqueryFields(
  fields: QueryFieldType[],
  relationshipPathSegments: string[],
  columnOrder: number[],
): QueryFieldType[] | null {
  const [relationshipName, ...remainingSegments] = relationshipPathSegments;
  if (!relationshipName) {
    return null;
  }
  let didResolve = false;
  const updatedFields = fields.map((field) => {
    if (!isFieldSubquery(field) || field.subquery.relationshipName.toLowerCase() !== relationshipName.toLowerCase()) {
      return field;
    }
    const subqueryFields = field.subquery.fields || [];
    const nestedFields = remainingSegments.length
      ? reorderSubqueryFields(subqueryFields, remainingSegments, columnOrder)
      : applyColumnOrderToFields(subqueryFields, columnOrder);
    if (!nestedFields) {
      return field;
    }
    didResolve = true;
    return { ...field, subquery: { ...field.subquery, fields: nestedFields } };
  });
  return didResolve ? updatedFields : null;
}

import { SUBQUERY_PATH_SEPARATOR } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { FieldType as QueryFieldType, Subquery, isFieldSubquery } from '@jetstreamapp/soql-parser-js';

/**
 * Salesforce supports nesting parent-to-child subqueries, so a relationship name alone is not enough to identify
 * a subquery within a query - `Cases` could be a child of the root object or of any subquery within it.
 *
 * Every subquery is instead identified by the path of relationship names from the root object, e.x. `Contacts.Cases`.
 * A single segment path is a top level subquery, and an empty path refers to the root object.
 */

export function getSubqueryPath(parentRelationshipPath: string, relationshipName: string): string {
  return parentRelationshipPath ? `${parentRelationshipPath}${SUBQUERY_PATH_SEPARATOR}${relationshipName}` : relationshipName;
}

export function getSubqueryPathSegments(relationshipPath: string): string[] {
  return relationshipPath ? relationshipPath.split(SUBQUERY_PATH_SEPARATOR) : [];
}

/** Number of relationships between the root object and this subquery. The root object itself is 0. */
export function getSubqueryPathDepth(relationshipPath: string): number {
  return getSubqueryPathSegments(relationshipPath).length;
}

/** The path of the subquery this one is nested within, or an empty string when it is a top level subquery. */
export function getSubqueryParentPath(relationshipPath: string): string {
  return getSubqueryPathSegments(relationshipPath).slice(0, -1).join(SUBQUERY_PATH_SEPARATOR);
}

/** The relationship name of the subquery itself, without any of its ancestors. */
export function getSubqueryRelationshipName(relationshipPath: string): string {
  return getSubqueryPathSegments(relationshipPath).pop() || '';
}

/** The path itself plus every ancestor, shallowest first: `A.B.C` becomes `['A', 'A.B', 'A.B.C']` */
export function getSubqueryPathWithAncestors(relationshipPath: string): string[] {
  const segments = getSubqueryPathSegments(relationshipPath);
  return segments.map((_, index) => segments.slice(0, index + 1).join(SUBQUERY_PATH_SEPARATOR));
}

/**
 * True if `relationshipPath` is nested anywhere beneath `parentRelationshipPath`, at any depth.
 * The parent itself does not count, and an empty parent path is the root object, which every subquery sits beneath.
 */
export function isSubqueryPathBelow(relationshipPath: string, parentRelationshipPath: string): boolean {
  if (!parentRelationshipPath) {
    return true;
  }
  return relationshipPath.toLowerCase().startsWith(`${parentRelationshipPath.toLowerCase()}${SUBQUERY_PATH_SEPARATOR}`);
}

/** True if `relationshipPath` is nested directly within `parentRelationshipPath` (one level down, not deeper). */
export function isDirectChildSubqueryPath(relationshipPath: string, parentRelationshipPath: string): boolean {
  return (
    getSubqueryParentPath(relationshipPath).toLowerCase() === parentRelationshipPath.toLowerCase() &&
    getSubqueryPathDepth(relationshipPath) === getSubqueryPathDepth(parentRelationshipPath) + 1
  );
}

export interface SubqueryWalkEntry {
  subquery: Subquery;
  /** Relationship path from the root object, using the casing found in the query */
  relationshipPath: string;
  parentRelationshipPath: string;
}

/**
 * Yield every subquery in a parsed query, including nested ones, depth first with each parent emitted
 * before its own children.
 *
 * Paths carry whatever casing the query used, which may not match Salesforce metadata - match them
 * case-insensitively. To skip a subtree, track the paths to prune and test them with `isSubqueryPathBelow`.
 */
export function* walkSubqueries(fields: Maybe<QueryFieldType[]>, parentRelationshipPath = ''): Generator<SubqueryWalkEntry> {
  for (const field of fields || []) {
    if (!isFieldSubquery(field)) {
      continue;
    }
    const { subquery } = field;
    const relationshipPath = getSubqueryPath(parentRelationshipPath, subquery.relationshipName);
    yield { subquery, relationshipPath, parentRelationshipPath };
    yield* walkSubqueries(subquery.fields, relationshipPath);
  }
}

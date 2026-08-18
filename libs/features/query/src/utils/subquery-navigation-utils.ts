import {
  getSubqueryPathWithAncestors,
  getSubqueryRelationshipName,
  isDirectChildSubqueryPath,
  isSubqueryPathBelow,
  orderValues,
} from '@jetstream/shared/utils';
import { QueryFields, QueryFieldWithPolymorphic } from '@jetstream/types';
import { BASE_FIELD_SEPARATOR, getSubqueryPathFromFieldKey } from '@jetstream/ui-core/shared';

/** One level of drill-in within the subquery tree. An empty relationship path is the root object. */
export interface SubqueryDrillLevel {
  relationshipPath: string;
  relationshipName: string;
  childSObject: string;
}

export interface SelectedSubqueryNode extends SubqueryDrillLevel {
  /** Fields selected on the subquery itself, which can be zero when only something nested within it has fields */
  fieldCount: number;
  children: SelectedSubqueryNode[];
}

/**
 * The object each subquery points at, keyed by relationship path.
 *
 * The fields map holds an entry per expanded parent relationship in addition to the subquery itself, and those
 * entries carry the same relationship path, so only the base key identifies the object the subquery selects from.
 */
export function getSubquerySObjectByPath(queryFieldsMap: Record<string, QueryFields>): Record<string, string> {
  return Object.values(queryFieldsMap).reduce((output: Record<string, string>, { key, sobject }) => {
    const relationshipPath = getSubqueryPathFromFieldKey(key);
    if (relationshipPath && key.endsWith(BASE_FIELD_SEPARATOR)) {
      output[relationshipPath] = sobject;
    }
    return output;
  }, {});
}

/**
 * The subqueries that make up the query, as a tree.
 *
 * Mirrors how the SOQL is composed - a subquery is included when it, or anything nested within it, has fields
 * selected - so the tree always matches the related objects the generated query contains.
 */
export function buildSelectedSubqueryTree(
  selectedFieldsByPath: Record<string, QueryFieldWithPolymorphic[]>,
  sObjectByPath: Record<string, string>,
): SelectedSubqueryNode[] {
  const allPaths = new Set<string>();
  Object.keys(selectedFieldsByPath).forEach((relationshipPath) => {
    if (selectedFieldsByPath[relationshipPath]?.length) {
      getSubqueryPathWithAncestors(relationshipPath).forEach((path) => allPaths.add(path));
    }
  });

  function buildNodes(parentRelationshipPath: string): SelectedSubqueryNode[] {
    return orderValues(Array.from(allPaths).filter((path) => isDirectChildSubqueryPath(path, parentRelationshipPath))).map(
      (relationshipPath) => ({
        relationshipPath,
        relationshipName: getSubqueryRelationshipName(relationshipPath),
        childSObject: sObjectByPath[relationshipPath] || '',
        fieldCount: selectedFieldsByPath[relationshipPath]?.length || 0,
        children: buildNodes(relationshipPath),
      }),
    );
  }

  return buildNodes('');
}

/** Every node in the tree, depth first with each parent ahead of its own children. */
export function flattenSelectedSubqueryTree(nodes: SelectedSubqueryNode[]): SelectedSubqueryNode[] {
  return nodes.flatMap((node) => [node, ...flattenSelectedSubqueryTree(node.children)]);
}

/** Number of subqueries nested anywhere beneath `relationshipPath`, which is what clearing that level removes. */
export function countSubqueriesBelow(nodes: SelectedSubqueryNode[], relationshipPath: string): number {
  return flattenSelectedSubqueryTree(nodes).filter((node) => isSubqueryPathBelow(node.relationshipPath, relationshipPath)).length;
}

/**
 * Every node in the tree keyed by lower cased relationship path, so that a level can answer whether a
 * relationship is in the query and what is nested within it without re-deriving either.
 */
export function getSelectedSubqueryNodesByPath(nodes: SelectedSubqueryNode[]): Map<string, SelectedSubqueryNode> {
  return new Map(flattenSelectedSubqueryTree(nodes).map((node) => [node.relationshipPath.toLowerCase(), node]));
}

/**
 * The levels to drill into so that `relationshipPath` is listed, its ancestors shallowest first. Empty for a
 * top level subquery, which the root object already lists.
 */
export function getAncestorDrillLevels(nodes: SelectedSubqueryNode[], relationshipPath: string): SubqueryDrillLevel[] {
  const nodesByPath = getSelectedSubqueryNodesByPath(nodes);
  return getSubqueryPathWithAncestors(relationshipPath)
    .slice(0, -1)
    .reduce((levels: SubqueryDrillLevel[], ancestorPath) => {
      const ancestor = nodesByPath.get(ancestorPath.toLowerCase());
      if (ancestor) {
        levels.push({
          relationshipPath: ancestor.relationshipPath,
          relationshipName: ancestor.relationshipName,
          childSObject: ancestor.childSObject,
        });
      }
      return levels;
    }, []);
}

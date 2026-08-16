/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getExcelSafeSheetName,
  getSubqueryParentPath,
  getSubqueryPathDepth,
  getSubqueryRecords,
  getSubqueryRelationshipName,
  getSubquerySheetName,
  orderObjectsBy,
  sanitizeExcelSheetName,
} from '@jetstream/shared/utils';
import type { ChildRelationship, Maybe } from '@jetstream/types';

export interface LoadMultiObjectTemplateOptions {
  sobject: string;
  fields: string[];
  records: any[];
  /**
   * Map of subquery relationship path to the child fields in the query, from `getFlattenSubqueryFlattenedFieldMap`.
   * Nested subqueries are keyed by their full path, e.x. `Contacts.Cases`.
   */
  subqueryFields?: Record<string, string[]>;
  /** Child relationships from the root object describe - resolves the lookup field that links each child back to its parent */
  childRelationships?: ChildRelationship[];
  /**
   * Child relationships of each subquery's own child object, keyed by that subquery's relationship path.
   * Required to link a nested subquery, whose lookup field lives on the child object rather than on the root.
   */
  childRelationshipsByPath?: Record<string, ChildRelationship[]>;
}

/**
 * Finds the parent-to-child relationship a subquery was written against, which provides the child object
 * and the lookup field pointing back at the parent. Without it, the child records cannot be linked in the template.
 */
export function getChildRelationshipForSubquery(
  childRelationships: ChildRelationship[],
  relationshipName: string,
): Maybe<ChildRelationship> {
  return childRelationships.find(
    (childRelationship) =>
      !!childRelationship.field && childRelationship.relationshipName?.toLowerCase() === relationshipName.toLowerCase(),
  );
}

/** Guards the ancestor walk against a lookup cycle, which Salesforce should prevent but the file may not */
const MAX_TEMPLATE_ANCESTOR_DEPTH = 100;

/** Relationship paths ordered shallowest first, so a parent is always resolved before its children need it */
function orderPathsByDepth(relationshipPaths: string[]): string[] {
  return orderObjectsBy(
    relationshipPaths.map((relationshipPath) => ({ relationshipPath, depth: getSubqueryPathDepth(relationshipPath) })),
    'depth',
  ).map(({ relationshipPath }) => relationshipPath);
}

/**
 * Records for a subquery path, each paired with the Id of the record it came from.
 *
 * A nested subquery hangs off its own parent's child records rather than the root records, and its lookup
 * points at that parent's Reference Id - so a Case under `Contacts.Cases` links to its Contact, not the Account.
 */
function getSubqueryRecordsByPath(records: any[], relationshipPaths: string[]): Record<string, { parentId: string; record: any }[]> {
  const recordsByPath: Record<string, { parentId: string; record: any }[]> = {};

  orderPathsByDepth(relationshipPaths).forEach((relationshipPath) => {
    const parentPath = getSubqueryParentPath(relationshipPath);
    const parentRecords = parentPath ? (recordsByPath[parentPath] || []).map(({ record }) => record) : records;
    recordsByPath[relationshipPath] = parentRecords.flatMap((parentRecord) =>
      getSubqueryRecords(parentRecord, getSubqueryRelationshipName(relationshipPath)).map((record) => ({
        parentId: parentRecord.Id ?? '',
        record,
      })),
    );
  });

  return recordsByPath;
}

interface LoadMultiObjectTemplateRows {
  /** Root object records to emit, excluding any that are emitted as a child of another record instead */
  rootRecords: any[];
  /** Child records to emit per relationship path, each paired with its parent's Reference Id */
  rowsByPath: Record<string, { parentId: string; record: any }[]>;
  /** Largest parent-plus-descendants count once duplicates are removed - these load together as one group */
  largestGroupSize: number;
}

/**
 * Decides where each record is emitted, keeping every Reference Id unique across the whole workbook.
 *
 * The same record can occupy several positions in one query result. A self-referential relationship such as
 * `Account.ChildAccounts` is the clearest case: an account comes back as a root record and again beneath every
 * ancestor of it that the query also returned, so a chain of six accounts would otherwise be written out
 * twenty-plus times. Salesforce rejects the file when a Reference Id repeats.
 *
 * Each record is therefore emitted once, preferring the shallowest position that links it to a parent - that
 * link is what recreates the hierarchy, whereas the root worksheet copy would load it with no parent at all.
 */
function getLoadMultiObjectTemplateRows(records: any[], relationshipPaths: string[]): LoadMultiObjectTemplateRows {
  // Without subqueries every record is a root record, so none of the claiming or rollup below can change anything
  if (!relationshipPaths.length) {
    return { rootRecords: records, rowsByPath: {}, largestGroupSize: 0 };
  }

  const recordsByPath = getSubqueryRecordsByPath(records, relationshipPaths);
  const rowsByPath: Record<string, { parentId: string; record: any }[]> = {};
  const claimedIds = new Set<string>();
  const parentIdByRecordId = new Map<string, string>();

  orderPathsByDepth(relationshipPaths).forEach((relationshipPath) => {
    rowsByPath[relationshipPath] = (recordsByPath[relationshipPath] || []).filter(({ parentId, record }) => {
      const recordId = record?.Id;
      // Without an Id there is no Reference Id to collide - the plan reports these separately
      if (!recordId) {
        return true;
      }
      if (claimedIds.has(recordId)) {
        return false;
      }
      claimedIds.add(recordId);
      parentIdByRecordId.set(recordId, parentId);
      return true;
    });
  });

  const rootRecords = records.filter((record) => !record?.Id || !claimedIds.has(record.Id));
  const rootIds = new Set<string>(rootRecords.map((record) => record?.Id).filter(Boolean));

  // Every child rolls up to the root record it ultimately descends from, since a group loads all-or-nothing
  const groupSizeByRootId = new Map<string, number>();
  rootRecords.forEach((record) => record?.Id && groupSizeByRootId.set(record.Id, 1));
  claimedIds.forEach((recordId) => {
    let ancestorId: string | undefined = recordId;
    let depth = 0;
    while (ancestorId && !rootIds.has(ancestorId) && depth < MAX_TEMPLATE_ANCESTOR_DEPTH) {
      ancestorId = parentIdByRecordId.get(ancestorId);
      depth++;
    }
    if (ancestorId && rootIds.has(ancestorId)) {
      groupSizeByRootId.set(ancestorId, (groupSizeByRootId.get(ancestorId) ?? 1) + 1);
    }
  });

  // Folded rather than spread into Math.max, which overflows the call stack once there are enough root records
  let largestGroupSize = 0;
  groupSizeByRootId.forEach((groupSize) => {
    largestGroupSize = Math.max(largestGroupSize, groupSize);
  });

  return { rootRecords, rowsByPath, largestGroupSize };
}

export interface LoadMultiObjectTemplatePlan {
  /** Subqueries that become their own worksheet, with the relationship that links each child back to its parent */
  linked: { relationshipPath: string; childRelationship: ChildRelationship }[];
  /** Relationship paths with no matching child relationship on their parent object - the linking field is unknown, so they are omitted */
  skipped: string[];
  /** Worksheets whose query did not select Id, so their records have no value to use as a Reference Id */
  missingReferenceId: string[];
  /** Largest parent-plus-related-records count - these load together as one all-or-nothing group */
  largestGroupSize: number;
}

function hasIdField(fields: string[]): boolean {
  return fields.some((field) => field.toLowerCase() === 'id');
}

/**
 * Everything both the plan and the file are derived from, built once.
 *
 * The row layout is what `largestGroupSize` counts, so the plan cannot be produced without it - computing both
 * together is what keeps the modal's guidance and the downloaded file from drifting apart.
 */
function buildLoadMultiObjectTemplate({
  sobject,
  fields,
  records,
  subqueryFields = {},
  childRelationships = [],
  childRelationshipsByPath = {},
}: LoadMultiObjectTemplateOptions): { plan: LoadMultiObjectTemplatePlan; rows: LoadMultiObjectTemplateRows } {
  const linked: LoadMultiObjectTemplatePlan['linked'] = [];
  const skipped: string[] = [];
  const missingReferenceId = hasIdField(fields) ? [] : [sobject];
  const linkedPaths = new Set<string>();

  // Shallowest first, so a nested subquery is only considered once its parent is known to link
  orderPathsByDepth(Object.keys(subqueryFields)).forEach((relationshipPath) => {
    const parentPath = getSubqueryParentPath(relationshipPath);
    // If the parent could not be linked there is no worksheet for this one to point at. The parent is already
    // reported as skipped and is the only thing the user can act on, so its descendants are dropped silently
    // rather than repeating one problem once per level.
    if (parentPath && !linkedPaths.has(parentPath)) {
      return;
    }

    // A nested subquery links through its own parent's child object, so its lookup field lives on that describe
    const parentRelationships = parentPath ? childRelationshipsByPath[parentPath] : childRelationships;
    const childRelationship =
      parentRelationships && getChildRelationshipForSubquery(parentRelationships, getSubqueryRelationshipName(relationshipPath));

    if (!childRelationship) {
      skipped.push(relationshipPath);
      return;
    }
    linkedPaths.add(relationshipPath);
    linked.push({ relationshipPath, childRelationship });
    if (!hasIdField(subqueryFields[relationshipPath])) {
      missingReferenceId.push(relationshipPath);
    }
  });

  // A parent counts itself plus everything it brings with it, at any depth, since they all load as a single group
  const rows = getLoadMultiObjectTemplateRows(
    records,
    linked.map(({ relationshipPath }) => relationshipPath),
  );

  return { plan: { linked, skipped, missingReferenceId, largestGroupSize: rows.largestGroupSize }, rows };
}

/**
 * What `prepareLoadMultiObjectTemplate` will produce for these options.
 *
 * The download modal renders this, so what the user is told before downloading always matches the file they
 * get - and the "which subqueries link" decision is only made in one place.
 *
 * Not free to call: `largestGroupSize` can only be counted from the row layout, so this builds it and throws
 * it away. Keep it out of hot paths and memoize it where the options are stable.
 */
export function planLoadMultiObjectTemplate(options: LoadMultiObjectTemplateOptions): LoadMultiObjectTemplatePlan {
  return buildLoadMultiObjectTemplate(options).plan;
}

/**
 * Fields the template can represent as columns.
 * Id is omitted because it becomes the Reference Id, and relationship ("." path) and non-primitive values
 * (subquery results, compound fields such as address) have no writable column on the target object.
 */
function getLoadMultiObjectTemplateFields(fields: string[], records: any[], excludedFields: Set<string>): string[] {
  const excludedFieldsLowercase = new Set(Array.from(excludedFields, (field) => field.toLowerCase()));
  return fields.filter((field) => {
    const fieldLowercase = field.toLowerCase();
    if (fieldLowercase === 'id' || field.includes('.') || excludedFieldsLowercase.has(fieldLowercase)) {
      return false;
    }
    return !records.some((record) => record[field] !== null && typeof record[field] === 'object');
  });
}

function getLoadMultiObjectTemplateHeaderRows(sobject: string): any[][] {
  return [['Object Api Name', sobject], ['Operation', 'Insert'], ['External Id (for upsert)', ''], []];
}

function getLoadMultiObjectTemplateCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  // Object-valued fields are excluded from the columns; this is a defensive guard for anything that slipped through
  if (typeof value === 'object') {
    return '';
  }
  return value;
}

/**
 * Build the sheet rows for a "Load Records to Multiple Objects" template from records already in the browser.
 * Returns a map of sheet name to array-of-array rows, ready to pass to prepareExcelFile (or FileDownloadModal).
 *
 * Each record's Id becomes its Reference Id and the operation defaults to Insert, so the file can be loaded
 * into another org as-is.
 *
 * Subquery results become a worksheet per relationship, with a `{LookupField}` column holding the parent's
 * Reference Id so the child records are created against the newly inserted parent. This requires the parent
 * object's child relationships, otherwise the subquery is skipped since the linking field is unknown.
 */
export function prepareLoadMultiObjectTemplate(options: LoadMultiObjectTemplateOptions): Record<string, any[][]> {
  const { sobject, fields, records, subqueryFields = {} } = options;
  const {
    plan: { linked },
    rows: { rootRecords, rowsByPath },
  } = buildLoadMultiObjectTemplate(options);
  const templateFields = getLoadMultiObjectTemplateFields(fields, records, new Set(Object.keys(subqueryFields)));

  const output: Record<string, any[][]> = {
    [getExcelSafeSheetName(sanitizeExcelSheetName(sobject))]: [
      ...getLoadMultiObjectTemplateHeaderRows(sobject),
      ['Reference Id', ...templateFields],
      ...rootRecords.map((record) => [
        record.Id ?? '',
        ...templateFields.map((field) => getLoadMultiObjectTemplateCellValue(record[field])),
      ]),
    ],
  };

  linked.forEach(({ relationshipPath, childRelationship }) => {
    const childRecordsWithParentId = rowsByPath[relationshipPath] || [];
    if (!childRecordsWithParentId.length) {
      return;
    }

    const { childSObject, field: lookupField } = childRelationship;
    // A nested subquery is itself a column on its parent's records, so exclude it the same way the root does
    const nestedRelationshipNames = linked
      .filter(({ relationshipPath: nestedPath }) => getSubqueryParentPath(nestedPath) === relationshipPath)
      .map(({ relationshipPath: nestedPath }) => getSubqueryRelationshipName(nestedPath));
    // The lookup field is emitted as the {reference} column, so it must not also appear as a regular column
    const childTemplateFields = getLoadMultiObjectTemplateFields(
      subqueryFields[relationshipPath],
      childRecordsWithParentId.map(({ record }) => record),
      new Set([lookupField, ...nestedRelationshipNames]),
    );
    const sheetName = getSubquerySheetName(relationshipPath, Object.keys(output));

    output[sheetName] = [
      ...getLoadMultiObjectTemplateHeaderRows(childSObject),
      ['Reference Id', `{${lookupField}}`, ...childTemplateFields],
      ...childRecordsWithParentId.map(({ parentId, record }) => [
        record.Id ?? '',
        parentId,
        ...childTemplateFields.map((field) => getLoadMultiObjectTemplateCellValue(record[field])),
      ]),
    ];
  });

  return output;
}

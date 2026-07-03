/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { RECORD_PREFIX_MAP } from '@jetstream/shared/constants';
import { getIdFromRecordUrl } from '@jetstream/shared/utils';
import type { Row, Table } from '@tanstack/react-table';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import { ColumnType, ColumnWithFilter } from './grid-types';

/**
 * The filtered + sorted DATA rows, independent of group expansion state: collapsed groups' leaves are
 * included and synthetic group header rows are excluded. This is "the rows" every consumer-facing
 * surface (onRowsChange, context menu data, getFilteredAndSortedRows, the generic context) exposes —
 * the legacy grid filtered/sorted outside react-data-grid, so consumers always saw the full flat list.
 *
 * Two TanStack quirks make the raw flatRows unusable directly: group rows carry the first leaf's
 * `original` (they'd appear as duplicate data rows), and with no sort applied getSortedRowModel()
 * passes through the GROUPED model, whose flatRows contain every leaf twice (pushed once during
 * recursion and once per-group). Hence the getIsGrouped filter AND the id de-dupe.
 */
export function getSortedFilteredLeafRows<TRow>(table: Table<TRow>): Row<TRow>[] {
  const seenRowIds = new Set<string>();
  const leafRows: Row<TRow>[] = [];
  for (const row of table.getSortedRowModel().flatRows) {
    if (!row.getIsGrouped() && !seenRowIds.has(row.id)) {
      seenRowIds.add(row.id);
      leafRows.push(row);
    }
  }
  return leafRows;
}

/**
 * Shift-click range selection: set every row between `anchorRowId` and `targetRowId` (inclusive, in the
 * current filtered/sorted/flattened display order) to the SAME selected state as the anchor row. Group
 * header rows and non-selectable rows are skipped. Returns `false` (without mutating selection) when
 * either id is no longer in the row model (e.g. the anchor was filtered out) so the caller can fall back
 * to a plain single-row toggle.
 */
export function selectRowRange<TRow>(table: Table<TRow>, anchorRowId: string, targetRowId: string): boolean {
  const rows = table.getRowModel().rows;
  const anchorIndex = rows.findIndex((row) => row.id === anchorRowId);
  const targetIndex = rows.findIndex((row) => row.id === targetRowId);
  if (anchorIndex === -1 || targetIndex === -1) {
    return false;
  }
  const selected = rows[anchorIndex].getIsSelected();
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  table.setRowSelection((prev) => {
    const next = { ...prev };
    for (let i = start; i <= end; i++) {
      const row = rows[i];
      if (row.getIsGrouped() || !row.getCanSelect()) {
        continue;
      }
      if (selected) {
        next[row.id] = true;
      } else {
        delete next[row.id];
      }
    }
    return next;
  });
  return true;
}

const SFDC_EMPTY_ID = '000000000000000AAA';

// TanStack Table calls getRowId on every render to re-resolve its row model. Without this cache, rows
// that have no natural id (AggregateResults, blank Salesforce ids) would be assigned a fresh
// `uniqueId('row-id')` on every render, breaking selection/expansion/filter persistence. Caching by
// object identity gives the same row the same id for as long as the consumer keeps the reference.
const generatedIdCache = new WeakMap<object, string>();

function getOrGenerateId(data: object): string {
  let cached = generatedIdCache.get(data);
  if (!cached) {
    cached = uniqueId('row-id');
    generatedIdCache.set(data, cached);
  }
  return cached;
}

/**
 * Derive a stable unique key for a row. Prefers an explicit `_key`/`key`, then a Salesforce record
 * url/Id, and finally falls back to a generated id (for AggregateResults and blank ids) — cached per
 * row object so the same row keeps the same id across renders.
 */
export function getRowId(data: any): string {
  if (data?._key) {
    return data._key;
  }
  if (data?.key) {
    return data.key;
  }
  if (data && typeof data === 'object' && data.attributes?.type === 'AggregateResult') {
    return getOrGenerateId(data);
  }
  const nodeId = data?.attributes?.url || data?.Id || data?.id;
  if (!nodeId || (isString(nodeId) && nodeId.endsWith(SFDC_EMPTY_ID)) || data?.Id === SFDC_EMPTY_ID) {
    return data && typeof data === 'object' ? getOrGenerateId(data) : uniqueId('row-id');
  }
  return nodeId;
}

/**
 * Build a per-row lowercase search index ({ rowKey: concatenatedText }) used by the global quick
 * filter. Computed once per data/column change so the quick filter stays cheap on large datasets.
 */
export function getSearchTextByRow<T>(
  rows: T[],
  columns: ColumnWithFilter<T>[],
  getRowKey: (row: T) => string,
  // For `getSubRows` trees, `rows` holds only the roots — recurse so every descendant (e.g. Automation
  // Control's automation items + flow versions) is indexed, or the quick filter can only match roots.
  getSubRows?: (row: T, index: number) => T[] | undefined,
): Record<string, string> {
  const output: Record<string, string> = {};
  const indexRows = (list: T[]) => {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach((row, index) => {
      const key = getRowKey(row);
      if (key) {
        columns.forEach((column) => {
          if (column.key) {
            let value = (row as Record<string, unknown>)[column.key];
            if (column.getValue) {
              value = column.getValue({ row, column });
            }
            if (!isNil(value) && !isObject(value)) {
              let filterValue = String(value);
              if (filterValue === '[object Object]') {
                filterValue = JSON.stringify(value);
              }
              output[key] = `${output[key] || ''}${filterValue.toLowerCase()}`;
            }
          }
        });
      }
      const children = getSubRows?.(row, index);
      if (children?.length) {
        indexRows(children);
      }
    });
  };
  indexRows(rows);
  return output;
}

/** Heuristic column type from a raw value (used for generic/unknown data tables). */
export function getRowTypeFromValue(value: unknown, allowObject = true): ColumnType {
  if (allowObject && (isObject(value) || Array.isArray(value))) {
    return 'object';
  } else if (typeof value === 'boolean') {
    return 'boolean';
  } else if (typeof value === 'number') {
    return 'number';
  }
  return 'textOrSalesforceId';
}

/** "Parent Record: Name (Id)" tagline for the subquery modal. */
export function getSubqueryModalTagline(parentRecord: any): string | undefined {
  let currModalTagline: string | undefined = undefined;
  let recordName: string | undefined = undefined;
  let recordId: string | undefined = undefined;
  try {
    if (parentRecord.Name) {
      recordName = parentRecord.Name;
    }
    if (parentRecord?.Id) {
      recordId = parentRecord.Id;
    } else if (parentRecord?.attributes?.url) {
      recordId = parentRecord.attributes.url.substring(parentRecord.attributes.url.lastIndexOf('/') + 1);
    }
  } catch {
    // ignore
  } finally {
    if (recordName || recordId) {
      currModalTagline = 'Parent Record: ';
      if (recordName) {
        currModalTagline += recordName;
      }
      if (recordName && recordId) {
        currModalTagline += ` (${recordId})`;
      } else if (recordId) {
        currModalTagline += recordId;
      }
    }
  }
  return currModalTagline;
}

/**
 * Build a Salesforce redirect URL for a record id, handling special object types (Group, RecordType,
 * Profile, PermissionSet) whose URLs differ from the standard `/{id}` form.
 */
export function getSfdcRetUrl(record: any, id?: string, skipFrontdoorLoginOverride?: boolean): { skipFrontDoorAuth: boolean; url: string } {
  try {
    id = id || getIdFromRecordUrl(record?.attributes?.url || record?._record?.attributes?.url);
    const baseRecordType = record?.attributes?.type || record?._record?.attributes?.type;
    const recordPrefix = (id || '').substring(0, 3) as keyof typeof RECORD_PREFIX_MAP;
    const relatedRecordType = RECORD_PREFIX_MAP[recordPrefix] || null;

    if (baseRecordType === 'Group') {
      return {
        skipFrontDoorAuth: skipFrontdoorLoginOverride ?? true,
        url: `/lightning/setup/PublicGroups/page?address=${encodeURIComponent(`/setup/own/groupdetail.jsp?id=${id}`)}`,
      };
    }
    switch (relatedRecordType) {
      case 'RecordType':
        return {
          skipFrontDoorAuth: skipFrontdoorLoginOverride ?? false,
          url: `/lightning/setup/ObjectManager/${relatedRecordType}/RecordTypes/${id}/view`,
        };
      case 'Profile':
        return {
          skipFrontDoorAuth: skipFrontdoorLoginOverride ?? false,
          url: `/lightning/setup/EnhancedProfiles/page?address=${encodeURIComponent(`/${id}?noredirect=1`)}`,
        };
      case 'PermissionSet':
        return {
          skipFrontDoorAuth: skipFrontdoorLoginOverride ?? false,
          url: `/lightning/setup/PermSets/page?address=${encodeURIComponent(`/${id}?noredirect=1`)}`,
        };
      default:
        return { skipFrontDoorAuth: skipFrontdoorLoginOverride ?? false, url: `/${id}` };
    }
  } catch (ex) {
    logger.error('Error formatting Salesforce URL', ex);
    return { skipFrontDoorAuth: skipFrontdoorLoginOverride ?? false, url: `/${id}` };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Maybe, QueryResult } from '@jetstream/types';

/**
 * Salesforce counts subquery child rows toward a query's batch size, so a query can come back with only part of
 * a parent's child records. When that happens the child result set is marked `done: false` and carries its own
 * `nextRecordsUrl`, and the top level result is marked `done: false` as well - even when every parent record was
 * returned. These helpers identify what is missing and fold newly fetched pages back into the loaded records.
 */

/**
 * Salesforce nests a parent-to-child subquery's result set on the parent record, keyed by relationship name.
 * The shape matches a top level query result, including its own paging state.
 */
export function isSubqueryResult(value: unknown): value is QueryResult<any> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const { records, done } = value as QueryResult<any>;
  return Array.isArray(records) && typeof done === 'boolean';
}

/** Identity used to recognize the same record across pages, or null for records without a usable id. */
export function getQueryRecordKey(record: any): string | null {
  const url = record?.attributes?.url;
  if (typeof url === 'string' && url) {
    return url;
  }
  const id = record?.Id ?? record?.id;
  return typeof id === 'string' && id ? id : null;
}

/**
 * True when this result set is missing records - either its own paging is unfinished, or a subquery nested
 * somewhere within its records was truncated. Truncation at any depth counts: a subquery several levels down
 * being short is just as invisible from a table as this one being short, and both make an export incomplete.
 */
export function isIncompleteSubqueryResult(queryResults: Maybe<QueryResult<any>>): boolean {
  if (!queryResults) {
    return false;
  }
  return (!queryResults.done && !!queryResults.nextRecordsUrl) || queryResults.records.some(hasIncompleteSubqueries);
}

/** True when this record - or any child record nested within its subqueries - is missing child records. */
export function hasIncompleteSubqueries(record: any): boolean {
  if (!record || typeof record !== 'object') {
    return false;
  }
  return Object.values(record).some((value) => isSubqueryResult(value) && isIncompleteSubqueryResult(value));
}

/**
 * Append a newly fetched page of child records onto a subquery result. Paging state is taken from the page,
 * which is the newer of the two. The records themselves are merged by identity, so an overlapping page cannot
 * duplicate rows, and a child record repeated to carry more of its own children keeps both batches.
 */
export function mergeSubqueryResults(existing: QueryResult<any>, page: QueryResult<any>): QueryResult<any> {
  return {
    ...page,
    records: mergeQueryRecordPages(existing.records, page.records),
    totalSize: Math.max(existing.totalSize ?? 0, page.totalSize ?? 0),
  };
}

/**
 * Fold a record that appeared again in a later page into the copy already loaded, appending whatever child
 * records its subqueries carry. Every other field is identical between the two, so the loaded copy wins.
 */
function mergeRecordSubqueries(existing: any, incoming: any): any {
  const subqueryEntries = Object.entries(incoming).filter(([, value]) => isSubqueryResult(value));
  if (!subqueryEntries.length) {
    return existing;
  }
  const merged = { ...existing };
  subqueryEntries.forEach(([relationshipName, value]) => {
    const existingValue = existing[relationshipName];
    merged[relationshipName] = isSubqueryResult(existingValue)
      ? mergeSubqueryResults(existingValue, value as QueryResult<any>)
      : (value as QueryResult<any>);
  });
  return merged;
}

/**
 * Merge a page of records into the records already loaded. Used at every depth - the top level result set and any
 * subquery nested within it page the same way.
 *
 * A record whose child records were truncated can be returned again by a later page, carrying its next batch of
 * children. Merging by record identity keeps that record from being added a second time and folds the extra
 * children into the copy already loaded.
 */
export function mergeQueryRecordPages(existingRecords: any[], incomingRecords: any[]): any[] {
  const indexByKey = new Map<string, number>();
  existingRecords.forEach((record, index) => {
    const key = getQueryRecordKey(record);
    if (key && !indexByKey.has(key)) {
      indexByKey.set(key, index);
    }
  });

  const merged = existingRecords.slice();
  incomingRecords.forEach((record) => {
    const key = getQueryRecordKey(record);
    const existingIndex = key ? indexByKey.get(key) : undefined;
    if (existingIndex === undefined) {
      if (key) {
        indexByKey.set(key, merged.length);
      }
      merged.push(record);
      return;
    }
    merged[existingIndex] = mergeRecordSubqueries(merged[existingIndex], record);
  });
  return merged;
}

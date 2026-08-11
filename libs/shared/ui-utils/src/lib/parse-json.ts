import { getErrorMessage } from '@jetstream/shared/utils';
import isNil from 'lodash/isNil';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';

/** Recursion guard against pathologically nested JSON - anything deeper is serialized instead of flattened */
const MAX_JSON_FLATTEN_DEPTH = 10;

/**
 * Salesforce records carry a metadata envelope that is not loadable data. Matched on the exact key set so a
 * user's own `attributes` column is left alone - `url` is optional because AggregateResult omits it.
 */
function isSalesforceAttributes(value: unknown): boolean {
  if (!isPlainObject(value) || !isString((value as Record<string, unknown>).type)) {
    return false;
  }
  return Object.keys(value as object).every((key) => key === 'type' || key === 'url');
}

/**
 * Flatten a JSON record into the shape a CSV or XLSX row would have - nested objects become dot-notation keys
 * (`Owner.Name`) and anything list-like is serialized, which mirrors how `flattenRecord()` builds a download.
 */
function flattenJsonRecord(record: Record<string, any>, output: Record<string, any> = {}, prefix = '', depth = 0): Record<string, any> {
  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes' && isSalesforceAttributes(value)) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      output[path] = JSON.stringify(value);
    } else if (isPlainObject(value)) {
      if (Array.isArray(value.records)) {
        // Subquery results are wrapped in `{ totalSize, done, records }` - only the records are meaningful
        output[path] = JSON.stringify(value.records);
      } else if (depth >= MAX_JSON_FLATTEN_DEPTH) {
        output[path] = JSON.stringify(value);
      } else {
        flattenJsonRecord(value, output, path, depth + 1);
      }
    } else {
      output[path] = value;
    }
  }
  return output;
}

/**
 * Parse JSON file content into flat rows for the data loader.
 *
 * Accepts a top-level array of records, a `{ records: [] }` wrapper (the shape the Salesforce API and Jetstream's
 * multi-sheet downloads use), or a single record object. Throws if the content cannot be read as records at all,
 * since unlike a CSV there is no partial result worth showing the user.
 */
export function parseJson(content: string): {
  data: any[];
  headers: string[];
  errors: string[];
} {
  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch (ex) {
    throw new Error(`The file is not valid JSON. ${getErrorMessage(ex)}`);
  }

  let parsedRecords: unknown[];
  if (Array.isArray(parsedContent)) {
    parsedRecords = parsedContent;
  } else if (isPlainObject(parsedContent) && Array.isArray((parsedContent as { records?: unknown[] }).records)) {
    parsedRecords = (parsedContent as { records: unknown[] }).records;
  } else if (isPlainObject(parsedContent)) {
    parsedRecords = [parsedContent];
  } else {
    throw new Error('The file must contain a record or an array of records.');
  }

  const errors: string[] = [];
  const data: Record<string, any>[] = [];
  let skippedCount = 0;

  parsedRecords.forEach((record) => {
    if (!isPlainObject(record)) {
      skippedCount++;
      return;
    }
    data.push(flattenJsonRecord(record as Record<string, any>));
  });

  if (skippedCount > 0) {
    errors.push(`${skippedCount} item${skippedCount === 1 ? ' was' : 's were'} skipped because they are not records.`);
  }

  // Records are allowed to omit keys, so every row contributes to the header list instead of just the first
  const headerSet = new Set<string>();
  data.forEach((record) => Object.keys(record).forEach((header) => headerSet.add(header)));
  const headers = Array.from(headerSet);

  // An empty lookup (`"Owner": null`) leaves a bare `Owner` header beside the `Owner.Name` that populated rows
  // flatten to. That bare column holds nothing loadable, so it is dropped - but only when it is empty on every
  // row, since a real value there is a scalar/object conflict the user should see rather than lose silently.
  const emptyParentHeaders = new Set(
    headers.filter(
      (header) => headers.some((otherHeader) => otherHeader.startsWith(`${header}.`)) && data.every((record) => isNil(record[header])),
    ),
  );
  data.forEach((record) => emptyParentHeaders.forEach((header) => delete record[header]));

  return { data, headers: headers.filter((header) => !emptyParentHeaders.has(header)), errors };
}

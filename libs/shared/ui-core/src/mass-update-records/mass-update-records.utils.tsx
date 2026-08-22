import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { queryAll, queryAllFromList } from '@jetstream/shared/data';
import { escapeSoqlString } from '@jetstream/shared/ui-utils';
import { BULK_RESULTS_BASE_HEADER, buildBulkResultRow } from '@jetstream/shared/utils';
import { BulkJobResultRecord, DescribeGlobalSObjectResult, ListItem, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Query, composeQuery, getField, isQueryValid } from '@jetstreamapp/soql-parser-js';
import lodashGet from 'lodash/get';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import { MetadataRow, MetadataRowConfiguration } from './mass-update-records.types';

/**
 * SOQL sent to the Salesforce REST query endpoint travels in the request URL (`GET /query?q=...`), and
 * that URL has a length limit far below the 100k-character SOQL limit — empirically anything over ~10k
 * characters is rejected (Salesforce responds 414/431/500, which surfaces to the user as a generic
 * failure). So a `WHERE Id IN (...)` re-fetch must be chunked by the resulting query length, not by a
 * fixed record count. Mirrors `MAX_QUERY_LENGTH` in load-records-utils.
 */
export const MAX_ID_QUERY_LENGTH = 9500;

/**
 * Salesforce rejects any query with an `OFFSET` above this with `NUMBER_OUTSIDE_VALID_RANGE`, so the
 * value is validated in the UI instead of letting the user discover the cap through a failed query.
 */
export const MAX_SOQL_OFFSET = 2000;

/** Validation message for a row's record limit, or null when the limit is unset or usable */
export function getRecordLimitError(limit: Maybe<number>): string | null {
  if (isNumber(limit) && limit < 1) {
    return 'The limit must be 1 or greater';
  }
  return null;
}

/** Validation message for a row's record offset, or null when the offset is unset or usable */
export function getRecordOffsetError(offset: Maybe<number>): string | null {
  if (isNumber(offset) && (offset < 0 || offset > MAX_SOQL_OFFSET)) {
    return `Salesforce allows a maximum offset of ${MAX_SOQL_OFFSET.toLocaleString()}`;
  }
  return null;
}

/**
 * Normalized `LIMIT` / `OFFSET` for a row. `Maybe<number>` admits `null`, `undefined`, `0` and negative
 * values, none of which mean anything to a query, so every consumer reads the limit through here and
 * checks plain truthiness instead of restating which values count.
 */
export function getEffectiveRecordLimit({ limit, offset }: Pick<MetadataRow, 'limit' | 'offset'>): {
  limit: number | null;
  offset: number | null;
} {
  return {
    limit: isNumber(limit) && limit > 0 ? limit : null,
    offset: isNumber(offset) && offset > 0 ? offset : null,
  };
}

/**
 * `ORDER BY` / `LIMIT` / `OFFSET` suffix for a row. Appended by hand instead of through `composeQuery`
 * because the WHERE clauses are composed as raw strings after the query is built, and all of these
 * clauses must follow them.
 *
 * A limited query is ordered by Id so that working through a large data volume a chunk at a time
 * returns each record exactly once - Salesforce makes no guarantee that two runs of an unordered
 * query see the records in the same order, which would let an offset skip and repeat records.
 * Aggregate queries opt out of the ordering because Salesforce rejects `ORDER BY` alongside `COUNT()`,
 * and an order cannot change a count anyway.
 */
function getLimitAndOffsetClause(row: Pick<MetadataRow, 'limit' | 'offset'>, { isAggregate }: { isAggregate: boolean }): string {
  const { limit, offset } = getEffectiveRecordLimit(row);
  if (!limit && !offset) {
    return '';
  }
  let clause = isAggregate ? '' : ' ORDER BY Id';
  if (limit) {
    clause += ` LIMIT ${limit}`;
  }
  if (offset) {
    clause += ` OFFSET ${offset}`;
  }
  return clause;
}

/**
 * Split a set of record Ids into as few `WHERE Id IN (...)` queries as possible while keeping each query
 * under {@link MAX_ID_QUERY_LENGTH} so it does not blow past Salesforce's query-URL length limit.
 */
function buildChunkedIdInQueries(baseSoql: string, ids: string[], additionalWhereClause?: Maybe<string>): string[] {
  const queries: string[] = [];
  const additionalClause = additionalWhereClause ? ` AND (${additionalWhereClause})` : '';
  const wrapperLength = baseSoql.length + ' WHERE Id IN ()'.length + additionalClause.length;
  let chunk: string[] = [];
  let chunkLength = wrapperLength;

  const flushChunk = () => {
    if (chunk.length > 0) {
      queries.push(`${baseSoql} WHERE Id IN (${chunk.join(',')})${additionalClause}`);
      chunk = [];
      chunkLength = wrapperLength;
    }
  };

  ids.forEach((id) => {
    const token = `'${escapeSoqlString(id)}'`;
    // a comma separator only exists between Ids, so it is not counted for the first Id in a chunk
    if (chunk.length > 0 && chunkLength + 1 + token.length > MAX_ID_QUERY_LENGTH) {
      flushChunk();
    }
    const separatorLength = chunk.length > 0 ? 1 : 0;
    chunkLength += separatorLength + token.length;
    chunk.push(token);
  });
  flushChunk();

  return queries;
}

export const startsWithWhereRgx = /^\s*WHERE\b\s*/i;

/**
 * Users routinely paste a clause that still has its leading `WHERE` keyword. Every consumer normalizes
 * through here so validation and query composition agree: previously only the input component stripped
 * the keyword, so `WHERE Foo = 1` looked valid while `isValidRow` and the compose helpers rejected it —
 * blocking the row with no message shown.
 */
export function normalizeWhereClause(whereClause: Maybe<string>): string {
  return (whereClause || '').replace(startsWithWhereRgx, '').trim();
}

export function isValidWhereClause(whereClause: Maybe<string>): boolean {
  const normalizedWhereClause = normalizeWhereClause(whereClause);
  return !!normalizedWhereClause && isQueryValid(`WHERE ${normalizedWhereClause}`, { allowPartialQuery: true });
}

export const DEFAULT_FIELD_CONFIGURATION: MetadataRowConfiguration = {
  selectedField: null,
  selectedFieldMetadata: null,
  transformationOptions: {
    option: 'staticValue',
    alternateField: undefined,
    staticValue: '',
    criteria: 'all',
    whereClause: '',
  },
};

export function filterMassUpdateSobject(sobject: DescribeGlobalSObjectResult | null) {
  return (
    !!sobject &&
    (sobject.createable || sobject.updateable) &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Feed')
  );
}

export const transformationOptionListItems: ListItem[] = [
  { id: 'staticValue', value: 'staticValue', label: 'Provided value' },
  { id: 'anotherField', value: 'anotherField', label: 'Value from different field' },
  { id: 'null', value: 'null', label: 'Clear field value' },
  { id: 'update', value: 'update', label: 'Update record without changes' },
];

export const transformationCriteriaListItems: ListItem[] = [
  { id: 'all', value: 'all', label: 'All records' },
  { id: 'onlyIfBlank', value: 'onlyIfBlank', label: 'Only if blank' },
  { id: 'onlyIfNotBlank', value: 'onlyIfNotBlank', label: 'Only if not blank' },
  { id: 'custom', value: 'custom', label: 'Custom criteria' },
];

/**
 * Check if a row is configured
 * @param row
 * @returns
 */
export function isValidRow(row: Maybe<MetadataRow>) {
  if (!row?.configuration?.length) {
    return false;
  }
  if (getRecordLimitError(row.limit) || getRecordOffsetError(row.offset)) {
    return false;
  }
  return row.configuration.every(({ selectedField, transformationOptions }) => {
    if (!selectedField) {
      return false;
    }
    if (transformationOptions.option === 'anotherField' && !transformationOptions.alternateField) {
      return false;
    }
    if (transformationOptions.option === 'staticValue' && !transformationOptions.staticValue) {
      return false;
    }
    if (transformationOptions.criteria === 'custom' && !isValidWhereClause(transformationOptions.whereClause)) {
      return false;
    }
    return true;
  });
}

export function getFieldsToQuery(configuration: MetadataRowConfiguration[]): string[] {
  let fields = ['Id'];
  configuration.forEach(({ selectedField, transformationOptions }) => {
    fields.push(selectedField || '');
    if (transformationOptions.option === 'anotherField' && transformationOptions.alternateField) {
      fields.push(transformationOptions.alternateField);
    }
    // ensure no duplicates
    fields = Array.from(new Set(fields));
  });
  return fields.filter(Boolean) as string[];
}

/**
 * The combined per-record result rows (`{_id, _success, _errors, ...record}`) used by BOTH the
 * interactive download/view in `MassUpdateRecordsDeploymentRow` and the Data History capture share
 * their shape with Load Records — the canonical builder is `buildBulkResultRow` in
 * `@jetstream/shared/utils`; only the header derivation differs per feature.
 */

/** Results/failures header: base result columns + the updated fields (`Id` + each selected field) */
export function getMassUpdateResultsHeader(configuration: MetadataRowConfiguration[]): string[] {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return BULK_RESULTS_BASE_HEADER.concat(['Id', ...configuration.map(({ selectedField }) => selectedField!)]);
}

/**
 * WIDER variant of `getMassUpdateResultsHeader` for downloads whose rows carry the full QUERIED
 * record (`getFieldsToQuery`): also includes any "value from another field" source columns, which
 * the results view and the saved history file intentionally omit.
 */
export function getMassUpdateQueriedFieldsHeader(configuration: MetadataRowConfiguration[]): string[] {
  return BULK_RESULTS_BASE_HEADER.concat(getFieldsToQuery(configuration));
}

/**
 * Zip a batch's bulk result records with the submitted source records into combined rows. Pass
 * `includeSuccesses: false` to keep only failed rows (used by the "failures" download).
 */
export function buildMassUpdateCombinedResults(
  resultRecords: BulkJobResultRecord[],
  sourceRecords: Record<string, unknown>[],
  { includeSuccesses = true }: { includeSuccesses?: boolean } = {},
): Record<string, unknown>[] {
  const combinedResults: Record<string, unknown>[] = [];
  resultRecords.forEach((resultRecord, i) => {
    if (includeSuccesses || !resultRecord.Success) {
      combinedResults.push(buildBulkResultRow(resultRecord, sourceRecords[i]));
    }
  });
  return combinedResults;
}

/** Slice the source records submitted for a given batch, matching the CSV split order */
export function getMassUpdateBatchSourceRecords(
  records: Record<string, unknown>[],
  batchIdToIndex: Record<string, number>,
  batchId: string,
  batchSize: number,
): Record<string, unknown>[] {
  const startIdx = batchIdToIndex[batchId] * batchSize;
  return records.slice(startIdx, startIdx + batchSize);
}

export function getValidationSoqlQuery(row: MetadataRow) {
  return composeSoqlQueryOptionalCustomWhereClause(row, [`Count()`], { includeCustom: true, isAggregate: true });
}

/**
 * The `(clause) OR (clause)` WHERE fragment for the row's custom criteria, or null when it has none.
 */
function getCustomCriteriaWhereClause(row: Pick<MetadataRow, 'configuration'>): string | null {
  const whereClauses = row.configuration
    .filter(
      ({ transformationOptions }) => transformationOptions.criteria === 'custom' && isValidWhereClause(transformationOptions.whereClause),
    )
    .map(({ transformationOptions }) => `(${normalizeWhereClause(transformationOptions.whereClause)})`)
    .join(' OR ');
  return whereClauses || null;
}

/**
 * Which of the already-fetched `records` match the row's custom criteria, resolved with `WHERE Id IN (...)`
 * queries scoped to those records. Short-circuited when every criteria on the row is custom, because the
 * fetched records are then all custom matches by construction and there is nothing to narrow.
 */
async function queryCustomCriteriaRecordIds(
  row: MetadataRow,
  records: SalesforceRecord[],
  customWhereClause: string,
  org: SalesforceOrgUi,
): Promise<Set<string>> {
  const recordIds = records.map(({ Id }) => Id);
  if (!recordIds.length) {
    return new Set();
  }
  if (row.configuration.every(({ transformationOptions }) => transformationOptions.criteria === 'custom')) {
    return new Set(recordIds);
  }

  const baseSoql = composeQuery({ fields: [getField('Id')], sObject: row.sobject });
  const { queryResults } = await queryAllFromList<SalesforceRecord>(org, buildChunkedIdInQueries(baseSoql, recordIds, customWhereClause));
  return new Set(queryResults.records.map(({ Id }) => Id));
}

/**
 * The records a row will update, plus which of them matched the row's custom criteria (which
 * {@link prepareRecords} needs to decide per-field whether the criteria was met).
 *
 * A row can mix custom criteria with `all` / `onlyIfBlank` / `onlyIfNotBlank` criteria, and a single
 * query cannot both union the two and report which records matched which - so without a limit this is
 * just two queries merged. With a limit it cannot be, because a `LIMIT` on each query windows each
 * criteria independently rather than windowing the union that validation counted: the merged set would
 * overshoot the limit, and paging with `OFFSET` would walk the two queries past each other and skip
 * records entirely. A limited row therefore fetches the same unioned window validation counted, then
 * resolves custom-criteria membership within that window by Id.
 */
export async function queryRecordsForRow(
  row: MetadataRow,
  fields: string[],
  org: SalesforceOrgUi,
): Promise<{ records: SalesforceRecord[]; customCriteriaRecordIds: Set<string> }> {
  const { limit, offset } = getEffectiveRecordLimit(row);
  const customWhereClause = getCustomCriteriaWhereClause(row);

  if (limit || offset) {
    const windowQuery = composeSoqlQueryOptionalCustomWhereClause(row, fields, { includeCustom: true });
    if (!windowQuery) {
      return { records: [], customCriteriaRecordIds: new Set() };
    }
    const { queryResults } = await queryAll<SalesforceRecord>(org, windowQuery);
    const records = queryResults.records;
    return {
      records,
      customCriteriaRecordIds: customWhereClause ? await queryCustomCriteriaRecordIds(row, records, customWhereClause, org) : new Set(),
    };
  }

  const standardQuery = composeSoqlQueryOptionalCustomWhereClause(row, fields);
  const customWhereClauseQuery = composeSoqlQueryCustomWhereClause(row, fields);

  const recordsById: Record<string, SalesforceRecord> = {};
  const customCriteriaRecordIds = new Set<string>();

  if (standardQuery) {
    await queryAll<SalesforceRecord>(org, standardQuery).then((res) =>
      res.queryResults.records.forEach((record) => {
        recordsById[record.Id] = record;
      }),
    );
  }

  if (customWhereClauseQuery) {
    await queryAll<SalesforceRecord>(org, customWhereClauseQuery).then((res) =>
      res.queryResults.records.forEach((record) => {
        recordsById[record.Id] = record;
        customCriteriaRecordIds.add(record.Id);
      }),
    );
  }

  return { records: Object.values(recordsById), customCriteriaRecordIds };
}

export async function queryAndPrepareRecordsForUpdate(row: MetadataRow, fields: string[], org: SalesforceOrgUi) {
  const { records, customCriteriaRecordIds } = await queryRecordsForRow(row, fields, org);
  return prepareRecords(records, row.configuration, customCriteriaRecordIds);
}

export function composeSoqlQueryOptionalCustomWhereClause(
  row: MetadataRow,
  fields: string[],
  { includeCustom = false, isAggregate = false }: { includeCustom?: boolean; isAggregate?: boolean } = {},
) {
  const query: Query = {
    fields: fields.map((field) => getField(field)),
    sObject: row.sobject,
  };

  let soql = composeQuery(query);

  const processAllRecords = row.configuration.some((config) => config.transformationOptions.criteria === 'all');

  const whereClauses = row.configuration
    .map(({ selectedField, transformationOptions }) => {
      if (transformationOptions.criteria === 'onlyIfBlank' && selectedField) {
        return `(${selectedField} = NULL)`;
      } else if (transformationOptions.criteria === 'onlyIfNotBlank' && selectedField) {
        return `(${selectedField} != NULL)`;
      } else if (includeCustom && transformationOptions.criteria === 'custom' && isValidWhereClause(transformationOptions.whereClause)) {
        return `(${normalizeWhereClause(transformationOptions.whereClause)})`;
      }
      return null;
    })
    .filter(Boolean)
    .join(' OR ');

  if (!processAllRecords && !whereClauses) {
    return null;
  }

  if (!processAllRecords && whereClauses) {
    soql += ` WHERE ${whereClauses}`;
  }

  soql += getLimitAndOffsetClause(row, { isAggregate });

  logger.info('composeSoqlQueryExceptCustomWhereClause()', { soql });
  return soql;
}

export function composeSoqlQueryCustomWhereClause(row: MetadataRow, fields: string[]) {
  const query: Query = {
    fields: fields.map((field) => getField(field)),
    sObject: row.sobject,
  };

  const whereClauses = getCustomCriteriaWhereClause(row);

  if (!whereClauses) {
    return null;
  }

  const soql = `${composeQuery(query)} WHERE ${whereClauses}${getLimitAndOffsetClause(row, { isAggregate: false })}`;

  logger.info('composeSoqlQueryCustomWhereClause()', { soql });
  return soql;
}

/**
 * Used from places where records are already fetched (query results).
 *
 * When `idsToInclude` is provided (the user chose a specific set of records — selected, filtered, or the
 * first browser set), only those records are re-fetched via chunked `WHERE Id IN (...)` queries instead of
 * downloading the entire result set and filtering client-side. When omitted (All records), the full query
 * is re-run. Pass `signal` to allow cancellation and `onProgress` to report fetch progress.
 */
export async function fetchRecordsWithRequiredFields({
  selectedOrg,
  parsedQuery,
  idsToInclude,
  configuration,
  signal,
  onProgress,
}: {
  selectedOrg: SalesforceOrgUi;
  parsedQuery: Query;
  idsToInclude?: Set<string>;
  configuration: MetadataRowConfiguration[];
  signal?: AbortSignal;
  onProgress?: (fetched: number, total: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  // selectedField is required so that transformationOptions.criteria can be applied to records
  const fieldsRequiredInRecords = new Set(['Id']);

  configuration.forEach(({ transformationOptions, selectedField }) => {
    if (selectedField) {
      fieldsRequiredInRecords.add(selectedField);
      if (transformationOptions.option === 'anotherField') {
        const { alternateField } = transformationOptions;
        // This should always exist in this state
        if (!alternateField) {
          throw new Error('Alternate field is required');
        }
        fieldsRequiredInRecords.add(alternateField);
      }
    }
  });

  const fields = Array.from(fieldsRequiredInRecords).map((field) => getField(field));

  // Re-fetch only the specific records the user chose, querying by Id instead of the full result set.
  if (idsToInclude) {
    const idsToFetch = Array.from(idsToInclude);
    if (idsToFetch.length === 0) {
      return [];
    }
    // Build a minimal query (drop the original WHERE/LIMIT/ORDER BY); the Id list is already the exact set.
    const baseSoql = composeQuery({ sObject: parsedQuery.sObject, fields });
    const soqlQueries = buildChunkedIdInQueries(baseSoql, idsToFetch);
    const { queryResults } = await queryAllFromList(
      selectedOrg,
      soqlQueries,
      false,
      false,
      (fetched) => onProgress?.(fetched, idsToFetch.length),
      signal,
    );
    return queryResults.records;
  }

  // All records - re-run the original query (criteria is applied client-side downstream)
  const { queryResults } = await queryAll(selectedOrg, composeQuery({ ...parsedQuery, fields }), false, false, onProgress, signal);
  return queryResults.records;
}

export function prepareRecords(
  records: SalesforceRecord[],
  configuration: MetadataRowConfiguration[],
  customCriteriaRecordIds: Set<string> = new Set(),
) {
  return records.map((record) => {
    const newRecord = { ...record };
    configuration.forEach(({ selectedField, selectedFieldMetadata, transformationOptions }) => {
      const isBoolean = selectedFieldMetadata?.type === 'boolean';
      const emptyFieldValue = isBoolean ? false : SFDC_BULK_API_NULL_VALUE;
      if (selectedField) {
        // Exit early if the criteria is not met, Set to null so the results show this field was not modified, otherwise it shows record field value
        if (transformationOptions.criteria === 'onlyIfBlank' && !isNil(record[selectedField])) {
          newRecord[selectedField] = null;
          return;
        }
        if (transformationOptions.criteria === 'onlyIfNotBlank' && isNil(record[selectedField])) {
          newRecord[selectedField] = null;
          return;
        }
        if (transformationOptions.criteria === 'custom' && !customCriteriaRecordIds.has(record.Id)) {
          newRecord[selectedField] = null;
          return;
        }

        if (transformationOptions.option === 'anotherField' && transformationOptions.alternateField) {
          newRecord[selectedField] = lodashGet(newRecord, transformationOptions.alternateField, emptyFieldValue);
        } else if (transformationOptions.option === 'staticValue') {
          newRecord[selectedField] = transformationOptions.staticValue;
        } else if (transformationOptions.option === 'null') {
          newRecord[selectedField] = emptyFieldValue;
        }
      }
    });
    return newRecord;
  });
}

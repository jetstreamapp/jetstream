import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { queryAll, queryAllFromList } from '@jetstream/shared/data';
import { escapeSoqlString } from '@jetstream/shared/ui-utils';
import { DescribeGlobalSObjectResult, ListItem, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Query, composeQuery, getField, isQueryValid } from '@jetstreamapp/soql-parser-js';
import lodashGet from 'lodash/get';
import isNil from 'lodash/isNil';
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
 * Split a set of record Ids into as few `WHERE Id IN (...)` queries as possible while keeping each query
 * under {@link MAX_ID_QUERY_LENGTH} so it does not blow past Salesforce's query-URL length limit.
 */
function buildChunkedIdInQueries(baseSoql: string, ids: string[]): string[] {
  const queries: string[] = [];
  const wrapperLength = baseSoql.length + ' WHERE Id IN ()'.length;
  let chunk: string[] = [];
  let chunkLength = wrapperLength;

  const flushChunk = () => {
    if (chunk.length > 0) {
      queries.push(`${baseSoql} WHERE Id IN (${chunk.join(',')})`);
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

export const startsWithWhereRgx = /^( )*WHERE( )*/i;

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
    if (transformationOptions.criteria === 'custom') {
      if (!transformationOptions.whereClause || !isQueryValid(`WHERE ${transformationOptions.whereClause}`, { allowPartialQuery: true })) {
        return false;
      }
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

export function getValidationSoqlQuery(row: MetadataRow) {
  return composeSoqlQueryOptionalCustomWhereClause(row, [`Count()`], true);
}

export async function queryAndPrepareRecordsForUpdate(row: MetadataRow, fields: string[], org: SalesforceOrgUi) {
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

  return prepareRecords(Object.values(recordsById), row.configuration, customCriteriaRecordIds);
}

export function composeSoqlQueryOptionalCustomWhereClause(row: MetadataRow, fields: string[], includeCustom = false) {
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
      } else if (
        includeCustom &&
        transformationOptions.criteria === 'custom' &&
        transformationOptions.whereClause &&
        isQueryValid(`WHERE ${transformationOptions.whereClause}`, { allowPartialQuery: true })
      ) {
        return `(${transformationOptions.whereClause})`;
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

  logger.info('composeSoqlQueryExceptCustomWhereClause()', { soql });
  return soql;
}

export function composeSoqlQueryCustomWhereClause(row: MetadataRow, fields: string[]) {
  const query: Query = {
    fields: fields.map((field) => getField(field)),
    sObject: row.sobject,
  };

  const whereClauses = row.configuration
    .filter(
      ({ transformationOptions }) =>
        transformationOptions.criteria === 'custom' &&
        transformationOptions.whereClause &&
        isQueryValid(`WHERE ${transformationOptions.whereClause}`, { allowPartialQuery: true }),
    )
    .map(({ transformationOptions }) => `(${transformationOptions.whereClause})`)
    .join(' OR ');

  if (!whereClauses) {
    return null;
  }

  const soql = `${composeQuery(query)} WHERE ${whereClauses}`;

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

import { logger } from '@jetstream/shared/client-logger';
import { queryAll } from '@jetstream/shared/data';
import { DescribeGlobalSObjectResult, ListItem, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import isNil from 'lodash/isNil';
import { Query, composeQuery, getField, isQueryValid } from 'soql-parser-js';
import { MetadataRow, TransformationOptions } from './mass-update-records.types';

export const startsWithWhereRgx = /^( )*WHERE( )*/i;

export function filterMassUpdateSobject(sobject: DescribeGlobalSObjectResult) {
  return (
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
  if (!row) {
    return false;
  }
  if (!row.selectedField) {
    return false;
  }
  if (row.transformationOptions.option === 'anotherField' && !row.transformationOptions.alternateField) {
    return false;
  }
  if (row.transformationOptions.option === 'staticValue' && !row.transformationOptions.staticValue) {
    return false;
  }
  if (row.transformationOptions.criteria === 'custom') {
    if (
      !row.transformationOptions.whereClause ||
      !isQueryValid(`WHERE ${row.transformationOptions.whereClause}`, { allowPartialQuery: true })
    ) {
      return false;
    }
  }
  return true;
}

export function getFieldsToQuery({
  transformationOptions,
  selectedField,
}: Pick<MetadataRow, 'selectedField' | 'transformationOptions'>): string[] {
  let fields = ['Id', selectedField];
  if (transformationOptions.option === 'anotherField' && transformationOptions.alternateField) {
    fields.push(transformationOptions.alternateField);
  }
  // ensure no duplicates
  fields = Array.from(new Set(fields));
  return fields.filter(Boolean) as string[];
}

export function getValidationSoqlQuery(row: MetadataRow) {
  return composeSoqlQuery(row, [`Count()`]);
}

export function composeSoqlQuery(row: MetadataRow, fields: string[]) {
  const query: Query = {
    fields: fields.map((field) => getField(field)),
    sObject: row.sobject,
  };

  if (row.transformationOptions.criteria === 'onlyIfBlank' && row.selectedField) {
    query.where = {
      left: {
        field: row.selectedField,
        operator: '=',
        value: 'null',
        literalType: 'NULL',
      },
    };
  } else if (row.transformationOptions.criteria === 'onlyIfNotBlank' && row.selectedField) {
    query.where = {
      left: {
        field: row.selectedField,
        operator: '!=',
        value: 'null',
        literalType: 'NULL',
      },
    };
  }
  let soql = composeQuery(query);

  if (
    row.transformationOptions.criteria === 'custom' &&
    row.transformationOptions.whereClause &&
    isQueryValid(`WHERE ${row.transformationOptions.whereClause}`, { allowPartialQuery: true })
  ) {
    soql += ` WHERE ${row.transformationOptions.whereClause}`;
  }

  logger.info('soqlQuery()', { soql });
  return soql;
}

/**
 * Used from places where records are already fetched (query results,)
 */
export async function fetchRecordsWithRequiredFields({
  selectedOrg,
  records: existingRecords,
  parsedQuery,
  transformationOptions,
  selectedField,
  idsToInclude,
}: {
  selectedOrg: SalesforceOrgUi;
  records: SalesforceRecord[];
  parsedQuery: Query;
  transformationOptions: TransformationOptions;
  selectedField: string;
  idsToInclude?: Set<string>;
}): Promise<any[]> {
  // selectedField is required so that transformationOptions.criteria can be applied to records
  const fieldsRequiredInRecords = new Set(['Id', selectedField]);

  if (transformationOptions.option === 'anotherField') {
    const { alternateField } = transformationOptions;
    // This should always exist in this state
    if (!alternateField) {
      throw new Error('Alternate field is required');
    }
    fieldsRequiredInRecords.add(alternateField);
  }

  // Re-fetch records - this may not always be required, but for consistency this will happen every time
  parsedQuery = { ...parsedQuery, fields: Array.from(fieldsRequiredInRecords).map((field) => getField(field)) };
  const { queryResults } = await queryAll(selectedOrg, composeQuery(parsedQuery));
  let { records } = queryResults;

  // if user has filtered/selected records, only include those
  if (idsToInclude) {
    records = records.filter((record) => idsToInclude.has(record.Id));
  }

  // Skip records that don't meet additional criteria
  if (transformationOptions.criteria === 'onlyIfBlank') {
    records = records.filter((record) => isNil(record[selectedField]));
  } else if (transformationOptions.criteria === 'onlyIfNotBlank') {
    records = records.filter((record) => !isNil(record[selectedField]));
  }

  return records;
}

import { logger } from '@jetstream/shared/client-logger';
import { MAX_RECORDS_PER_GROUP } from '@jetstream/shared/constants';
import { describeSObject } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getHttpMethod, groupByFlat, pluralizeFromNumber, transformRecordForDataLoad } from '@jetstream/shared/utils';
import { CompositeGraphRequest, Field, InsertUpdateUpsert, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { DepGraph, DepGraphCycleError } from 'dependency-graph';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import * as XLSX from 'xlsx';
import {
  BuildDataGraphResult,
  LoadMultiObjectData,
  LoadMultiObjectDataError,
  LoadMultiObjectGroupInfo,
  LoadMultiObjectRecord,
  LoadMultiObjectRequestWithResult,
  ParseWorkbookResult,
} from './load-records-multi-object-types';

const WORKSHEET_LOCATIONS = {
  sobject: 'B1',
  operation: 'B2',
  externalId: 'B3',
  referenceId: 'A5',
  dataStartCell: `A5`,
  dataStartRow: 4,
};

// Only ever used with .replace() - a global regex is unsafe with .test() because lastIndex persists between calls
const SURROUNDING_BRACKETS_RGX = /^\{|\}$/g;
const IS_REFERENCE_RGX = /^\{.+\}$/;
const VALID_REF_ID_RGX = /^[0-9A-Za-z][0-9A-Za-z_]*$/;
const VALID_OPERATIONS = ['INSERT', 'UPDATE', 'UPSERT'];

/** Minimal record info required to map composite requests/results back to source rows */
type RecordLookup = Record<string, Pick<LoadMultiObjectRecord, 'sobject' | 'operation' | 'externalId' | 'worksheet' | 'recordIdx'>>;

function getExcelRow(recordIdx: number) {
  return WORKSHEET_LOCATIONS.dataStartRow + 2 + recordIdx;
}

/** Returns the inner value if wrapped in {curly braces}, otherwise null */
function getBracketedValue(value: unknown): string | null {
  if (isString(value) && IS_REFERENCE_RGX.test(value.trim())) {
    return value.trim().replace(SURROUNDING_BRACKETS_RGX, '').trim();
  }
  return null;
}

/**
 * Row keys drop the {curly braces} that mark a lookup column, so every header - including the
 * Reference Id header read from cell A5 - must go through this to line up with the parsed rows.
 */
function normalizeHeader(header: unknown): string {
  const trimmedHeader = isNil(header) ? '' : String(header).trim();
  return IS_REFERENCE_RGX.test(trimmedHeader) ? trimmedHeader.replace(SURROUNDING_BRACKETS_RGX, '').trim() : trimmedHeader;
}

/**
 * Reference Ids are matched as strings across all worksheets, but Excel hands back raw cell values,
 * so a Reference Id of `1` arrives as a number while every lookup to it arrives as the string `'1'`.
 * Normalize to a trimmed string before using one as a key, a graph node, or a comparison.
 */
export function getReferenceId(record: Record<string, unknown> | undefined, referenceColumnHeader: string | undefined): string | null {
  const value = record?.[referenceColumnHeader || ''];
  if (isNil(value)) {
    return null;
  }
  return String(value).trim() || null;
}

/** A column that will be sent to Salesforce, paired with the field its value is written to */
export interface LoadableColumn {
  header: string;
  /** For a relationship column (`Account.Ext_Id__c`) this is the field on the RELATED object */
  field: Field;
}

export interface DatasetColumns {
  loadable: LoadableColumn[];
  /** One warning per column that will be dropped, keyed to the column so the grid can flag it */
  skipped: LoadMultiObjectDataError[];
}

/**
 * Resolves a column header to the field its value is written to, plus the field that determines whether the
 * operation is allowed to write it at all.
 *
 * A relationship column (`Account.Ext_Id__c`) is written as a nested lookup: the value belongs to the related
 * object's field, but it reaches Salesforce through the lookup field on THIS object, so that is what has to be
 * writable. Both must resolve - a relationship path pointing at a field that does not exist on the related
 * object (or is not an external Id) cannot be loaded.
 */
function getFieldForHeader(dataset: LoadMultiObjectData, header: string): { field: Field; fieldToWriteThrough: Field } | undefined {
  const field = dataset.fieldsByName?.[header.toLowerCase()];
  if (!header.includes('.')) {
    return field ? { field, fieldToWriteThrough: field } : undefined;
  }
  const [relationshipName] = header.toLowerCase().split('.');
  const lookupField = dataset.fieldsByRelationshipName?.[relationshipName];
  return field && lookupField ? { field, fieldToWriteThrough: lookupField } : undefined;
}

/** Why the operation cannot write this field, or null when it can */
function getUnwritableFieldReason(
  field: Field,
  { operation, externalId }: { operation: InsertUpdateUpsert; externalId?: Maybe<string> },
): string | null {
  // The record Id identifies the record to update, and the upsert external Id is sent in the URL, not the body
  if (operation === 'UPDATE' && field.name.toLowerCase() === 'id') {
    return null;
  }
  if (operation === 'UPSERT' && externalId && field.name.toLowerCase() === externalId.toLowerCase()) {
    return null;
  }

  if (operation === 'INSERT' && !field.createable) {
    return `"${field.name}" cannot be set when creating records`;
  }
  if (operation === 'UPDATE' && !field.updateable) {
    return `"${field.name}" cannot be changed on existing records`;
  }
  // Upsert creates some records and updates others, so a field has to be writable both ways to be safe
  if (operation === 'UPSERT' && (!field.createable || !field.updateable)) {
    return `"${field.name}" cannot be set when creating or updating records`;
  }
  return null;
}

function getSkippedColumnError(dataset: LoadMultiObjectData, header: string, reason: string): LoadMultiObjectDataError {
  return {
    property: 'data',
    code: 'SKIPPED_COLUMN',
    worksheet: dataset.worksheet,
    location: header,
    locationType: 'COLUMN',
    header,
    severity: 'warning',
    message: `The column "${header}" will be skipped because ${reason}.`,
  };
}

/**
 * Splits a worksheet's columns into the ones that will be sent to Salesforce and the ones that will be dropped.
 *
 * This is the single source of truth for that decision: `buildDataGraph` builds every record from `loadable`
 * and validation reports `skipped` as warnings, so a column can never be dropped without the user being told.
 *
 * Columns are dropped rather than blocking the load because Salesforce rejects the whole record when it
 * contains a field the operation cannot write - system fields such as CreatedDate are the common case, since
 * they come along with an exported query.
 */
export function getDatasetColumns(
  dataset: LoadMultiObjectData,
  { operation, externalId }: { operation: InsertUpdateUpsert; externalId?: Maybe<string> },
): DatasetColumns {
  // Nothing is knowable until the object was described - the object error already blocks the load
  if (!dataset.metadata) {
    return { loadable: [], skipped: [] };
  }

  return dataset.headers.reduce(
    (output: DatasetColumns, header) => {
      const resolvedField = getFieldForHeader(dataset, header);
      if (!resolvedField) {
        output.skipped.push(
          getSkippedColumnError(
            dataset,
            header,
            `the field does not exist on the object "${dataset.sobject}" or you do not have permission to access it`,
          ),
        );
        return output;
      }

      const unwritableReason = getUnwritableFieldReason(resolvedField.fieldToWriteThrough, { operation, externalId });
      if (unwritableReason) {
        output.skipped.push(getSkippedColumnError(dataset, header, unwritableReason));
        return output;
      }

      output.loadable.push({ header, field: resolvedField.field });
      return output;
    },
    { loadable: [], skipped: [] },
  );
}

/**
 * Upsert requires an external Id that is both a column in the file and flagged as an External Id in Salesforce.
 * Shared by the initial validation and by an operation change made in the UI, so the rules only exist once.
 */
function getExternalIdErrors(
  dataset: LoadMultiObjectData,
  { operation, externalId }: { operation: InsertUpdateUpsert; externalId?: Maybe<string> },
): LoadMultiObjectDataError[] {
  if (operation !== 'UPSERT') {
    return [];
  }
  const toError = (message: string): LoadMultiObjectDataError => ({
    property: 'externalId',
    worksheet: dataset.worksheet,
    location: WORKSHEET_LOCATIONS.externalId,
    locationType: 'CELL',
    message,
  });

  if (!externalId) {
    return [toError(`An external Id is required for upsert.`)];
  }

  const errors: LoadMultiObjectDataError[] = [];
  if (!dataset.headers.some((header) => header.toLowerCase() === externalId.toLowerCase())) {
    errors.push(toError(`The external Id "${externalId}" must be included as a field in the dataset.`));
  }
  if (!dataset.fieldsByName?.[externalId.toLowerCase()]?.externalId) {
    errors.push(toError(`The external Id "${externalId}" must exist and must be marked as an external id in Salesforce.`));
  }
  return errors;
}

/** The external Id stored with the casing Salesforce uses, falling back to what the file/user provided */
function getExternalIdWithSalesforceCasing(dataset: LoadMultiObjectData, externalId: Maybe<string>): string | undefined {
  if (!externalId) {
    return undefined;
  }
  return dataset.fieldsByName?.[externalId.toLowerCase()]?.name || externalId;
}

/**
 * Applies an operation/external Id change made in the UI to a worksheet, re-running the checks those two
 * values control - which columns can be written included, since that depends on the operation. Every other
 * error (Reference Ids, data) is unaffected by the change and is carried over untouched, so nothing has to be
 * re-parsed or re-described.
 *
 * Returns a new dataset - the caller replaces it in state, which re-derives the errors and the graph.
 */
export function applyDatasetConfiguration(
  dataset: LoadMultiObjectData,
  { operation, externalId }: { operation: InsertUpdateUpsert; externalId?: Maybe<string> },
): LoadMultiObjectData {
  const errors = dataset.errors.filter(
    ({ property, code }) => property !== 'operation' && property !== 'externalId' && code !== 'SKIPPED_COLUMN',
  );
  errors.push(...getExternalIdErrors(dataset, { operation, externalId }));

  const updatedDataset: LoadMultiObjectData = {
    ...dataset,
    operation,
    // The external Id is only meaningful for upsert, and is stored with the casing Salesforce uses
    externalId: operation === 'UPSERT' ? getExternalIdWithSalesforceCasing(dataset, externalId) : undefined,
    errors,
  };

  // Which columns are writable depends on the operation, so this is re-derived rather than carried over
  updatedDataset.errors = [...errors, ...getDatasetColumns(updatedDataset, { operation, externalId: updatedDataset.externalId }).skipped];
  return updatedDataset;
}

/**
 * Parses an excel workbook and builds datasets that can be validated and previewed.
 * Datasets are always returned, even when they contain errors, so the UI can render the data with errors annotated.
 */
export async function parseWorkbook(workbook: XLSX.WorkBook, org: SalesforceOrgUi): Promise<ParseWorkbookResult> {
  const workbookErrors: LoadMultiObjectDataError[] = [];
  const sheetNames = workbook.SheetNames.filter((sheetName) => {
    const isSkipped = sheetName.toLowerCase().includes('instructions');
    // The template ships with a tab named exactly "Instructions" - only warn when some other sheet is skipped by the name rule
    if (isSkipped && sheetName.trim().toLowerCase() !== 'instructions') {
      workbookErrors.push({
        property: null,
        worksheet: sheetName,
        location: null,
        locationType: 'SHEET',
        severity: 'warning',
        message: `The worksheet "${sheetName}" was skipped because its name contains "instructions".`,
      });
    }
    return !isSkipped;
  });

  if (sheetNames.length === 0) {
    workbookErrors.push({
      property: null,
      worksheet: 'Workbook',
      location: null,
      locationType: 'SHEET',
      message: `No data worksheets were found in this file. Add at least one worksheet based on the template. Any worksheet with "instructions" in its name is skipped.`,
    });
    return { datasets: [], workbookErrors };
  }

  const datasets = sheetNames.reduce((output: LoadMultiObjectData[], sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const dataset: Partial<LoadMultiObjectData> = { worksheet: sheetName, errors: [] };

    try {
      dataset.sobject = worksheet[WORKSHEET_LOCATIONS.sobject].v.toLowerCase();
    } catch (ex) {
      logger.warn('Error parsing object name', ex);
      dataset.errors = dataset.errors || [];
      dataset.errors.push({
        property: 'sobject',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.sobject,
        locationType: 'CELL',
        message: `Cell B1 must contain the Object API Name (e.g. "Account"). The cell is blank or could not be read.`,
      });
    }
    try {
      dataset.operation = worksheet[WORKSHEET_LOCATIONS.operation].v.toUpperCase();
    } catch (ex) {
      logger.warn('Error parsing operation', ex);
      dataset.errors = dataset.errors || [];
      dataset.errors.push({
        property: 'operation',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.operation,
        locationType: 'CELL',
        message: `Cell B2 must contain the operation: Insert, Update, or Upsert. The cell is blank or could not be read.`,
      });
    }
    try {
      dataset.externalId = worksheet[WORKSHEET_LOCATIONS.externalId]?.v;
    } catch (ex) {
      logger.warn('Error parsing external Id', ex);
      // only return error if this is an upsert operation
      if (dataset.operation?.toLowerCase() === 'upsert') {
        dataset.errors = dataset.errors || [];
        dataset.errors.push({
          property: 'externalId',
          worksheet: sheetName,
          location: WORKSHEET_LOCATIONS.externalId,
          locationType: 'CELL',
          message: `Cell B3 must contain the API name of an External Id field when the operation is Upsert. The cell is blank or could not be read.`,
        });
      }
    }
    try {
      // Parse data to array of array, then build objects
      const data: string[][] = XLSX.utils.sheet_to_json(worksheet, {
        dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
        defval: '',
        blankrows: false,
        rawNumbers: true,
        range: WORKSHEET_LOCATIONS.dataStartRow,
        header: 1,
      });

      const dataHeaders = (data[0] || []).filter(Boolean).map((header) => header.trim());

      if (dataHeaders.length !== new Set(dataHeaders).size) {
        dataset.errors = dataset.errors || [];
        dataset.errors.push({
          property: 'data',
          worksheet: sheetName,
          location: `${WORKSHEET_LOCATIONS.dataStartRow + 1}`,
          locationType: 'ROW',
          message: `There are duplicate values in your header, every value must be unique. "${dataHeaders.join('", "')}".`,
        });
      }

      dataset.data = data.slice(1).map((row) =>
        row.reduce((currRow: Record<string, string | null>, cell, i) => {
          if (!dataHeaders[i] || dataHeaders[i].toLowerCase().startsWith('__empty')) {
            return currRow;
          }

          currRow[normalizeHeader(dataHeaders[i])] = cell ?? null;
          return currRow;
        }, {}),
      );

      // init remaining data
      dataset.referenceColumnHeader = normalizeHeader(worksheet[WORKSHEET_LOCATIONS.referenceId]?.v);
      const headers = dataHeaders.filter(
        (field) => !!field && !field.toLowerCase().startsWith('__empty') && normalizeHeader(field) !== dataset.referenceColumnHeader,
      );
      dataset.headers = headers.map(normalizeHeader);
      dataset.referenceHeaders = new Set(headers.filter((header) => IS_REFERENCE_RGX.test(header.trim())).map(normalizeHeader));
      dataset.dataById = dataset.data.reduce((output: Record<string, any>, row, i) => {
        const referenceId = getReferenceId(row, dataset.referenceColumnHeader) || uniqueId('reference_');
        if (output[referenceId]) {
          dataset.errors = dataset.errors || [];
          dataset.errors.push({
            property: 'data',
            worksheet: sheetName,
            location: `A${getExcelRow(i)}`,
            locationType: 'CELL',
            rowIndexes: [i],
            message: `The Reference Id "${referenceId}" is used for multiple records. Every record across all worksheets must have a unique Reference Id.`,
          });
        }
        output[referenceId] = row;
        return output;
      }, {});

      if (dataset.data.length === 0) {
        dataset.errors = dataset.errors || [];
        dataset.errors.push({
          property: 'data',
          worksheet: sheetName,
          location: null,
          locationType: 'SHEET',
          message: `This worksheet has no data rows. Add records starting on row 6, or remove the worksheet.`,
        });
      }
    } catch (ex) {
      logger.warn('Error parsing record data', ex);
      dataset.errors = dataset.errors || [];
      dataset.errors.push({
        property: 'data',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.dataStartCell,
        locationType: 'CELL',
        message: `Jetstream could not read the data on this worksheet. Check that headers are on row 5, data starts on row 6, and the sheet matches the template layout.`,
      });
    }

    // Ensure the dataset is always renderable by the preview UI, even when parsing partially failed
    dataset.data = dataset.data || [];
    dataset.dataById = dataset.dataById || {};
    dataset.headers = dataset.headers || [];
    dataset.referenceHeaders = dataset.referenceHeaders || new Set();

    return [...output, dataset as LoadMultiObjectData];
  }, []);

  await validateObjectData(org, datasets);

  return { datasets, workbookErrors };
}

/**
 * Validates a dataset and potentially adds errors to anything that fails validation
 * This method also fetches fields and adds the field metadata to the dataset
 *
 * @param org
 * @param datasets
 */
async function validateObjectData(org: SalesforceOrgUi, datasets: LoadMultiObjectData[]) {
  const referenceIds = new Set<string>();
  for (const dataset of datasets) {
    try {
      const { worksheet, operation, externalId, headers, errors, referenceColumnHeader } = dataset;
      const errorsByProperty = groupByFlat(errors, 'property');

      /** SOBJECT */
      if (!errorsByProperty.sobject) {
        try {
          dataset.metadata = (await describeSObject(org, dataset.sobject)).data;
          dataset.sobject = dataset.metadata.name;
          dataset.fieldsByName = dataset.metadata.fields.reduce((output: Record<string, Field>, item) => {
            output[item.name.toLowerCase()] = item;
            return output;
          }, {});

          /**
           * If there are fields with external relationships, attempt to fetch the metadata for any related object
           * If none are found that match, then it will be found during the missing fields step
           */
          try {
            const fieldsWithRelationships = headers.filter((header) => header.includes('.'));
            if (fieldsWithRelationships.length) {
              dataset.fieldsByRelationshipName = dataset.metadata.fields
                .filter((field) => field.relationshipName)
                .reduce((output: Record<string, Field>, item) => {
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  output[item.relationshipName!.toLowerCase()] = item;
                  return output;
                }, {});

              for (const relationshipField of fieldsWithRelationships) {
                try {
                  const [relationship] = relationshipField.split('.');
                  const foundField = dataset.fieldsByRelationshipName[relationship.toLowerCase()];
                  if (foundField?.referenceTo?.[0]) {
                    // Add all external id fields to dataset.fieldsByName with the full path to the field
                    (await describeSObject(org, foundField.referenceTo[0])).data.fields
                      .filter((field) => !!field.externalId)
                      .forEach((relatedField) => {
                        dataset.fieldsByName[`${relationship}.${relatedField.name}`.toLowerCase()] = relatedField;
                      });
                  }
                } catch (ex) {
                  // failed to fetch related object metadata or something
                  logger.warn('Error parsing record record metadata', ex);
                }
              }
            }
          } catch (ex) {
            // failed to process related fields metadata
            logger.warn('Error parsing record record metadata', ex);
          }
        } catch (ex) {
          errors.push({
            property: 'sobject',
            worksheet,
            location: WORKSHEET_LOCATIONS.sobject,
            locationType: 'CELL',
            message: `The object "${dataset.sobject}" could not be loaded from the org. Check the API name in cell B1 and that you have access to this object. (Salesforce: ${getErrorMessage(
              ex,
            )})`,
          });
        }
      }

      /** OPERATION */
      if (!errorsByProperty.operation && (!operation || !VALID_OPERATIONS.includes(operation))) {
        errors.push({
          property: 'operation',
          worksheet,
          location: WORKSHEET_LOCATIONS.operation,
          locationType: 'CELL',
          message: `The operation is not valid: "${operation}". Valid operations are "${VALID_OPERATIONS.map((operation) =>
            operation.toLowerCase(),
          ).join('", "')}"`,
        });
      }

      /** EXTERNAL ID */
      if (!errorsByProperty.externalId && operation === 'UPSERT') {
        const externalIdErrors = getExternalIdErrors(dataset, { operation, externalId });
        errors.push(...externalIdErrors);
        if (!externalIdErrors.length) {
          // change External Id to properly cased value
          dataset.externalId = getExternalIdWithSalesforceCasing(dataset, externalId);
        }
      }

      /**
       * COLUMNS
       * Columns that cannot be written are a warning, not a blocker - they are dropped from the load and
       * everything else on the row still loads. This is derived outside the `data` guard so that the columns
       * warned about here are always exactly the columns buildDataGraph drops.
       */
      errors.push(...getDatasetColumns(dataset, { operation: dataset.operation, externalId: dataset.externalId }).skipped);

      /** FIELDS */
      if (!errorsByProperty.data) {
        if (!referenceColumnHeader) {
          errors.push({
            property: 'data',
            worksheet,
            location: WORKSHEET_LOCATIONS.referenceId,
            locationType: 'CELL',
            message: `The column header for the Reference Id is blank and must have a unique value.`,
          });
        }

        if (referenceColumnHeader) {
          const missingRefIdRowIndexes = dataset.data.reduce((output: number[], row, i) => {
            if (!getReferenceId(row, referenceColumnHeader)) {
              output.push(i);
            }
            return output;
          }, []);
          if (missingRefIdRowIndexes.length) {
            errors.push({
              property: 'data',
              worksheet,
              location: 'A',
              locationType: 'COLUMN',
              header: referenceColumnHeader,
              rowIndexes: missingRefIdRowIndexes,
              message: `${formatNumber(missingRefIdRowIndexes.length)} ${pluralizeFromNumber('row', missingRefIdRowIndexes.length)} ${
                missingRefIdRowIndexes.length === 1 ? 'is' : 'are'
              } missing a Reference Id. Make sure you do not have any accidental data in your spreadsheet and clear the contents of any unused rows/columns in your spreadsheet.`,
            });
          }

          const invalidRefIds = dataset.data.reduce((output: { rowIndex: number; referenceId: string }[], row, i) => {
            const referenceId = getReferenceId(row, referenceColumnHeader);
            if (referenceId && !VALID_REF_ID_RGX.test(referenceId)) {
              output.push({ rowIndex: i, referenceId });
            }
            return output;
          }, []);
          if (invalidRefIds.length) {
            errors.push({
              property: 'data',
              worksheet,
              location: 'A',
              locationType: 'COLUMN',
              header: referenceColumnHeader,
              rowIndexes: invalidRefIds.map(({ rowIndex }) => rowIndex),
              message: `The following Reference ${pluralizeFromNumber('Id', invalidRefIds.length)} have invalid characters: ${invalidRefIds
                .slice(0, 25)
                .map(({ referenceId }) => `"${referenceId}"`)
                .join(', ')}. A Reference Id must start with a letter or number and may only contain letters, numbers, and underscores.`,
            });
          }
        }
      }

      /** REFERENCE ID */
      Object.keys(dataset.dataById).forEach((referenceId, i) => {
        if (referenceIds.has(referenceId)) {
          errors.push({
            property: 'data',
            worksheet,
            location: `A${getExcelRow(i)}`,
            locationType: 'CELL',
            rowIndexes: [i],
            message: `The Reference Id "${referenceId}" is used for multiple records. Every record across all worksheets must have a unique Reference Id.`,
          });
        }
        referenceIds.add(referenceId);
      });
    } catch (ex) {
      logger.warn('Error validating record data', ex);
      dataset.errors.push({
        property: 'data',
        worksheet: dataset.worksheet,
        location: WORKSHEET_LOCATIONS.dataStartCell,
        locationType: 'CELL',
        message: `There was an unexpected error processing your file. Make sure that your file is in the correct format based on the provided template.`,
      });
    }
  }
}

/**
 * Build a collection of graphs based on the dataset.
 *
 * Pure function: never mutates the provided datasets and never throws for data problems.
 * All problems are collected and returned in `errors`.
 *
 * @param datasets
 * @param apiVersion
 * @returns
 */
export function buildDataGraph(
  datasets: LoadMultiObjectData[],
  apiVersion: string,
  options: { insertNulls: boolean; dateFormat: string },
): BuildDataGraphResult {
  const { dateFormat, insertNulls } = options;
  const errors: LoadMultiObjectDataError[] = [];
  const graphs: Record<string, CompositeGraphRequest> = {};

  /** If there is an error during dependency processing, this links back to the dataset for error identification */
  const refIdToDataset = datasets.reduce((output: Record<string, LoadMultiObjectData>, dataset) => {
    dataset.data.forEach((record) => {
      const referenceId = getReferenceId(record, dataset.referenceColumnHeader);
      if (referenceId) {
        output[referenceId] = dataset;
      }
    });
    return output;
  }, {});

  const recordsByRefId = datasets.reduce((output: Record<string, LoadMultiObjectRecord>, dataset) => {
    const lowercaseExternalId = dataset.externalId?.toLowerCase();
    /**
     * Columns the operation cannot write (unknown, system, read-only) never reach Salesforce - it rejects the
     * entire record when one of them is included. Validation reports these same columns as warnings.
     */
    const { loadable } = getDatasetColumns(dataset, { operation: dataset.operation, externalId: dataset.externalId });

    dataset.data.forEach((record, recordIdx) => {
      /** Transform record values and flag which fields have references to other records */
      const { transformedRecord, externalIdValue, recordIdForUpdate, dependencies } = loadable.reduce(
        (
          {
            transformedRecord,
            externalIdValue,
            recordIdForUpdate,
            dependencies,
          }: {
            transformedRecord: Record<string, any>;
            externalIdValue: string | null;
            recordIdForUpdate: string | null;
            dependencies: string[];
          },
          { header, field },
        ) => {
          const isRelatedField = header.includes('.');
          const rawValue = record[header];
          const valueIsNull = isNil(rawValue) || (isString(rawValue) && !rawValue);
          const bracketedValue = getBracketedValue(rawValue);

          if (dataset.referenceHeaders.has(header) || bracketedValue !== null) {
            // Lookup to another record in this load - either the whole column is a reference column, or this one cell is {wrapped}
            const referenceValue = bracketedValue ?? (valueIsNull ? null : String(rawValue).trim());
            if (referenceValue) {
              // do not transform dependent field using transformRecordForDataLoad because we know it is a lookup
              transformedRecord[field.name] = `@{${referenceValue}.id}`;
              dependencies.push(referenceValue);
            } else if (insertNulls) {
              transformedRecord[field.name] = null;
            }
          } else if (dataset.operation === 'UPSERT' && !isRelatedField && lowercaseExternalId === field.name.toLowerCase()) {
            // External id used for upsert, this needs to be omitted from the record as the value is included in the URL
            externalIdValue = rawValue;
          } else if (insertNulls || !valueIsNull) {
            const value = transformRecordForDataLoad(rawValue, field.type, dateFormat);
            if (isRelatedField) {
              const [relationshipName] = header.toLowerCase().split('.');
              const relationshipField = dataset.fieldsByRelationshipName?.[relationshipName];
              if (relationshipField?.relationshipName && relationshipField.referenceTo?.length) {
                transformedRecord[relationshipField.relationshipName] = {
                  attributes: { type: relationshipField.referenceTo[0] },
                  [field.name]: value,
                };
              }
            } else {
              transformedRecord[field.name] = value;
            }
          }

          // for updates, we need to know the url to update the record - this could be a relationship id or hard-coded id
          if (dataset.operation === 'UPDATE' && !isRelatedField && field.name.toLowerCase() === 'id') {
            recordIdForUpdate = transformedRecord[field.name];
          }

          return { transformedRecord, externalIdValue, recordIdForUpdate, dependencies };
        },
        { transformedRecord: {}, externalIdValue: null, recordIdForUpdate: null, dependencies: [] },
      );

      const tempData: LoadMultiObjectRecord = {
        sobject: dataset.sobject,
        operation: dataset.operation,
        externalId: dataset.externalId,
        externalIdValue,
        recordIdForUpdate,
        // must match the stringified dependency values below - the graph keys nodes by identity, not by coercion
        referenceId: getReferenceId(record, dataset.referenceColumnHeader) ?? '',
        record: transformedRecord,
        worksheet: dataset.worksheet,
        recordIdx,
        dependsOn: dependencies,
      };

      output[tempData.referenceId] = tempData;
    });
    return output;
  }, {});

  const overallGraph = new DepGraph();

  Object.values(recordsByRefId).forEach((value) => {
    overallGraph.addNode(value.referenceId);
  });

  Object.values(recordsByRefId).forEach((value) => {
    value.dependsOn.forEach((dependency) => {
      try {
        overallGraph.addDependency(value.referenceId, dependency);
      } catch {
        const dataset = refIdToDataset[value.referenceId];
        errors.push({
          property: 'data',
          worksheet: dataset?.worksheet ?? value.worksheet,
          location: `${getExcelRow(value.recordIdx)}`,
          locationType: 'ROW',
          rowIndexes: [value.recordIdx],
          message: `The value "${dependency}" refers to a Reference Id that does not exist on any worksheet. Check for typos, or remove the curly braces if this should be a literal value.`,
        });
      }
    });
  });

  if (errors.length) {
    return { requests: [], errors, groupsByRefId: {} };
  }

  let topLevelNodes: string[];
  try {
    topLevelNodes = overallGraph.overallOrder(true);
  } catch (ex) {
    if (ex instanceof DepGraphCycleError) {
      const { cyclePath } = ex;
      const cycleDescription = cyclePath
        .map((refId, i) => {
          const cycleRecord = recordsByRefId[refId];
          // the last entry repeats the first - render it bare to close the loop visually
          if (!cycleRecord || (i === cyclePath.length - 1 && refId === cyclePath[0])) {
            return refId;
          }
          return `${refId} (sheet "${cycleRecord.worksheet}", row ${getExcelRow(cycleRecord.recordIdx)})`;
        })
        .join(' → ');
      const firstRecord = recordsByRefId[cyclePath[0]];
      errors.push({
        property: 'data',
        worksheet: firstRecord?.worksheet ?? 'Unknown',
        location: firstRecord ? `${getExcelRow(firstRecord.recordIdx)}` : null,
        locationType: 'ROW',
        rowIndexes: firstRecord ? [firstRecord.recordIdx] : undefined,
        message: `These records link to each other in a loop, so there is no valid order to load them: ${cycleDescription}. Remove one of the {reference} values to break the loop.`,
      });
      return { requests: [], errors, groupsByRefId: {} };
    }
    throw ex;
  }

  const unprocessedTopLevelNodes = new Set<string>(topLevelNodes);
  const nodeToTopLevelNodes: Record<string, string[]> = {};

  // rebuild dependency graphs for each top level node to split them out into multiple graphs

  // map all nodes to a top level node so we can lookup and pull in a related graph if required
  topLevelNodes.forEach((topLevelNode) => {
    nodeToTopLevelNodes[topLevelNode] = [topLevelNode];
    overallGraph.dependentsOf(topLevelNode).forEach((node) => {
      nodeToTopLevelNodes[node] = nodeToTopLevelNodes[node] || [];
      nodeToTopLevelNodes[node].push(topLevelNode);
    });
  });

  topLevelNodes.forEach((topLevelNode) => {
    // Top level node may have gotten pulled into another graph based on dependencies
    if (!unprocessedTopLevelNodes.has(topLevelNode)) {
      return;
    }
    unprocessedTopLevelNodes.delete(topLevelNode);
    graphs[topLevelNode] = {
      graphId: topLevelNode,
      compositeRequest: [],
    };
    const graph = new DepGraph();
    graph.addNode(topLevelNode);
    const dependents = overallGraph.dependentsOf(topLevelNode);

    processGraphDependency(recordsByRefId, unprocessedTopLevelNodes, graph, overallGraph, nodeToTopLevelNodes)(dependents);

    graphs[topLevelNode].compositeRequest = graph.overallOrder().map((node) => {
      let url = `/services/data/${apiVersion}/sobjects/${recordsByRefId[node].sobject}`;
      if (recordsByRefId[node].operation === 'UPDATE' && recordsByRefId[node].recordIdForUpdate) {
        url = `/services/data/${apiVersion}/sobjects/${recordsByRefId[node].sobject}/${recordsByRefId[node].recordIdForUpdate}`;
      } else if (recordsByRefId[node].operation === 'UPSERT' && recordsByRefId[node].externalId) {
        url += `/${recordsByRefId[node].externalId}/${recordsByRefId[node].externalIdValue}`;
      }
      return {
        method: getHttpMethod(recordsByRefId[node].operation),
        url,
        referenceId: node,
        body: recordsByRefId[node].record,
      };
    });

    const graphSize = graphs[topLevelNode]?.compositeRequest?.length || 0;
    if (graphSize > MAX_RECORDS_PER_GROUP) {
      const dataset = refIdToDataset[topLevelNode];
      const record = recordsByRefId[topLevelNode];
      errors.push({
        property: 'data',
        worksheet: dataset?.worksheet ?? record.worksheet,
        location: `${getExcelRow(record.recordIdx)}`,
        locationType: 'ROW',
        rowIndexes: [record.recordIdx],
        message: `The record with Reference Id "${topLevelNode}" is connected to ${formatNumber(
          graphSize,
        )} related records. Rows linked by {Reference Id} values form one group, loaded as a single all-or-nothing transaction limited to ${MAX_RECORDS_PER_GROUP} records. This limit is per group, not per file. To fix: remove some {reference} links or split this group across multiple loads.`,
      });
    }
  });

  const groupsByRefId: Record<string, LoadMultiObjectGroupInfo> = {};
  Object.values(graphs).forEach(({ graphId, compositeRequest }) => {
    const size = compositeRequest?.length || 0;
    compositeRequest?.forEach(({ referenceId }) => {
      groupsByRefId[referenceId] = { graphId, size };
    });
  });

  if (errors.length) {
    // groupsByRefId is still returned so the UI can show group membership/sizes alongside the errors
    return { requests: [], errors, groupsByRefId };
  }

  return { requests: transformGraphRequestsToRequestWithResults(Object.values(graphs), recordsByRefId), errors: [], groupsByRefId };
}

/**
 * Builds a fresh set of requests containing only the groups whose LATEST attempt failed,
 * re-packed into new HTTP payloads. Pass requests in run order (initial load first, then retries)
 * so a group fixed by a later retry is not retried again. Returns an empty array when nothing failed.
 */
export function buildRetryRequests(requests: LoadMultiObjectRequestWithResult[]): LoadMultiObjectRequestWithResult[] {
  const latestByGraphId: Record<string, { isFailed: boolean; graph: CompositeGraphRequest }> = {};
  const recordLookup: RecordLookup = {};

  requests.forEach((request) => {
    Object.values(request.dataWithResultsByGraphId).forEach(({ graphId, isSuccess, compositeRequest }) => {
      // errorMessage means the entire HTTP request failed, so every graph in it failed
      const isFailed = request.errorMessage ? true : isSuccess === false;
      latestByGraphId[graphId] = { isFailed, graph: { graphId, compositeRequest } };
      compositeRequest.forEach(({ referenceId }) => {
        const recordInfo = request.recordWithResponseByRefId[referenceId];
        if (recordInfo) {
          recordLookup[referenceId] = {
            sobject: recordInfo.sobject,
            operation: recordInfo.operation,
            externalId: recordInfo.externalId,
            worksheet: recordInfo.worksheet,
            recordIdx: recordInfo.rowIndex,
          };
        }
      });
    });
  });

  const failedGraphs = Object.values(latestByGraphId)
    .filter(({ isFailed }) => isFailed)
    .map(({ graph }) => graph);

  if (!failedGraphs.length) {
    return [];
  }
  return transformGraphRequestsToRequestWithResults(failedGraphs, recordLookup, 'retry');
}

function processGraphDependency(
  recordsByRefId: Record<string, LoadMultiObjectRecord>,
  unprocessedTopLevelNodes: Set<string>,
  graph: DepGraph<unknown>,
  overallGraph: DepGraph<unknown>,
  nodeToTopLevelNodes: Record<string, string[]>,
) {
  return function processDependents(dependents: string[]) {
    // add all child nodes to graph
    dependents.forEach((node) => graph.addNode(node));

    // add dependencies for each node
    dependents.forEach((node) => {
      Object.values(recordsByRefId[node].dependsOn).forEach((dependency) => {
        // if a node has a dependency that does not exist in this graph, we need to combine additional graphs into this one
        if (!graph.hasNode(dependency)) {
          // Pull in related graph and process all nodes in that graph
          graph.addNode(dependency);
          nodeToTopLevelNodes[dependency].forEach((relatedTopLevelNode) => {
            if (unprocessedTopLevelNodes.has(relatedTopLevelNode)) {
              unprocessedTopLevelNodes.delete(relatedTopLevelNode);
              graph.addNode(relatedTopLevelNode);
              processDependents(overallGraph.dependentsOf(relatedTopLevelNode));
            }
          });
        }

        graph.addDependency(node, dependency);
      });
    });
  };
}

function transformGraphRequestsToRequestWithResults(
  graphs: CompositeGraphRequest[],
  recordsByRefId: RecordLookup,
  keyPrefix = 'request',
): LoadMultiObjectRequestWithResult[] {
  return splitRequestsToMaxSize(graphs, MAX_RECORDS_PER_GROUP).map((compositeRequestGraph, i): LoadMultiObjectRequestWithResult => ({
    key: `${keyPrefix}-${i}`,
    loading: false,
    started: null,
    finished: null,
    data: compositeRequestGraph,
    results: null,
    dataWithResultsByGraphId: groupByFlat(
      compositeRequestGraph.map((item) => ({
        graphId: item.graphId,
        isSuccess: null,
        compositeRequest: item.compositeRequest || [],
        compositeResponse: null,
      })),
      'graphId',
    ),
    recordWithResponseByRefId: groupByFlat(
      compositeRequestGraph.flatMap(
        ({ compositeRequest, graphId }) =>
          compositeRequest?.map((item) => ({
            referenceId: item.referenceId,
            sobject: recordsByRefId[item.referenceId].sobject,
            operation: recordsByRefId[item.referenceId].operation,
            externalId: recordsByRefId[item.referenceId].externalId,
            worksheet: recordsByRefId[item.referenceId].worksheet,
            rowIndex: recordsByRefId[item.referenceId].recordIdx,
            graphId,
            request: item,
            response: null,
          })) || [],
      ),
      'referenceId',
    ),
  }));
}

/** Total number of records across every graph in the provided requests */
export function getRecordCount(requests: LoadMultiObjectRequestWithResult[]) {
  return requests.reduce(
    (count, request) => count + request.data.reduce((graphCount, graph) => graphCount + (graph.compositeRequest?.length || 0), 0),
    0,
  );
}

export function splitRequestsToMaxSize(items: CompositeGraphRequest[], maxSize: number): CompositeGraphRequest[][] {
  if (!maxSize || maxSize < 1) {
    throw new Error('maxSize must be greater than 0');
  }
  // Nothing to load means no requests - returning one empty request would look like a loadable payload of zero records
  if (!items || items.length === 0) {
    return [];
  }
  const output: CompositeGraphRequest[][] = [];
  let currSet: CompositeGraphRequest[] = [];
  let currPayloadNodes = new Set<string>();
  let currCount = 0;
  items.forEach((item) => {
    if (!item.compositeRequest) {
      return;
    }
    // get all variations of nodes
    item.compositeRequest.forEach((req) => currPayloadNodes.add(req.url.split('/')[5]));
    /**
     * 75 graphs allowed per payload
     * 500 records per payload
     * 14 nodes per payload (node is determined by sobject endpoint + api version)
     * -> if there are more than 15 nodes in first dataset, then ignore this restriction (but it will likely fail to load)
     */
    if (!currSet.length || (currSet.length < 75 && currCount + item.compositeRequest.length <= maxSize && currPayloadNodes.size < 15)) {
      currSet.push(item);
      currCount += item.compositeRequest.length;
    } else {
      output.push(currSet);
      currSet = [item];
      currCount = item.compositeRequest.length;
      // seed with the current item's nodes - a plain new Set() would under-count objects for every payload after the first
      currPayloadNodes = new Set(item.compositeRequest.map((req) => req.url.split('/')[5]));
    }
  });
  if (currSet.length > 0) {
    output.push(currSet);
  }
  return output;
}

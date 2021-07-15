import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getHttpMethod, getMapOf, pluralizeFromNumber, transformRecordForDataLoad } from '@jetstream/shared/utils';
import { CompositeGraphRequest, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { DepGraph } from 'dependency-graph';
import { Field } from 'jsforce';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import * as XLSX from 'xlsx';
import { LoadMultiObjectData, LoadMultiObjectRecord, LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

const WORKSHEET_LOCATIONS = {
  sobject: 'B1',
  operation: 'B2',
  externalId: 'B3',
  referenceId: 'A5',
  dataStartCell: `A5`,
  dataStartRow: 4,
};

const SURROUNDING_BRACKETS_RGX = /^{|}$/g;
const VALID_REF_ID_RGX = /[0-9A-Za-z][0-9A-Za-z_]+$/;
const VALID_OPERATIONS = ['INSERT', 'UPDATE', 'UPSERT'];
const MAX_REQ_SIZE = 500;

/**
 * Parses an excel workbook and builds datasets that can be validated and
 * @param workbook
 * @returns
 */
export async function parseWorkbook(workbook: XLSX.WorkBook, org: SalesforceOrgUi): Promise<LoadMultiObjectData[]> {
  const sheetNames = workbook.SheetNames.filter((sheet) => !sheet.toLowerCase().includes('instructions'));
  const datasets = sheetNames.reduce((output: LoadMultiObjectData[], sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const dataset: Partial<LoadMultiObjectData> = { worksheet: sheetName, errors: [] };

    try {
      dataset.sobject = worksheet[WORKSHEET_LOCATIONS.sobject].v.toLowerCase();
    } catch (ex) {
      logger.warn('Error parsing object name', ex);
      dataset.errors.push({
        property: 'sobject',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.sobject,
        message: `Error getting the object name.`,
      });
    }
    try {
      dataset.operation = worksheet[WORKSHEET_LOCATIONS.operation].v.toUpperCase();
    } catch (ex) {
      logger.warn('Error parsing operation', ex);
      dataset.errors.push({
        property: 'operation',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.operation,
        message: `Error getting the operation.`,
      });
    }
    try {
      dataset.externalId = worksheet[WORKSHEET_LOCATIONS.externalId]?.v?.toLowerCase();
    } catch (ex) {
      logger.warn('Error parsing external Id', ex);
      // only return error if this is an upsert operation
      if (dataset.operation?.toLowerCase() === 'upsert') {
        dataset.errors.push({
          property: 'externalId',
          worksheet: sheetName,
          location: WORKSHEET_LOCATIONS.sobject,
          message: `Error getting the external Id`,
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

      const dataHeaders = data[0].filter(Boolean);

      if (dataHeaders.length !== new Set(dataHeaders).size) {
        dataset.errors.push({
          property: 'data',
          worksheet: sheetName,
          location: WORKSHEET_LOCATIONS.dataStartCell,
          message: `There are duplicate values in your header, every value must be unique. "${dataHeaders.join('", "')}".`,
        });
      }

      dataset.data = data.slice(1).map((row) =>
        row.reduce((currRow, cell, i) => {
          if (!dataHeaders[i] || dataHeaders[i].toLowerCase().startsWith('__empty')) {
            return currRow;
          }
          const currHeader = SURROUNDING_BRACKETS_RGX.test(dataHeaders[i])
            ? dataHeaders[i].replace(SURROUNDING_BRACKETS_RGX, '').trim()
            : dataHeaders[i].trim();
          currRow[currHeader] = cell ?? null;
          return currRow;
        }, {})
      );

      // init remaining data
      dataset.referenceColumnHeader = worksheet[WORKSHEET_LOCATIONS.referenceId]?.v;
      const headers = dataHeaders.filter(
        (field) => !!field && !field.toLowerCase().startsWith('__empty') && field !== dataset.referenceColumnHeader
      );
      dataset.headers = headers.map((header) => header.replace(SURROUNDING_BRACKETS_RGX, '').trim());
      dataset.referenceHeaders = new Set(
        headers.filter((header) => SURROUNDING_BRACKETS_RGX.test(header)).map((header) => header.replace(SURROUNDING_BRACKETS_RGX, ''))
      );
      dataset.dataById = dataset.data.reduce((output: MapOf<any>, row, i) => {
        const referenceId = row[dataset.referenceColumnHeader] || uniqueId('reference_');
        if (output[referenceId]) {
          dataset.errors.push({
            property: 'data',
            worksheet: sheetName,
            location: `A${WORKSHEET_LOCATIONS.dataStartRow + 2 + i}`,
            message: `The Reference Id "${referenceId}" is used for multiple records. Every record across all worksheets must have a unique Reference Id.`,
          });
        }
        output[referenceId] = row;
        return output;
      }, {});
    } catch (ex) {
      logger.warn('Error parsing record data', ex);
      dataset.errors.push({
        property: 'data',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.dataStartCell,
        message: `Error getting the record data.`,
      });
    }

    return [...output, dataset as LoadMultiObjectData];
  }, []);

  await validateObjectData(org, datasets);

  return datasets;
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
      const errorsByProperty = getMapOf(errors, 'property');

      /** SOBJECT */
      if (!errorsByProperty.sobject) {
        try {
          dataset.metadata = (await describeSObject(org, dataset.sobject)).data;
          dataset.fieldsByName = dataset.metadata.fields.reduce((output: MapOf<Field>, item) => {
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
                .reduce((output: MapOf<Field>, item) => {
                  output[item.relationshipName.toLowerCase()] = item;
                  return output;
                }, {});

              for (let relationshipField of fieldsWithRelationships) {
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
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.sobject,
            message: `${ex.message} - "${dataset.sobject}".`,
          });
        }
      }

      /** OPERATION */
      if (!errorsByProperty.operation && (!operation || !VALID_OPERATIONS.includes(operation))) {
        errors.push({
          property: 'operation',
          worksheet: worksheet,
          location: WORKSHEET_LOCATIONS.operation,
          message: `The operation is not valid: "${operation}". Valid operations are "${VALID_OPERATIONS.map((operation) =>
            operation.toLowerCase()
          ).join('", "')}"`,
        });
      }

      /** EXTERNAL ID */
      if (!errorsByProperty.externalId && operation === 'UPSERT') {
        if (!externalId) {
          errors.push({
            property: 'externalId',
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.externalId,
            message: `An external Id is required for upsert.`,
          });
        } else {
          if (!headers.find((header) => header === externalId)) {
            errors.push({
              property: 'externalId',
              worksheet: worksheet,
              location: WORKSHEET_LOCATIONS.externalId,
              message: `The external Id "${externalId}" must be included as a field in the dataset.`,
            });
          }
          if (!dataset.fieldsByName?.[externalId] || !dataset.fieldsByName[externalId].externalId) {
            errors.push({
              property: 'externalId',
              worksheet: worksheet,
              location: WORKSHEET_LOCATIONS.externalId,
              message: `The external Id "${externalId}" must exist and must be marked as an external id in Salesforce.`,
            });
          }
        }
      }

      /** FIELDS */
      if (!errorsByProperty.data) {
        if (!referenceColumnHeader) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.referenceId,
            message: `The column header for the Reference Id is blank and must have a unique value.`,
          });
        }

        const missingFields = headers.filter((header) => !dataset.fieldsByName?.[header.toLowerCase()]);
        if (missingFields.length) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.dataStartCell,
            message: `The following fields do not exist on the object "${
              dataset.sobject
            }" or you do not have permissions configured correctly: "${missingFields.join('", "')}".`,
          });
        }

        const invalidRefIds = dataset.data.filter((row) => !VALID_REF_ID_RGX.test(row[dataset.referenceColumnHeader]));
        if (invalidRefIds.length) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.dataStartCell,
            message: `The following Reference ${pluralizeFromNumber(
              'Id',
              invalidRefIds.length
            )} have invalid characters: ${invalidRefIds.slice(0, 10)}.`,
          });
        }
      }

      /** REFERENCE ID */
      Object.keys(dataset.dataById).forEach((referenceId, i) => {
        if (referenceIds.has(referenceId)) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: `A${WORKSHEET_LOCATIONS.dataStartRow + 2 + i}`,
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
        message: `There was an unexpected error processing your file. Make sure that your file is in the correct format based on the provided template.`,
      });
    }
  }
}

/**
 * Build a collection of graphs based on the dataset
 *
 * @param datasets
 * @param apiVersion
 * @returns
 */
export function getDataGraph(
  datasets: LoadMultiObjectData[],
  apiVersion: string,
  options: { insertNulls: boolean; dateFormat: string }
): LoadMultiObjectRequestWithResult[] {
  const { dateFormat, insertNulls } = options;
  const graphs: MapOf<CompositeGraphRequest> = {};

  /** If there is an error during dependency processing, this links back to the dataset for error identification */
  const refIdToDataset = datasets.reduce((output: MapOf<LoadMultiObjectData>, dataset) => {
    dataset.data.forEach((record) => {
      output[record[dataset.referenceColumnHeader]] = dataset;
    });
    return output;
  }, {});

  const recordsByRefId = datasets.reduce((output: MapOf<LoadMultiObjectRecord>, dataset) => {
    dataset.data.forEach((record, recordIdx) => {
      /** Transform record values and flag which fields have references to other records */
      const { transformedRecord, dependencies } = dataset.headers.reduce(
        ({ transformedRecord, dependencies }, header) => {
          const field = dataset.fieldsByName[header.toLowerCase()];
          let value = record[header];
          const valueIsNull = isNil(value) || (isString(value) && !value);
          let isDependentField = false;
          if (dataset.referenceHeaders.has(header)) {
            isDependentField = true;
          } else if (SURROUNDING_BRACKETS_RGX.test(record[header])) {
            record[header] = record[header].replace(SURROUNDING_BRACKETS_RGX, '').trim();
            isDependentField = true;
          }

          if (isDependentField) {
            if (record[field.name]) {
              // do not transform dependent field using transformRecordForDataLoad because we know it is a lookup
              transformedRecord[field.name] = `@{${record[field.name]}.id}`;
              dependencies.push(record[field.name]);
            } else if (insertNulls) {
              transformedRecord[field.name] = null;
            }
          } else if (insertNulls || !valueIsNull) {
            value = transformRecordForDataLoad(record[header], field.type, dateFormat);
            if (header.includes('.')) {
              const [relationshipName] = header.toLowerCase().split('.');
              const relationshipField = dataset.fieldsByRelationshipName?.[relationshipName];
              if (relationshipField) {
                transformedRecord[relationshipField.relationshipName] = {
                  attributes: { type: relationshipField.referenceTo[0] },
                  [field.name]: value,
                };
              }
            } else {
              transformedRecord[field.name] = value;
            }
          }

          return { transformedRecord, dependencies };
        },
        { transformedRecord: {}, dependencies: [] }
      );

      const tempData: LoadMultiObjectRecord = {
        sobject: dataset.sobject,
        operation: dataset.operation,
        externalId: dataset.externalId,
        referenceId: record[dataset.referenceColumnHeader],
        record: transformedRecord,
        recordIdx: recordIdx,
        dependsOn: dependencies,
      };

      output[tempData.referenceId] = tempData;
    });
    return output;
  }, {});

  const overallGraph = new DepGraph();
  let hasError = false;

  Object.values(recordsByRefId).forEach((value) => {
    overallGraph.addNode(value.referenceId);
  });

  Object.values(recordsByRefId).forEach((value) => {
    value.dependsOn.forEach((dependency) => {
      try {
        overallGraph.addDependency(value.referenceId, dependency);
      } catch (ex) {
        hasError = true;
        const dataset = refIdToDataset[value.referenceId];
        dataset.errors.push({
          property: 'data',
          worksheet: dataset.worksheet,
          location: `Row ${value.recordIdx + 1}`,
          message: `The Reference Id "${dependency}" is invalid, there is not a row in your file that has this Reference Id.`,
        });
      }
    });
  });

  if (hasError) {
    throw new Error('There was an error parsing the record dependencies');
  }

  const topLevelNodes = overallGraph.overallOrder(true);

  // rebuild dependency graphs for each top level node to split them out into multiple graphs
  topLevelNodes.forEach((topLevelNode) => {
    graphs[topLevelNode] = {
      graphId: topLevelNode,
      compositeRequest: [],
    };
    const graph = new DepGraph();
    graph.addNode(topLevelNode);
    const dependents = overallGraph.dependentsOf(topLevelNode);

    if (dependents.length >= MAX_REQ_SIZE) {
      const dataset = refIdToDataset[topLevelNode];
      const record = recordsByRefId[topLevelNode];
      dataset.errors.push({
        property: 'data',
        worksheet: dataset.worksheet,
        location: `Row ${record.recordIdx + 1}`,
        message: `The Reference Id "${topLevelNode}" has ${formatNumber(
          dependents.length
        )} dependent records. A maximum of ${MAX_REQ_SIZE} records can be related to each other in one data load`,
      });
      throw new Error('There was an error parsing the record dependencies');
    }

    dependents.forEach((node) => {
      graph.addNode(node);
    });

    dependents.forEach((node) => {
      Object.values(recordsByRefId[node].dependsOn).forEach((dependency) => {
        overallGraph.addDependency(node, dependency);
      });
    });
    graphs[topLevelNode].compositeRequest = graph.overallOrder().map((node) => {
      let url = `/services/data/${apiVersion}/sobjects/${recordsByRefId[node].sobject}`;
      if (recordsByRefId[node].operation === 'UPSERT' && recordsByRefId[node].externalId) {
        url += `/${recordsByRefId[node].externalId}`;
      }
      return {
        method: getHttpMethod(recordsByRefId[node].operation),
        url,
        referenceId: node,
        body: recordsByRefId[node].record,
      };
    });
  });

  return transformGraphRequestsToRequestWithResults(Object.values(graphs), recordsByRefId);
}

function transformGraphRequestsToRequestWithResults(
  graphs: CompositeGraphRequest[],
  recordsByRefId: MapOf<LoadMultiObjectRecord>
): LoadMultiObjectRequestWithResult[] {
  return splitRequestsToMaxSize(graphs, MAX_REQ_SIZE).map(
    (compositeRequestGraph, i): LoadMultiObjectRequestWithResult => ({
      key: `request-${i}`,
      loading: false,
      started: null,
      finished: null,
      data: compositeRequestGraph,
      results: null,
      dataWithResultsByGraphId: getMapOf(
        compositeRequestGraph.map((item) => ({
          graphId: item.graphId,
          isSuccess: null,
          compositeRequest: item.compositeRequest,
          compositeResponse: null,
        })),
        'graphId'
      ),
      recordWithResponseByRefId: getMapOf(
        compositeRequestGraph.flatMap(({ compositeRequest }) =>
          compositeRequest.map((item) => ({
            referenceId: item.referenceId,
            sobject: recordsByRefId[item.referenceId].sobject,
            operation: recordsByRefId[item.referenceId].operation,
            externalId: recordsByRefId[item.referenceId].externalId,
            request: item,
            response: null,
          }))
        ),
        'referenceId'
      ),
    })
  );
}

function splitRequestsToMaxSize(items: CompositeGraphRequest[], maxSize: number): CompositeGraphRequest[][] {
  if (!maxSize || maxSize < 1) {
    throw new Error('maxSize must be greater than 0');
  }
  if (!items || items.length === 0) {
    return [[]];
  }
  let output = [];
  let currSet = [];
  let currCount = 0;
  items.forEach((item) => {
    if (currCount + item.compositeRequest.length < maxSize) {
      currSet.push(item);
      currCount += item.compositeRequest.length;
    } else {
      output.push(currSet);
      currSet = [item];
      currCount = 0;
    }
  });
  if (currSet.length > 0) {
    output.push(currSet);
  }
  return output;
}

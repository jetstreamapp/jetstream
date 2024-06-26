import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { formatNumber, initXlsx } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getHttpMethod, groupByFlat, pluralizeFromNumber, transformRecordForDataLoad } from '@jetstream/shared/utils';
import { CompositeGraphRequest, Field, SalesforceOrgUi } from '@jetstream/types';
import { DepGraph } from 'dependency-graph';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import * as XLSX from 'xlsx';
import { LoadMultiObjectData, LoadMultiObjectRecord, LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

initXlsx(XLSX);

const WORKSHEET_LOCATIONS = {
  sobject: 'B1',
  operation: 'B2',
  externalId: 'B3',
  referenceId: 'A5',
  dataStartCell: `A5`,
  dataStartRow: 4,
};

const SURROUNDING_BRACKETS_RGX = /^{|}$/g;
const IS_REFERENCE_HEADER_RGX = new RegExp('^{.+}$');
const VALID_REF_ID_RGX = /^[0-9A-Za-z][0-9A-Za-z_]+$/;
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
      dataset.errors = dataset.errors || [];
      dataset.errors.push({
        property: 'sobject',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.sobject,
        locationType: 'CELL',
        message: `Error getting the object name.`,
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
        message: `Error getting the operation.`,
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
          location: WORKSHEET_LOCATIONS.sobject,
          locationType: 'CELL',
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

      const dataHeaders = data[0].filter(Boolean).map((header) => header.trim());

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

          const currHeader = SURROUNDING_BRACKETS_RGX.test(dataHeaders[i])
            ? dataHeaders[i].replace(SURROUNDING_BRACKETS_RGX, '').trim()
            : dataHeaders[i];
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
        headers.filter((header) => IS_REFERENCE_HEADER_RGX.test(header)).map((header) => header.replace(SURROUNDING_BRACKETS_RGX, ''))
      );
      dataset.dataById = dataset.data.reduce((output: Record<string, any>, row, i) => {
        const referenceId = row[dataset.referenceColumnHeader || ''] || uniqueId('reference_');
        if (output[referenceId]) {
          dataset.errors = dataset.errors || [];
          dataset.errors.push({
            property: 'data',
            worksheet: sheetName,
            location: `A${WORKSHEET_LOCATIONS.dataStartRow + 2 + i}`,
            locationType: 'CELL',
            message: `The Reference Id "${referenceId}" is used for multiple records. Every record across all worksheets must have a unique Reference Id.`,
          });
        }
        output[referenceId] = row;
        return output;
      }, {});
    } catch (ex) {
      logger.warn('Error parsing record data', ex);
      dataset.errors = dataset.errors || [];
      dataset.errors.push({
        property: 'data',
        worksheet: sheetName,
        location: WORKSHEET_LOCATIONS.dataStartCell,
        locationType: 'CELL',
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
            worksheet: worksheet,
            location: WORKSHEET_LOCATIONS.sobject,
            locationType: 'CELL',
            message: `${getErrorMessage(ex)} - "${dataset.sobject}".`,
          });
        }
      }

      /** OPERATION */
      if (!errorsByProperty.operation && (!operation || !VALID_OPERATIONS.includes(operation))) {
        errors.push({
          property: 'operation',
          worksheet: worksheet,
          location: WORKSHEET_LOCATIONS.operation,
          locationType: 'CELL',
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
            locationType: 'CELL',
            message: `An external Id is required for upsert.`,
          });
        } else {
          const externalIdLowercase = externalId.toLowerCase();
          if (!headers.find((header) => header.toLowerCase() === externalIdLowercase)) {
            errors.push({
              property: 'externalId',
              worksheet: worksheet,
              location: WORKSHEET_LOCATIONS.externalId,
              locationType: 'CELL',
              message: `The external Id "${externalId}" must be included as a field in the dataset.`,
            });
          }
          if (!dataset.fieldsByName?.[externalIdLowercase] || !dataset.fieldsByName[externalIdLowercase].externalId) {
            errors.push({
              property: 'externalId',
              worksheet: worksheet,
              location: WORKSHEET_LOCATIONS.externalId,
              locationType: 'CELL',
              message: `The external Id "${externalId}" must exist and must be marked as an external id in Salesforce.`,
            });
          } else {
            // change External Id to properly cased value
            dataset.externalId = dataset.fieldsByName[externalIdLowercase].name;
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
            locationType: 'CELL',
            message: `The column header for the Reference Id is blank and must have a unique value.`,
          });
        }

        const missingFields = headers.filter((header) => !dataset.fieldsByName?.[header.toLowerCase()]);
        if (missingFields.length) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: `${WORKSHEET_LOCATIONS.dataStartRow + 1}`,
            locationType: 'ROW',
            message: `The following fields do not exist on the object "${
              dataset.sobject
            }" or you do not have permissions configured correctly: "${missingFields.join('", "')}".`,
          });
        }

        const missingRefIds = dataset.data.filter((row) => !row[dataset.referenceColumnHeader]);
        if (missingRefIds.length) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: 'A',
            locationType: 'COLUMN',
            message: `${formatNumber(missingRefIds.length)} ${pluralizeFromNumber('row', missingRefIds.length)} ${
              missingRefIds.length === 1 ? 'is' : 'are'
            } missing a Reference Id. Make sure you do not have any accidental data in your spreadsheet and clear the contents of any unused rows/columns in your spreadsheet.`,
          });
        }

        const invalidRefIds = dataset.data.filter(
          (row) => !!row[dataset.referenceColumnHeader] && !VALID_REF_ID_RGX.test(row[dataset.referenceColumnHeader])
        );
        if (invalidRefIds.length) {
          errors.push({
            property: 'data',
            worksheet: worksheet,
            location: 'A',
            locationType: 'COLUMN',
            message: `The following Reference ${pluralizeFromNumber('Id', invalidRefIds.length)} have invalid characters: ${invalidRefIds
              .slice(0, 25)
              .map((row) => `"${row[dataset.referenceColumnHeader]}"`)
              .join(
                ', '
              )}. The referenceId must start with a letter or a number and must not contain anything besides letters, numbers, or underscores.`,
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
            locationType: 'CELL',
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
  const graphs: Record<string, CompositeGraphRequest> = {};

  /** If there is an error during dependency processing, this links back to the dataset for error identification */
  const refIdToDataset = datasets.reduce((output: Record<string, LoadMultiObjectData>, dataset) => {
    dataset.data.forEach((record) => {
      output[record[dataset.referenceColumnHeader]] = dataset;
    });
    return output;
  }, {});

  const recordsByRefId = datasets.reduce((output: Record<string, LoadMultiObjectRecord>, dataset) => {
    dataset.data.forEach((record, recordIdx) => {
      const lowercaseExternalId = dataset.externalId?.toLowerCase();
      /** Transform record values and flag which fields have references to other records */
      const { transformedRecord, externalIdValue, recordIdForUpdate, dependencies } = dataset.headers.reduce(
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
          header
        ) => {
          const isRelatedField = header.includes('.');
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
          } else if (dataset.operation === 'UPSERT' && !isRelatedField && lowercaseExternalId === field.name.toLowerCase()) {
            // External id used for upsert, this needs to be omitted from the record as the value is included in the URL
            externalIdValue = value;
          } else if (insertNulls || !valueIsNull) {
            value = transformRecordForDataLoad(record[header], field.type, dateFormat);
            if (header.includes('.')) {
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
        { transformedRecord: {}, externalIdValue: null, recordIdForUpdate: null, dependencies: [] }
      );

      const tempData: LoadMultiObjectRecord = {
        sobject: dataset.sobject,
        operation: dataset.operation,
        externalId: dataset.externalId,
        externalIdValue,
        recordIdForUpdate,
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
          location: `${WORKSHEET_LOCATIONS.dataStartRow + 1 + value.recordIdx + 1}`,
          locationType: 'ROW',
          message: `The Reference Id "${dependency}" is invalid, there is not a row in your file that has this Reference Id.`,
        });
      }
    });
  });

  if (hasError) {
    throw new Error('There was an error parsing the record dependencies');
  }

  const topLevelNodes = overallGraph.overallOrder(true);
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

    if ((graphs[topLevelNode]?.compositeRequest?.length || 0) >= MAX_REQ_SIZE) {
      const dataset = refIdToDataset[topLevelNode];
      const record = recordsByRefId[topLevelNode];
      dataset.errors.push({
        property: 'data',
        worksheet: dataset.worksheet,
        location: `${WORKSHEET_LOCATIONS.dataStartRow + 1 + record.recordIdx + 1}`,
        locationType: 'ROW',
        message: `The Reference Id "${topLevelNode}" has ${formatNumber(
          graphs[topLevelNode]?.compositeRequest?.length || 0
        )} dependent records. A maximum of ${MAX_REQ_SIZE} records can be related to each other in one data load`,
      });
      throw new Error('There was an error parsing the record dependencies');
    }
  });

  return transformGraphRequestsToRequestWithResults(Object.values(graphs), recordsByRefId);
}

function processGraphDependency(
  recordsByRefId: Record<string, LoadMultiObjectRecord>,
  unprocessedTopLevelNodes: Set<string>,
  graph: DepGraph<unknown>,
  overallGraph: DepGraph<unknown>,
  nodeToTopLevelNodes: Record<string, string[]>
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
            // unprocessedTopLevelNodes.delete(relatedTopLevelNode);
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
  recordsByRefId: Record<string, LoadMultiObjectRecord>
): LoadMultiObjectRequestWithResult[] {
  return splitRequestsToMaxSize(graphs, MAX_REQ_SIZE).map(
    (compositeRequestGraph, i): LoadMultiObjectRequestWithResult => ({
      key: `request-${i}`,
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
        'graphId'
      ),
      recordWithResponseByRefId: groupByFlat(
        compositeRequestGraph.flatMap(
          ({ compositeRequest }) =>
            compositeRequest?.map((item) => ({
              referenceId: item.referenceId,
              sobject: recordsByRefId[item.referenceId].sobject,
              operation: recordsByRefId[item.referenceId].operation,
              externalId: recordsByRefId[item.referenceId].externalId,
              request: item,
              response: null,
            })) || []
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
    if (!currSet.length || (currSet.length < 75 && currCount + item.compositeRequest.length < maxSize && currPayloadNodes.size < 15)) {
      currSet.push(item);
      currCount += item.compositeRequest.length;
    } else {
      output.push(currSet);
      currSet = [item];
      currCount = item.compositeRequest.length;
      currPayloadNodes = new Set();
    }
  });
  if (currSet.length > 0) {
    output.push(currSet);
  }
  return output;
}

import { ColDef, GetQuickFilterTextParams, ValueFormatterParams } from '@ag-grid-community/core';
import { getMetadataLabelFromFullName, ListMetadataResultItem } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS, INDEXED_DB } from '@jetstream/shared/constants';
import { ensureArray, getSuccessOrFailureChar, orderStringsBy, pluralizeFromNumber } from '@jetstream/shared/utils';
import {
  DeployResult,
  ListMetadataResult,
  MapOf,
  SalesforceDeployHistoryItem,
  SalesforceDeployHistoryType,
  SalesforceOrgUi,
} from '@jetstream/types';
import { DateFilterComparator, getCheckboxColumnDef } from '@jetstream/ui';
import parseISO from 'date-fns/parseISO';
import formatISO from 'date-fns/formatISO';
import formatDate from 'date-fns/format';
import isString from 'lodash/isString';
import { composeQuery, getField, Query } from 'soql-parser-js';
import { DeployMetadataTableRow } from '../deploy-metadata.types';
import localforage from 'localforage';
import { DeployOptions } from 'jsforce';
import JSZip from 'jszip';

const MAX_HISTORY_ITEMS = 500;

export function getDeploymentStatusUrl(id: string) {
  // double encode retUrl
  const address = encodeURIComponent(
    `/changemgmt/monitorDeploymentsDetails.apexp?asyncId=${id}&retURL=${encodeURIComponent('/changemgmt/monitorDeployment.apexp')}`
  );
  return `/lightning/setup/DeployStatus/page?address=${address}`;
}

export function getChangesetUrl(id: string) {
  if (!id) {
    return null;
  }
  const address = encodeURIComponent(`/changemgmt/outboundChangeSetDetailPage.apexp?id=${id}`);
  return `/lightning/setup/OutboundChangeSet/page?address=${address}`;
}

export async function getHistory() {
  return (await localforage.getItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory)) || [];
}

export async function getHistoryItemFile(item: SalesforceDeployHistoryItem) {
  if (item.fileKey) {
    return await localforage.getItem<ArrayBuffer>(item.fileKey);
  }
  return null;
}

export async function saveHistory({
  sourceOrg,
  destinationOrg,
  type,
  start,
  metadata,
  deployOptions,
  results,
  file,
}: {
  sourceOrg?: SalesforceOrgUi;
  destinationOrg: SalesforceOrgUi;
  type: SalesforceDeployHistoryType;
  start: Date;
  metadata?: MapOf<ListMetadataResult[]>;
  deployOptions: DeployOptions;
  results?: DeployResult;
  file?: ArrayBuffer | string;
}) {
  try {
    if (file && isString(file)) {
      try {
        file = await (await JSZip.loadAsync(file, { base64: true })).generateAsync({ type: 'arraybuffer' });
      } catch (ex) {
        logger.warn('[DEPLOY][HISTORY][ZIP PROCESSING ERROR]', ex);
        file = null;
      }
    }

    const newItem: SalesforceDeployHistoryItem = {
      key: `${destinationOrg.uniqueId}:${type}:${start.toISOString()}`,
      destinationOrgId: destinationOrg.uniqueId,
      destinationOrgLabel: `${destinationOrg.label} (${destinationOrg.orgName})`,
      start,
      finish: new Date(),
      url: results?.id ? getDeploymentStatusUrl(results.id) : null,
      status: results?.status || 'Failed',
      type,
      errorMessage: results?.errorMessage,
      metadata,
      deployOptions,
      results,
    };
    if (sourceOrg) {
      newItem.sourceOrgId = sourceOrg.uniqueId;
      newItem.sourceOrgLabel = `${sourceOrg.label} (${sourceOrg.orgName})`;
    }
    if (file && localforage.driver() === localforage.INDEXEDDB) {
      newItem.fileKey = `${INDEXED_DB.KEYS.deployHistory}:FILE:${newItem.key}`;
    }
    const existingItems = await getHistory();
    existingItems.unshift(newItem);
    await localforage.setItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory, existingItems.slice(0, MAX_HISTORY_ITEMS));
    logger.log('[DEPLOY][HISTORY][SAVE]', { newItem });
    //
    if (file && newItem.fileKey && localforage.driver() === localforage.INDEXEDDB) {
      await localforage.setItem(newItem.fileKey, file);
    }
    // delete files, if exists, for history items that were evicted from cache
    try {
      if (existingItems.length > MAX_HISTORY_ITEMS) {
        for (const item of existingItems.slice(MAX_HISTORY_ITEMS).filter((item) => item.fileKey)) {
          await localforage.removeItem(item.fileKey);
        }
      }
    } catch (ex) {
      logger.warn('[DEPLOY][HISTORY][CLEANUP ERROR] Error cleaning up files', ex);
    }
  } catch (ex) {
    logger.warn('[DEPLOY][HISTORY][SAVE ERROR]', ex);
  }
}

export function getQueryForUsers(): string {
  const query: Query = {
    fields: [getField('Id'), getField('Name'), getField('FirstName'), getField('LastName'), getField('Username'), getField('IsActive')],
    sObject: 'User',
    orderBy: [
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
  };
  const soql = composeQuery(query);
  logger.log('getQueryForUsers()', soql);
  return soql;
}

export function getQueryForPackage(): string {
  const query: Query = {
    fields: [getField('Id'), getField('Name'), getField('Description'), getField('IsManaged'), getField('Source'), getField('Status')],
    sObject: 'Project',
    orderBy: [
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
    where: {
      left: {
        field: 'IsManaged',
        operator: '=',
        value: 'FALSE',
        literalType: 'BOOLEAN',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'Status',
          operator: '=',
          value: 'ACTIVE',
          literalType: 'STRING',
        },
      },
    },
  };
  const soql = composeQuery(query);
  logger.log('getQueryForPackage()', soql);
  return soql;
}

export const dataTableDateFormatter = ({ value }: ValueFormatterParams | GetQuickFilterTextParams): string => {
  if (value instanceof Date) {
    return formatDate(value, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a);
  }
  return '';
};

export function getColumnDefinitions(): ColDef[] {
  const output: ColDef[] = [
    getCheckboxColumnDef(),
    {
      headerName: 'Metadata Type',
      colId: 'typeLabel',
      field: 'typeLabel',
      width: 200,
      rowGroup: true,
      hide: true,
      lockVisible: true,
      lockPosition: true,
    },
    {
      headerName: 'Name',
      colId: 'fullName',
      field: 'fullName',
      cellRenderer: 'valueOrLoading',
      width: 250,
      lockVisible: true,
      filterParams: {
        filters: [
          { filter: 'agTextColumnFilter' },
          {
            filter: 'agSetColumnFilter',
            filterParams: { valueFormatter: ({ value }: ValueFormatterParams) => decodeURIComponent(value || ''), showTooltips: true },
          },
        ],
      },
    },
    {
      headerName: 'Last Modified By',
      colId: 'lastModifiedByName',
      field: 'lastModifiedByName',
      width: 160,
    },
    {
      headerName: 'Last Modified',
      colId: 'lastModifiedDate',
      field: 'lastModifiedDate',
      width: 202,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filterParams: {
        comparator: DateFilterComparator,
        filters: [
          { filter: 'agDateColumnFilter', filterParams: { defaultOption: 'greaterThan', buttons: ['clear'] } },
          { filter: 'agSetColumnFilter', filterParams: { showTooltips: true } },
        ],
      },
    },
    {
      headerName: 'Created By',
      colId: 'createdByName',
      field: 'createdByName',
      width: 150,
    },
    {
      headerName: 'Created',
      colId: 'createdDate',
      field: 'createdDate',
      width: 202,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filterParams: {
        comparator: DateFilterComparator,
        filters: [
          { filter: 'agDateColumnFilter', filterParams: { defaultOption: 'greaterThan', buttons: ['clear'] } },
          { filter: 'agSetColumnFilter', filterParams: { showTooltips: true } },
        ],
      },
    },
    {
      headerName: 'Manageable State',
      colId: 'manageableState',
      field: 'manageableState',
      width: 170,
    },
  ];

  return output;
}

export function getRows(listMetadataItems: MapOf<ListMetadataResultItem>): DeployMetadataTableRow[] {
  const output: DeployMetadataTableRow[] = [];

  orderStringsBy(Object.keys(listMetadataItems)).forEach((metadataType) => {
    const { type, error, folder, items, lastRefreshed, loading } = listMetadataItems[metadataType];
    const typeLabel = getMetadataLabelFromFullName(type);
    if (loading || error) {
      // LOADING ROW
      output.push({
        key: metadataType,
        loading,
        lastRefreshed,
        error,
        type,
        typeLabel,
        folder,
      });
    } else if (items.length > 0) {
      // METADATA RETURNED
      items.forEach((metadata) => {
        const { id, fullName, lastModifiedByName, lastModifiedDate, createdByName, createdDate, manageableState } = metadata;
        output.push({
          key: `${metadataType}-${fullName}-${id}`,
          loading,
          lastRefreshed,
          error,
          type,
          typeLabel,
          folder,
          fullName,
          lastModifiedByName,
          lastModifiedDate,
          createdByName,
          createdDate,
          metadata,
          manageableState,
        });
      });
    } else {
      // EMPTY ROW - NO ITEMS RETURNED
      output.push({
        key: metadataType,
        loading,
        lastRefreshed,
        error,
        type,
        typeLabel,
        folder,
      });
    }
  });

  return output;
}

export function convertRowsForExport(
  rows: DeployMetadataTableRow[],
  selectedRows: Set<DeployMetadataTableRow>,
  limitToSelected = false
): MapOf<any>[] {
  return rows
    .filter((row) => row.fullName && row.metadata && (!limitToSelected || selectedRows.has(row)))
    .map((row) => ({
      Id: row.metadata.id,
      Type: row.metadata.type,
      Name: row.metadata.fullName,
      'Last Modified By': `${row.metadata.lastModifiedByName} (${row.metadata.lastModifiedById})`,
      'Last Modified Date': row.metadata.lastModifiedDate,
      'Created By': `${row.metadata.createdByName} (${row.metadata.createdById})`,
      CreatedDate: row.metadata.createdDate,
      'Manageable State': row.metadata.manageableState,
    }));
}

export function convertRowsToMapOfListMetadataResults(rows: DeployMetadataTableRow[]): MapOf<ListMetadataResult[]> {
  return rows.reduce((output: MapOf<ListMetadataResult[]>, row) => {
    if (row.metadata) {
      output[row.type] = output[row.type] || [];
      output[row.type].push(row.metadata);
    }
    return output;
  }, {});
}

/**
 * Convert deployment results into excel compatible data
 */
export function getDeployResultsExcelData(deployResults: DeployResult, deploymentUrl: string): MapOf<any[]> {
  // The data parsing from SOAP is not reliable, so we must ensure that the formats are correct
  if (deployResults.details) {
    if (deployResults.details.componentSuccesses) {
      deployResults.details.componentSuccesses = ensureArray(deployResults.details.componentSuccesses);
    }
    if (deployResults.details.componentFailures) {
      deployResults.details.componentFailures = ensureArray(deployResults.details.componentFailures);
    }

    if (deployResults.details.runTestResult) {
      if (deployResults.details.runTestResult.codeCoverage) {
        deployResults.details.runTestResult.codeCoverage = ensureArray(deployResults.details.runTestResult.codeCoverage);
        deployResults.details.runTestResult.codeCoverage.forEach((item) => {
          item.dmlInfo = ensureArray(item.dmlInfo);
          item.locationsNotCovered = ensureArray(item.locationsNotCovered);
          item.methodInfo = ensureArray(item.methodInfo);
          item.soqlInfo = ensureArray(item.soqlInfo);
        });
      }
      if (deployResults.details.runTestResult.codeCoverageWarnings) {
        deployResults.details.runTestResult.codeCoverageWarnings = ensureArray(deployResults.details.runTestResult.codeCoverageWarnings);
      }
      if (deployResults.details.runTestResult.failures) {
        deployResults.details.runTestResult.failures = ensureArray(deployResults.details.runTestResult.failures);
      }
      if (deployResults.details.runTestResult.flowCoverage) {
        deployResults.details.runTestResult.flowCoverage = ensureArray(deployResults.details.runTestResult.flowCoverage);
      }
      if (deployResults.details.runTestResult.flowCoverageWarnings) {
        deployResults.details.runTestResult.flowCoverageWarnings = ensureArray(deployResults.details.runTestResult.flowCoverageWarnings);
      }
      if (deployResults.details.runTestResult.successes) {
        deployResults.details.runTestResult.successes = ensureArray(deployResults.details.runTestResult.successes);
      }
    }
  }
  const xlsxData: MapOf<any[]> = {
    [`Summary`]: [
      ['Deployment Status URL', deploymentUrl],
      ['Id', deployResults.id],
      ['Status', deployResults.status],
      ['Success', deployResults.success],
      ['Started', getFriendlyTimestamp(deployResults.startDate)],
      ['Completed', getFriendlyTimestamp(deployResults.completedDate)],
      ['Check Only (Validate)', deployResults.checkOnly],
      ['Ignore Warnings', deployResults.ignoreWarnings],
      ['Rollback on Error', deployResults.rollbackOnError],
      ['Run Tests', deployResults.runTestsEnabled],
      ['Created By', `${deployResults.createdByName} (${deployResults.createdBy})`],
      ['Component Errors', deployResults.numberComponentErrors],
      ['Components Deployed', deployResults.numberComponentsDeployed],
      ['Components Total', deployResults.numberComponentsTotal],
      ['Test Errors', deployResults.numberTestErrors],
      ['Code Coverage Warnings', deployResults.details?.runTestResult?.codeCoverageWarnings?.length || 0],
      ['Tests Completed', deployResults.numberTestsCompleted],
      ['Tests Total', deployResults.numberTestsTotal],
    ],
    [`Successful Components`]:
      deployResults.details?.componentSuccesses
        ?.filter((item) => item.componentType)
        .map((item) => ({
          Id: item.id,
          'Api Name': decodeURIComponent(item.fullName),
          Type: item.componentType,
          Success: item.success,
          Created: item.created,
          Changed: item.changed,
          Deleted: item.deleted,
          'Created Date': getFriendlyTimestamp(item.createdDate),
        })) || [],
    [`Failed Components`]:
      deployResults.details?.componentFailures?.map((item) => ({
        Id: item.id,
        'Api Name': decodeURIComponent(item.fullName),
        Type: item.componentType,
        'Error Type': item.problemType,
        'Error Message': item.problem,
        Line: item.lineNumber,
        Column: item.columnNumber,
        Success: item.success,
        Created: item.created,
        Changed: item.changed,
        Deleted: item.deleted,
        'Created Date': getFriendlyTimestamp(item.createdDate),
      })) || [],
  };

  if (deployResults.details?.runTestResult) {
    if (deployResults.details.runTestResult.failures?.length) {
      xlsxData['Unit Test Failures'] = deployResults.details.runTestResult.failures.map((item) => ({
        'Class Name': item.name,
        'Method Name': item.methodName,
        time: item.time,
        Message: item.message,
        'Stack Trace': item.stackTrace,
      }));
    }
    if (deployResults.details.runTestResult.successes?.length) {
      xlsxData['Unit Tests Successes'] = deployResults.details.runTestResult.successes.map((item) => ({
        'Class Name': item.name,
        'Method Name': item.methodName,
        time: item.time,
      }));
    }
    if (deployResults.details.runTestResult.codeCoverage?.length) {
      xlsxData['Code Coverage Summary'] = deployResults.details.runTestResult.codeCoverage.map((item) => ({
        'Class Name': item.name,
        'Lines Covered': item.numLocations,
        'Lines Not Covered': item.numLocationsNotCovered,
      }));
    }
    if (deployResults.details.runTestResult.codeCoverageWarnings?.length) {
      xlsxData['Code Coverage Warnings'] = deployResults.details.runTestResult.codeCoverageWarnings.map((item) => ({
        'Class Name': item.name,
        Message: item.message,
      }));
    }
  }

  return xlsxData;
}

function getFriendlyTimestamp(value?: string) {
  if (!isString(value)) {
    return value;
  }
  return formatISO(parseISO(value));
}

export function getNotificationMessageBody(deployResults: DeployResult) {
  const { numberComponentErrors, numberComponentsDeployed, numberTestsCompleted, runTestsEnabled, details, success } = deployResults;
  let { numberTestErrors } = deployResults;
  numberTestErrors = numberTestErrors ?? 0;
  numberTestErrors = numberTestErrors + details?.runTestResult?.codeCoverageWarnings?.length || 0;
  let output = '';
  if (success) {
    output += `${getSuccessOrFailureChar(
      'success',
      numberComponentsDeployed
    )} ${numberComponentsDeployed.toLocaleString()} ${pluralizeFromNumber('item', numberComponentsDeployed)} deployed successfully.`;
    if (runTestsEnabled) {
      output += ` ${getSuccessOrFailureChar(
        'success',
        numberTestsCompleted
      )} ${numberTestsCompleted.toLocaleString()} unit tests succeeded.`;
    }
  } else {
    if (numberComponentErrors > 0) {
      output += `${getSuccessOrFailureChar(
        'failure',
        numberComponentErrors
      )} ${numberComponentErrors.toLocaleString()} of ${numberComponentsDeployed.toLocaleString()} items failed to deploy.`;
    }
    if (runTestsEnabled) {
      output += ` ${getSuccessOrFailureChar(
        'failure',
        numberTestErrors
      )} ${numberTestErrors.toLocaleString()} of ${numberTestsCompleted.toLocaleString()} unit tests failed.`;
    }
  }
  return output;
}

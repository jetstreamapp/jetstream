import { ColDef, GetQuickFilterTextParams, ValueFormatterParams } from '@ag-grid-community/core';
import { getMetadataLabelFromFullName, ListMetadataResultItem } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { ensureArray, orderStringsBy } from '@jetstream/shared/utils';
import { DeployResult, ListMetadataResult, MapOf } from '@jetstream/types';
import { DateFilterComparator, getCheckboxColumnDef } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { composeQuery, getField, Query } from 'soql-parser-js';
import { DeployMetadataTableRow } from '../deploy-metadata.types';

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
    return formatDate(value, DATE_FORMATS.yyyy_MM_dd);
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
    },
    {
      headerName: 'Name',
      colId: 'fullName',
      field: 'fullName',
      cellRenderer: 'valueOrLoading',
      width: 250,
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
      width: 145,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: DateFilterComparator,
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
      width: 120,
      valueFormatter: dataTableDateFormatter,
      getQuickFilterText: dataTableDateFormatter,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: DateFilterComparator,
      },
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
        const { fullName, lastModifiedByName, lastModifiedDate, createdByName, createdDate } = metadata;
        output.push({
          key: `${metadataType}-${fullName}`,
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
      ['Started', deployResults.startDate],
      ['Completed', deployResults.completedDate],
      ['Check Only (Validate)', deployResults.checkOnly],
      ['Ignore Warnings', deployResults.ignoreWarnings],
      ['Rollback on Error', deployResults.rollbackOnError],
      ['Run Tests', deployResults.runTestsEnabled],
      ['Created By', `${deployResults.createdByName} (${deployResults.createdBy})`],
      ['Component Errors', deployResults.numberComponentErrors],
      ['Components Deployed', deployResults.numberComponentsDeployed],
      ['Components Total', deployResults.numberComponentsTotal],
      ['Test Errors', deployResults.numberTestErrors],
      ['Tests Completed', deployResults.numberTestsCompleted],
      ['Tests Total', deployResults.numberTestsTotal],
    ],
    [`Successful Components`]:
      deployResults.details?.componentSuccesses
        ?.filter((item) => item.componentType)
        .map((item) => ({
          Id: item.id,
          'Api Name': item.fullName,
          Type: item.componentType,
          Success: item.success,
          Created: item.created,
          Changed: item.changed,
          Deleted: item.deleted,
          'Created Date': item.createdDate,
        })) || [],
    [`Failed Components`]:
      deployResults.details?.componentFailures?.map((item) => ({
        Id: item.id,
        'Api Name': item.fullName,
        Type: item.componentType,
        'Error Type': item.problemType,
        'Error Message': item.problem,
        Line: item.lineNumber,
        Column: item.columnNumber,
        Success: item.success,
        Created: item.created,
        Changed: item.changed,
        Deleted: item.deleted,
        'Created Date': item.createdDate,
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

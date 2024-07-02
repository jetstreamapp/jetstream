import { getMetadataLabelFromFullName, ListMetadataResultItem } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import {
  ensureArray,
  getErrorMessage,
  getErrorMessageAndStackObj,
  getSuccessOrFailureChar,
  orderValues,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import {
  ChangeSet,
  DeployMetadataTableRow,
  DeployOptions,
  DeployResult,
  ListMetadataResult,
  SalesforceDeployHistoryItem,
  SalesforceDeployHistoryType,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  ColumnWithFilter,
  Grid,
  Icon,
  SelectFormatter,
  SelectHeaderGroupRenderer,
  SelectHeaderRenderer,
  setColumnFromType,
  Spinner,
} from '@jetstream/ui';
import { composeQuery, getField, Query } from '@jetstreamapp/soql-parser-js';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import JSZip from 'jszip';
import localforage from 'localforage';
import isString from 'lodash/isString';
import { SELECT_COLUMN_KEY, SelectColumn } from 'react-data-grid';

const MAX_HISTORY_ITEMS = 500;

export function getDeploymentStatusUrl(id: string) {
  // double encode retUrl
  const address = encodeURIComponent(
    `/changemgmt/monitorDeploymentsDetails.apexp?asyncId=${id}&retURL=${encodeURIComponent('/changemgmt/monitorDeployment.apexp')}`
  );
  return `/lightning/setup/DeployStatus/page?address=${address}`;
}

export function getLightningChangesetUrl(changeset: ChangeSet) {
  if (!changeset) {
    return null;
  }
  const address = encodeURIComponent(changeset.link);
  return `/lightning/setup/OutboundChangeSet/page?address=${address}`;
}

export async function getHistory() {
  try {
    return (await localforage.getItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory)) || [];
  } catch (ex) {
    logger.warn('[DEPLOY][HISTORY][GET ERROR]', ex);
    return [];
  }
}

export async function getHistoryItemFile(item: SalesforceDeployHistoryItem) {
  let file: ArrayBuffer | null = null;
  if (item.fileKey) {
    file = await localforage.getItem<ArrayBuffer>(item.fileKey);
  }
  if (!file) {
    throw new Error('The package file is not available');
  }
  return file;
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
  metadata?: Record<string, ListMetadataResult[]>;
  deployOptions: DeployOptions;
  results?: DeployResult;
  file?: ArrayBuffer | string | null;
}) {
  try {
    if (file && isString(file)) {
      try {
        file = await (
          await JSZip.loadAsync(file, { base64: true })
        ).generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } });
      } catch (ex) {
        logger.warn('[DEPLOY][HISTORY][ZIP PROCESSING ERROR]', ex);
        file = null;
        logErrorToRollbar(getErrorMessage(ex), {
          ...getErrorMessageAndStackObj(ex),
          place: 'DeployMetadataHistory',
          type: 'error generating zip from base64',
        });
      }
    }

    const newItem: SalesforceDeployHistoryItem = {
      key: `${destinationOrg.uniqueId}:${type}:${start.toISOString()}`,
      destinationOrg: {
        uniqueId: destinationOrg.uniqueId,
        label: destinationOrg.label,
        orgName: destinationOrg.orgName || '',
      },
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
      newItem.sourceOrg = {
        uniqueId: sourceOrg.uniqueId,
        label: sourceOrg.label,
        orgName: sourceOrg.orgName || '',
      };
    }
    if (file && localforage.driver() === localforage.INDEXEDDB) {
      newItem.fileKey = `${INDEXED_DB.KEYS.deployHistory}:FILE:${newItem.key}`;
    }
    const existingItems = await getHistory();
    existingItems.unshift(newItem);
    try {
      await localforage.setItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory, existingItems.slice(0, MAX_HISTORY_ITEMS));
      logger.log('[DEPLOY][HISTORY][SAVE]', { newItem });

      if (file && newItem.fileKey && localforage.driver() === localforage.INDEXEDDB) {
        await localforage.setItem(newItem.fileKey, file);
      }
    } catch (ex) {
      logger.warn('[DEPLOY][HISTORY][SAVE ERROR]', ex);
    }
    // delete files, if exists, for history items that were evicted from cache
    try {
      if (existingItems.length > MAX_HISTORY_ITEMS) {
        for (const item of existingItems.slice(MAX_HISTORY_ITEMS).filter((item) => item.fileKey)) {
          item.fileKey && (await localforage.removeItem(item.fileKey));
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

export function getColumnDefinitions(): ColumnWithFilter<DeployMetadataTableRow>[] {
  const output: ColumnWithFilter<DeployMetadataTableRow>[] = [
    {
      ...SelectColumn,
      key: SELECT_COLUMN_KEY,
      resizable: false,
      renderCell: (args) => {
        const { row } = args;
        if (row.loading) {
          return null;
        } else if (!row.metadata) {
          return (
            <Grid align="center" className="slds-text-color_weak">
              <em>No metadata found</em>
            </Grid>
          );
        }
        return <SelectFormatter {...args} />;
      },
      renderHeaderCell: SelectHeaderRenderer,
      renderGroupCell: (args) => {
        const { childRows } = args;
        // Don't allow selection if child rows are loading
        if (childRows.length === 0 || (childRows.length === 1 && (childRows[0].loading || !childRows[0].metadata))) {
          return null;
        }
        return <SelectHeaderGroupRenderer {...args} />;
      },
      colSpan: (args) => {
        if (args.type === 'ROW') {
          const { row } = args;
          if (!row.loading && !row.metadata) {
            return 3;
          }
        }
        return 1;
      },
    },
    {
      ...setColumnFromType('typeLabel', 'text'),
      name: '',
      key: 'typeLabel',
      width: 40,
      frozen: true,
      renderGroupCell: ({ isExpanded }) => (
        <Grid align="end" verticalAlign="center" className="h-100">
          <Icon
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            type="utility"
            className="slds-icon slds-icon-text-default slds-icon_x-small"
            title="Toggle collapse"
          />
        </Grid>
      ),
    },
    {
      ...setColumnFromType('fullName', 'text'),
      name: 'Name',
      key: 'fullName',
      frozen: true,
      renderCell: ({ row }) => (row.loading ? <Spinner size={'x-small'} /> : row.fullName),
      renderGroupCell: ({ toggleGroup, groupKey, childRows }) => (
        <>
          <button className="slds-button" onClick={toggleGroup}>
            {groupKey as string}
          </button>
          {!childRows.some((row) => row.loading) && (
            <span className="slds-m-left_xx-small slds-text-body_small slds-text-color_weak">({childRows.length})</span>
          )}
        </>
      ),
      width: 250,
    },
    {
      ...setColumnFromType('lastModifiedByName', 'text'),
      name: 'Last Modified By',
      key: 'lastModifiedByName',
      width: 160,
      colSpan: (args) => {
        if (args.type === 'ROW') {
          const { row } = args;
          if (!row.loading && !row.metadata) {
            return 5;
          }
        }
        return 1;
      },
    },
    {
      ...setColumnFromType('lastModifiedDate', 'date'),
      name: 'Last Modified',
      key: 'lastModifiedDate',
      width: 202,
    },
    {
      ...setColumnFromType('createdByName', 'text'),
      name: 'Created By',
      key: 'createdByName',
      width: 150,
    },
    {
      ...setColumnFromType('createdDate', 'date'),
      name: 'Created',
      key: 'createdDate',
      width: 202,
    },
    {
      ...setColumnFromType('manageableState', 'text'),
      name: 'Manageable State',
      key: 'manageableState',
      width: 170,
    },
  ];

  return output;
}

export function getRows(listMetadataItems: Record<string, ListMetadataResultItem>): DeployMetadataTableRow[] {
  const output: DeployMetadataTableRow[] = [];

  orderValues(Object.keys(listMetadataItems)).forEach((metadataType) => {
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
): Record<string, any>[] {
  return rows
    .filter((row) => row.fullName && row.metadata && (!limitToSelected || selectedRows.has(row)))
    .map((row) => ({
      Id: row.metadata?.id,
      Type: row.metadata?.type,
      Name: row.metadata?.fullName,
      'Last Modified By': `${row.metadata?.lastModifiedByName} (${row.metadata?.lastModifiedById})`,
      'Last Modified Date': row.metadata?.lastModifiedDate,
      'Created By': `${row.metadata?.createdByName} (${row.metadata?.createdById})`,
      CreatedDate: row.metadata?.createdDate,
      'Manageable State': row.metadata?.manageableState,
    }));
}

export function convertRowsToMapOfListMetadataResults(rows: DeployMetadataTableRow[]): Record<string, ListMetadataResult[]> {
  return rows.reduce((output: Record<string, ListMetadataResult[]>, row) => {
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
export function getDeployResultsExcelData(deployResults: DeployResult, deploymentUrl: string): Record<string, any[]> {
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
  const xlsxData: Record<string, any[]> = {
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
        'Error Message': decodeURIComponent(item.problem),
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
  numberTestErrors = numberTestErrors + (details?.runTestResult?.codeCoverageWarnings?.length || 0);
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

import { logger } from '@jetstream/shared/client-logger';
import { genericRequest, query, queryAll } from '@jetstream/shared/data';
import { makeToolingRequests } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import type {
  ApexClassRecord,
  ApexCodeCoverageAggregateRecord,
  ApexOrgWideCoverageRecord,
  ApexTestQueueItemRecord,
  ApexTestResultRecord,
  ApexTestRunResultRecord,
  ApexTestSuiteRecord,
  ApexTriggerRecord,
  RunTestsAsyncOptions,
  RunTestsAsyncPayload,
  SalesforceOrgUi,
  TestSuiteMembershipRecord,
} from '@jetstream/types';
import { composeQuery, getField, Query } from '@jetstreamapp/soql-parser-js';
import type { TestRunSelection } from './apex-test-runner-types';

/** Statuses indicating a run or queue item has not reached a terminal state */
export const IN_PROGRESS_TEST_RUN_STATUSES = ['Queued', 'Preparing', 'Processing', 'Holding'] as const;

const SYMBOL_TABLE_CHUNK_SIZE = 100;

export function getApexTestRunsQuery(limit = 50) {
  const soqlQuery: Query = {
    fields: [
      getField('Id'),
      getField('AsyncApexJobId'),
      getField('Status'),
      getField('ClassesEnqueued'),
      getField('ClassesCompleted'),
      getField('MethodsEnqueued'),
      getField('MethodsCompleted'),
      getField('MethodsFailed'),
      getField('StartTime'),
      getField('EndTime'),
      getField('TestTime'),
      getField('UserId'),
      getField('User.Name'),
      getField('CreatedDate'),
    ],
    sObject: 'ApexTestRunResult',
    orderBy: [{ field: 'CreatedDate', order: 'DESC' }],
    limit,
  };
  const soql = composeQuery(soqlQuery);
  logger.info('getApexTestRunsQuery()', { soql });
  return soql;
}

export function getApexTestQueueItemsQuery(parentJobId: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Status'),
      getField('ExtendedStatus'),
      getField('ApexClassId'),
      getField('ApexClass.Name'),
      getField('TestRunResultId'),
      getField('ParentJobId'),
    ],
    sObject: 'ApexTestQueueItem',
    where: { left: { field: 'ParentJobId', operator: '=', value: parentJobId, literalType: 'STRING' } },
    orderBy: [{ field: 'ApexClass.Name', order: 'ASC' }],
  });
  logger.info('getApexTestQueueItemsQuery()', { soql });
  return soql;
}

export function getApexTestResultsQuery(apexTestRunResultId: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Outcome'),
      getField('MethodName'),
      getField('Message'),
      getField('StackTrace'),
      getField('RunTime'),
      getField('ApexClassId'),
      getField('ApexClass.Name'),
      getField('ApexLogId'),
      getField('ApexTestRunResultId'),
    ],
    sObject: 'ApexTestResult',
    where: { left: { field: 'ApexTestRunResultId', operator: '=', value: apexTestRunResultId, literalType: 'STRING' } },
    orderBy: [
      { field: 'ApexClass.Name', order: 'ASC' },
      { field: 'MethodName', order: 'ASC' },
    ],
  });
  logger.info('getApexTestResultsQuery()', { soql });
  return soql;
}

export function getCoverageAggregateQuery() {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('ApexClassOrTriggerId'),
      getField('ApexClassOrTrigger.Name'),
      getField('NumLinesCovered'),
      getField('NumLinesUncovered'),
    ],
    sObject: 'ApexCodeCoverageAggregate',
    orderBy: [{ field: 'ApexClassOrTrigger.Name', order: 'ASC' }],
  });
  logger.info('getCoverageAggregateQuery()', { soql });
  return soql;
}

/** The Coverage field (covered/uncovered line arrays) is large, only fetch it for a single class at a time */
export function getCoverageDetailQuery(apexClassOrTriggerId: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('ApexClassOrTriggerId'),
      getField('ApexClassOrTrigger.Name'),
      getField('NumLinesCovered'),
      getField('NumLinesUncovered'),
      getField('Coverage'),
    ],
    sObject: 'ApexCodeCoverageAggregate',
    where: { left: { field: 'ApexClassOrTriggerId', operator: '=', value: apexClassOrTriggerId, literalType: 'STRING' } },
  });
  logger.info('getCoverageDetailQuery()', { soql });
  return soql;
}

export function getOrgWideCoverageQuery() {
  return composeQuery({ fields: [getField('Id'), getField('PercentCovered')], sObject: 'ApexOrgWideCoverage' });
}

export function getApexClassManifestQuery() {
  const soql = composeQuery({
    fields: [getField('Id'), getField('Name'), getField('NamespacePrefix'), getField('Status'), getField('LastModifiedDate')],
    sObject: 'ApexClass',
    where: {
      left: { field: 'Status', operator: '=', value: 'Active', literalType: 'STRING' },
      operator: 'AND',
      right: { left: { field: 'NamespacePrefix', operator: '=', value: 'NULL', literalType: 'NULL' } },
    },
    orderBy: [{ field: 'Name', order: 'ASC' }],
  });
  logger.info('getApexClassManifestQuery()', { soql });
  return soql;
}

export function getApexClassSymbolTableQuery(classIds: string[]) {
  return composeQuery({
    fields: [getField('Id'), getField('SymbolTable')],
    sObject: 'ApexClass',
    where: { left: { field: 'Id', operator: 'IN', value: classIds, literalType: 'STRING' } },
  });
}

export function getApexClassBodyQuery(classId: string) {
  return composeQuery({
    fields: [getField('Id'), getField('Name'), getField('Body')],
    sObject: 'ApexClass',
    where: { left: { field: 'Id', operator: '=', value: classId, literalType: 'STRING' } },
  });
}

export function getApexTriggerBodyQuery(triggerId: string) {
  return composeQuery({
    fields: [getField('Id'), getField('Name'), getField('Body')],
    sObject: 'ApexTrigger',
    where: { left: { field: 'Id', operator: '=', value: triggerId, literalType: 'STRING' } },
  });
}

export function getApexTestSuitesQuery() {
  return composeQuery({
    fields: [getField('Id'), getField('TestSuiteName')],
    sObject: 'ApexTestSuite',
    orderBy: [{ field: 'TestSuiteName', order: 'ASC' }],
  });
}

export function getTestSuiteMembershipsQuery(suiteId?: string) {
  const soqlQuery: Query = {
    fields: [getField('Id'), getField('ApexClassId'), getField('ApexTestSuiteId')],
    sObject: 'TestSuiteMembership',
  };
  if (suiteId) {
    soqlQuery.where = { left: { field: 'ApexTestSuiteId', operator: '=', value: suiteId, literalType: 'STRING' } };
  }
  return composeQuery(soqlQuery);
}

/**
 * Build the runTestsAsynchronous request body from the user's selection.
 * Method-level picks require the `tests` shape; whole-class selections use the smaller `classids` shape.
 */
export function buildRunTestsPayload(selection: TestRunSelection, options: RunTestsAsyncOptions = {}): RunTestsAsyncPayload {
  const runOptions: RunTestsAsyncOptions = {};
  if (Number.isInteger(options.maxFailedTests) && (options.maxFailedTests as number) >= 0) {
    runOptions.maxFailedTests = options.maxFailedTests;
  }
  if (options.skipCodeCoverage) {
    runOptions.skipCodeCoverage = true;
  }
  if (selection.type === 'suite') {
    return { suiteids: selection.suiteId, ...runOptions };
  }
  const classEntries = Array.from(selection.classes.entries());
  const hasMethodLevelSelection = classEntries.some(([, methods]) => methods !== 'ALL');
  if (!hasMethodLevelSelection) {
    return { classids: classEntries.map(([classId]) => classId).join(','), ...runOptions };
  }
  return {
    tests: classEntries.map(([classId, methods]) => (methods === 'ALL' ? { classId } : { classId, testMethods: Array.from(methods) })),
    ...runOptions,
  };
}

const TEST_SUITE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Validate an Apex Test Suite API name against Salesforce's rules. Returns an error message or null when valid.
 * Rules: alphanumeric + underscores only, must begin with a letter, no spaces, cannot end with an
 * underscore, no two consecutive underscores, and must be unique in the org.
 */
export function validateTestSuiteName(name: string, existingNames: string[] = []): string | null {
  if (!name) {
    return 'Enter a test suite name';
  }
  if (!TEST_SUITE_NAME_REGEX.test(name)) {
    return 'Name can only contain letters, numbers, and underscores, and must begin with a letter';
  }
  if (name.endsWith('_')) {
    return 'Name cannot end with an underscore';
  }
  if (name.includes('__')) {
    return 'Name cannot contain two consecutive underscores';
  }
  if (existingNames.some((existingName) => existingName.toLowerCase() === name.toLowerCase())) {
    return 'A test suite with this name already exists';
  }
  return null;
}

export async function runTestsAsync(org: SalesforceOrgUi, payload: RunTestsAsyncPayload): Promise<string> {
  return genericRequest<string>(org, {
    isTooling: true,
    method: 'POST',
    url: '/tooling/runTestsAsynchronous',
    body: payload,
  });
}

export async function fetchTestRuns(org: SalesforceOrgUi, limit?: number) {
  return (await query<ApexTestRunResultRecord>(org, getApexTestRunsQuery(limit), true)).queryResults.records;
}

export async function fetchTestRunDetail(org: SalesforceOrgUi, runId: string, asyncApexJobId: string) {
  const [runResults, queueItemResults, testResults] = await Promise.all([
    query<ApexTestRunResultRecord>(
      org,
      composeQuery({
        fields: [
          getField('Id'),
          getField('AsyncApexJobId'),
          getField('Status'),
          getField('ClassesEnqueued'),
          getField('ClassesCompleted'),
          getField('MethodsEnqueued'),
          getField('MethodsCompleted'),
          getField('MethodsFailed'),
          getField('StartTime'),
          getField('EndTime'),
          getField('TestTime'),
          getField('UserId'),
          getField('CreatedDate'),
        ],
        sObject: 'ApexTestRunResult',
        where: { left: { field: 'Id', operator: '=', value: runId, literalType: 'STRING' } },
      }),
      true,
    ),
    query<ApexTestQueueItemRecord>(org, getApexTestQueueItemsQuery(asyncApexJobId), true),
    queryAll<ApexTestResultRecord>(org, getApexTestResultsQuery(runId), true),
  ]);
  return {
    run: runResults.queryResults.records[0] ?? null,
    queueItems: queueItemResults.queryResults.records,
    testResults: testResults.queryResults.records,
  };
}

/**
 * Salesforce links debug logs to test results asynchronously, so ApexLogId can be null in result snapshots
 * queried right as a run completes. Re-fetch a single result's log id on demand to pick up a late-linked log.
 */
export async function fetchTestResultLogId(org: SalesforceOrgUi, testResultId: string): Promise<string | null> {
  const soql = composeQuery({
    fields: [getField('Id'), getField('ApexLogId')],
    sObject: 'ApexTestResult',
    where: { left: { field: 'Id', operator: '=', value: testResultId, literalType: 'STRING' } },
  });
  const results = await query<Pick<ApexTestResultRecord, 'Id' | 'ApexLogId'>>(org, soql, true);
  return results.queryResults.records[0]?.ApexLogId ?? null;
}

export async function fetchCoverageAggregates(org: SalesforceOrgUi) {
  const records = (await queryAll<ApexCodeCoverageAggregateRecord>(org, getCoverageAggregateQuery(), true)).queryResults.records;
  // Coverage rows can linger for deleted classes and have no name to display
  return records.filter((record) => record.ApexClassOrTrigger?.Name);
}

export async function fetchCoverageDetail(org: SalesforceOrgUi, apexClassOrTriggerId: string) {
  const coverageRecords = (await query<ApexCodeCoverageAggregateRecord>(org, getCoverageDetailQuery(apexClassOrTriggerId), true))
    .queryResults.records;
  return coverageRecords[0] ?? null;
}

export async function fetchApexClassOrTriggerBody(org: SalesforceOrgUi, apexClassOrTriggerId: string) {
  const isTrigger = apexClassOrTriggerId.startsWith('01q');
  if (isTrigger) {
    const records = (await query<ApexTriggerRecord>(org, getApexTriggerBodyQuery(apexClassOrTriggerId), true)).queryResults.records;
    return records[0] ?? null;
  }
  const records = (await query<ApexClassRecord>(org, getApexClassBodyQuery(apexClassOrTriggerId), true)).queryResults.records;
  return records[0] ?? null;
}

export async function fetchOrgWideCoverage(org: SalesforceOrgUi): Promise<number | null> {
  const records = (await query<ApexOrgWideCoverageRecord>(org, getOrgWideCoverageQuery(), true)).queryResults.records;
  return records[0]?.PercentCovered ?? null;
}

export async function fetchApexClassManifest(org: SalesforceOrgUi) {
  return (await queryAll<ApexClassRecord>(org, getApexClassManifestQuery(), true)).queryResults.records;
}

export async function fetchSymbolTables(
  org: SalesforceOrgUi,
  classIds: string[],
  onProgress?: (fetchedCount: number, totalCount: number) => void,
): Promise<ApexClassRecord[]> {
  const results: ApexClassRecord[] = [];
  const chunks = splitArrayToMaxSize(classIds, SYMBOL_TABLE_CHUNK_SIZE);
  for (const chunk of chunks) {
    const records = (await query<ApexClassRecord>(org, getApexClassSymbolTableQuery(chunk), true)).queryResults.records;
    results.push(...records);
    onProgress?.(results.length, classIds.length);
  }
  return results;
}

export async function fetchTestSuites(org: SalesforceOrgUi) {
  return (await queryAll<ApexTestSuiteRecord>(org, getApexTestSuitesQuery(), true)).queryResults.records;
}

export async function fetchTestSuiteMemberships(org: SalesforceOrgUi, suiteId?: string) {
  return (await queryAll<TestSuiteMembershipRecord>(org, getTestSuiteMembershipsQuery(suiteId), true)).queryResults.records;
}

export async function createTestSuite(org: SalesforceOrgUi, testSuiteName: string): Promise<string> {
  const result = await genericRequest<{ id: string }>(org, {
    isTooling: true,
    method: 'POST',
    url: '/tooling/sobjects/ApexTestSuite',
    body: { TestSuiteName: testSuiteName },
  });
  return result.id;
}

export async function renameTestSuite(org: SalesforceOrgUi, suiteId: string, testSuiteName: string) {
  // Some orgs reject a direct PATCH on this resource ("MediaType of 'json' is not supported"),
  // so tunnel it through POST the same way the Developer Console does
  await genericRequest(org, {
    isTooling: true,
    method: 'POST',
    url: `/tooling/sobjects/ApexTestSuite/${suiteId}?_HttpMethod=PATCH`,
    body: { TestSuiteName: testSuiteName },
  });
}

export async function deleteTestSuite(org: SalesforceOrgUi, suiteId: string) {
  await genericRequest(org, {
    isTooling: true,
    method: 'DELETE',
    url: `/tooling/sobjects/ApexTestSuite/${suiteId}`,
  });
}

/**
 * Apply suite membership changes as a diff — new classes are added, removed memberships are deleted.
 */
export async function updateTestSuiteMembership(
  org: SalesforceOrgUi,
  apiVersion: string,
  suiteId: string,
  { addClassIds, removeMembershipIds }: { addClassIds: string[]; removeMembershipIds: string[] },
) {
  const compositeRequests = [
    ...addClassIds.map((classId, i) => ({
      method: 'POST' as const,
      url: `/services/data/${apiVersion}/tooling/sobjects/TestSuiteMembership`,
      body: { ApexTestSuiteId: suiteId, ApexClassId: classId },
      referenceId: `add_${i}`,
    })),
    ...removeMembershipIds.map((membershipId, i) => ({
      method: 'DELETE' as const,
      url: `/services/data/${apiVersion}/tooling/sobjects/TestSuiteMembership/${membershipId}`,
      referenceId: `remove_${i}`,
    })),
  ];
  if (compositeRequests.length === 0) {
    return;
  }
  await makeToolingRequests(org, compositeRequests, apiVersion);
}

/**
 * Abort a test run by marking all non-terminal queue items as Aborted.
 * The currently executing class still finishes — only remaining tests are cancelled.
 */
export async function abortTestRun(org: SalesforceOrgUi, apiVersion: string, parentJobId: string) {
  const queueItems = (await query<ApexTestQueueItemRecord>(org, getApexTestQueueItemsQuery(parentJobId), true)).queryResults.records;
  const itemsToAbort = queueItems.filter((item) => IN_PROGRESS_TEST_RUN_STATUSES.includes(item.Status as never));
  if (itemsToAbort.length === 0) {
    return 0;
  }
  await makeToolingRequests(
    org,
    itemsToAbort.map((item, i) => ({
      method: 'PATCH' as const,
      url: `/services/data/${apiVersion}/tooling/sobjects/ApexTestQueueItem/${item.Id}`,
      body: { Status: 'Aborted' },
      referenceId: `abort_${i}`,
    })),
    apiVersion,
  );
  return itemsToAbort.length;
}

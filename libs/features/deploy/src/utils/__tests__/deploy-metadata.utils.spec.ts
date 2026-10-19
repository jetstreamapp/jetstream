import { DeployMessage, DeployResult } from '@jetstream/types';
import { getDeployResultsExcelData } from '../deploy-metadata.utils';

const COVERAGE_PROBLEM = 'Average test coverage across all Apex Classes and Triggers is 74%, at least 75% test coverage is required.';

function getDeployMessage(overrides: Partial<DeployMessage>): DeployMessage {
  return {
    changed: false,
    columnNumber: 0,
    componentType: 'Layout',
    created: false,
    createdDate: '2026-01-01T00:00:00.000Z',
    deleted: false,
    fileName: 'layouts/Account-Account %28Marketing%29 Layout.layout',
    fullName: 'Account-Account %28Marketing%29 Layout',
    id: '00h000000000000',
    lineNumber: 0,
    problem: '',
    problemType: 'Error',
    success: false,
    ...overrides,
  };
}

function getDeployResult(componentFailures: DeployMessage[]): DeployResult {
  return {
    id: '0Af000000000000',
    checkOnly: false,
    completedDate: '2026-01-01T00:00:00.000Z',
    createdBy: '005000000000000',
    createdByName: 'Test User',
    createdDate: '2026-01-01T00:00:00.000Z',
    details: { componentFailures, componentSuccesses: [] } as unknown as DeployResult['details'],
    done: true,
    lastModifiedDate: '2026-01-01T00:00:00.000Z',
    numberComponentErrors: componentFailures.length,
    numberComponentsDeployed: 0,
    numberComponentsTotal: componentFailures.length,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    runTestsEnabled: false,
    startDate: '2026-01-01T00:00:00.000Z',
    status: 'Failed',
    success: false,
  };
}

describe('getDeployResultsExcelData', () => {
  it('should keep failure messages that are not valid URI encoding as-is', () => {
    const results = getDeployResultsExcelData(getDeployResult([getDeployMessage({ problem: COVERAGE_PROBLEM })]), 'https://example.com');

    expect(results['Failed Components']).toHaveLength(1);
    expect(results['Failed Components'][0]['Error Message']).toEqual(COVERAGE_PROBLEM);
    expect(results['Failed Components'][0]['Api Name']).toEqual('Account-Account (Marketing) Layout');
  });

  it('should decode URI encoded failure messages', () => {
    const results = getDeployResultsExcelData(
      getDeployResult([getDeployMessage({ problem: 'No Layout named Account-Account %28Marketing%29 Layout found' })]),
      'https://example.com',
    );

    expect(results['Failed Components'][0]['Error Message']).toEqual('No Layout named Account-Account (Marketing) Layout found');
  });
});

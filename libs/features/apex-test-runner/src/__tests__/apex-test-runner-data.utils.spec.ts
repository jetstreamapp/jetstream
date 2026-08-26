import { describe, expect, it } from 'vitest';
import {
  buildRunTestsPayload,
  getApexClassManifestQuery,
  getApexTestQueueItemsQuery,
  getApexTestResultsQuery,
  getApexTestRunsQuery,
  getCoverageAggregateQuery,
  getCoverageDetailQuery,
} from '../apex-test-runner-data.utils';
import type { TestRunSelection } from '../apex-test-runner-types';

describe('buildRunTestsPayload', () => {
  it('builds suiteids payload for suite selection', () => {
    expect(buildRunTestsPayload({ type: 'suite', suiteId: '05F000000000001' })).toEqual({ suiteids: '05F000000000001' });
  });

  it('builds classids payload when every class is fully selected', () => {
    const selection: TestRunSelection = {
      type: 'tests',
      classes: new Map([
        ['01p000000000001', 'ALL'],
        ['01p000000000002', 'ALL'],
      ]),
    };
    expect(buildRunTestsPayload(selection)).toEqual({ classids: '01p000000000001,01p000000000002' });
  });

  it('builds tests payload when any class has method-level selection', () => {
    const selection: TestRunSelection = {
      type: 'tests',
      classes: new Map<string, Set<string> | 'ALL'>([
        ['01p000000000001', 'ALL'],
        ['01p000000000002', new Set(['testOne', 'testTwo'])],
      ]),
    };
    expect(buildRunTestsPayload(selection)).toEqual({
      tests: [{ classId: '01p000000000001' }, { classId: '01p000000000002', testMethods: ['testOne', 'testTwo'] }],
    });
  });
});

describe('SOQL builders', () => {
  it('orders test runs by CreatedDate descending with a limit', () => {
    const soql = getApexTestRunsQuery(25);
    expect(soql).toContain('FROM ApexTestRunResult');
    expect(soql).toContain('ORDER BY CreatedDate DESC');
    expect(soql).toContain('LIMIT 25');
  });

  it('filters queue items by parent job id', () => {
    expect(getApexTestQueueItemsQuery('707000000000001')).toContain("ParentJobId = '707000000000001'");
  });

  it('filters test results by run result id', () => {
    expect(getApexTestResultsQuery('05m000000000001')).toContain("ApexTestRunResultId = '05m000000000001'");
  });

  it('omits the Coverage line detail field from the aggregate table query', () => {
    expect(getCoverageAggregateQuery()).not.toContain('Coverage,');
    expect(getCoverageDetailQuery('01p000000000001')).toContain('Coverage');
  });

  it('excludes managed and inactive classes from the manifest', () => {
    const soql = getApexClassManifestQuery();
    expect(soql).toContain("Status = 'Active'");
    expect(soql).toContain('NamespacePrefix = NULL');
  });
});

import type { ApexTestSuiteRecord, SalesforceOrgUi } from '@jetstream/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSuite, fetchTestSuiteMemberships, fetchTestSuites } from '../apex-test-runner-data.utils';
import { useApexTestSuites } from '../useApexTestSuites';

vi.mock('../apex-test-runner-data.utils', () => ({
  createTestSuite: vi.fn(),
  deleteTestSuite: vi.fn(),
  fetchTestSuiteMemberships: vi.fn(),
  fetchTestSuites: vi.fn(),
  renameTestSuite: vi.fn(),
  updateTestSuiteMembership: vi.fn(),
}));

const orgA = { uniqueId: 'org-a' } as SalesforceOrgUi;
const orgB = { uniqueId: 'org-b' } as SalesforceOrgUi;

function suitesFor(org: SalesforceOrgUi) {
  return [{ Id: `${org.uniqueId}-suite`, TestSuiteName: `${org.uniqueId} suite` } as ApexTestSuiteRecord];
}

describe('useApexTestSuites', () => {
  beforeEach(() => {
    vi.mocked(fetchTestSuites).mockImplementation(async (org) => suitesFor(org));
    vi.mocked(fetchTestSuiteMemberships).mockResolvedValue([]);
  });

  it('keeps the current org suites when a create for the previous org settles after the switch', async () => {
    let finishCreate: (suiteId: string) => void = () => undefined;
    vi.mocked(createTestSuite).mockImplementation(() => new Promise((resolve) => (finishCreate = resolve)));

    const { result, rerender } = renderHook(({ org }) => useApexTestSuites(org, '62.0'), { initialProps: { org: orgA } });
    await waitFor(() => expect(result.current.suites).toEqual(suitesFor(orgA)));

    let pendingCreate: Promise<string> = Promise.resolve('');
    act(() => {
      pendingCreate = result.current.createSuite('New suite');
    });
    rerender({ org: orgB });
    await waitFor(() => expect(result.current.suites).toEqual(suitesFor(orgB)));

    await act(async () => {
      finishCreate('suite-for-a');
      await pendingCreate;
    });

    expect(result.current.suites).toEqual(suitesFor(orgB));
    expect(vi.mocked(fetchTestSuites).mock.calls.filter(([org]) => org === orgA)).toHaveLength(1);
  });
});

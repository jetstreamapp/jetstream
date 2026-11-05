import type { SalesforceOrgUi } from '@jetstream/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestsAsync } from '../apex-test-runner-data.utils';
import { useApexTestRunLauncher } from '../useApexTestRunLauncher';

vi.mock('@jetstream/ui-core', () => ({ useAnalytics: () => ({ trackEvent: vi.fn() }) }));
vi.mock('../useApexTestClasses', () => ({ useApexTestClasses: () => ({ testClasses: [], unknownClasses: [] }) }));
vi.mock('../useApexTestSuites', () => ({ useApexTestSuites: () => ({}) }));
vi.mock('../apex-test-runner-data.utils', () => ({
  buildRunTestsPayload: vi.fn(() => ({})),
  runTestsAsync: vi.fn(),
}));

const orgA = { uniqueId: 'org-a' } as SalesforceOrgUi;
const orgB = { uniqueId: 'org-b' } as SalesforceOrgUi;

describe('useApexTestRunLauncher', () => {
  beforeEach(() => {
    vi.mocked(runTestsAsync).mockReset();
  });

  it('ignores a failed launch from the previous org after switching orgs', async () => {
    let failLaunch: (error: Error) => void = () => undefined;
    vi.mocked(runTestsAsync).mockImplementation(() => new Promise((_, reject) => (failLaunch = reject)));
    const onRunStarted = vi.fn();

    const { result, rerender } = renderHook(({ org }) => useApexTestRunLauncher(org, '62.0', onRunStarted), {
      initialProps: { org: orgA },
    });

    let pendingLaunch: Promise<void> = Promise.resolve();
    act(() => {
      pendingLaunch = result.current.runSuite('suite-1');
    });
    expect(result.current.launching).toBe(true);

    rerender({ org: orgB });
    await waitFor(() => expect(result.current.launching).toBe(false));

    await act(async () => {
      failLaunch(new Error('boom'));
      await pendingLaunch;
    });

    expect(result.current.launchError).toBeNull();
    expect(result.current.launching).toBe(false);
    expect(onRunStarted).not.toHaveBeenCalled();
  });
});

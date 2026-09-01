import type { SalesforceOrgUi } from '@jetstream/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApexTestRunsList } from '../useApexTestRunsList';

const { fetchTestRunsMock } = vi.hoisted(() => ({ fetchTestRunsMock: vi.fn() }));

vi.mock('../apex-test-runner-data.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../apex-test-runner-data.utils')>()),
  fetchTestRuns: fetchTestRunsMock,
}));

const org = { uniqueId: 'org-poll-spec' } as SalesforceOrgUi;

// Mirrors the constants in useApexTestRunsList
const IDLE_POLL_INTERVAL = 30000;
const MAX_POLL_ERRORS = 25;

async function advanceOnePollCycle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(IDLE_POLL_INTERVAL);
  });
}

describe('useApexTestRunsList polling error cutoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchTestRunsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling after MAX_POLL_ERRORS consecutive failures', async () => {
    fetchTestRunsMock.mockRejectedValue(new Error('org unreachable'));

    const { result } = renderHook(() => useApexTestRunsList(org));
    // Let the initial mount fetch settle (error #1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchTestRunsMock).toHaveBeenCalledTimes(1);

    // Errors #2 through #MAX_POLL_ERRORS via the poll interval
    for (let i = 0; i < MAX_POLL_ERRORS - 1; i++) {
      await advanceOnePollCycle();
    }
    expect(fetchTestRunsMock).toHaveBeenCalledTimes(MAX_POLL_ERRORS);
    expect(result.current.errorMessage).toBe('org unreachable');

    // Once the cutoff engages, further intervals must not fire any more requests
    for (let i = 0; i < 5; i++) {
      await advanceOnePollCycle();
    }
    expect(fetchTestRunsMock).toHaveBeenCalledTimes(MAX_POLL_ERRORS);
  });

  it('resumes polling after a successful manual refresh resets the error count', async () => {
    fetchTestRunsMock.mockRejectedValue(new Error('org unreachable'));

    const { result } = renderHook(() => useApexTestRunsList(org));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    for (let i = 0; i < MAX_POLL_ERRORS - 1; i++) {
      await advanceOnePollCycle();
    }
    expect(fetchTestRunsMock).toHaveBeenCalledTimes(MAX_POLL_ERRORS);

    // A manual refresh that succeeds should clear the error state and restart polling
    fetchTestRunsMock.mockResolvedValue([]);
    await act(async () => {
      await result.current.fetchRuns();
    });
    expect(result.current.errorMessage).toBeNull();
    const callsAfterManualRefresh = fetchTestRunsMock.mock.calls.length;

    await advanceOnePollCycle();
    expect(fetchTestRunsMock.mock.calls.length).toBeGreaterThan(callsAfterManualRefresh);
  });
});

import { SCRATCH_ORG_NOT_REACHABLE_MESSAGE, SCRATCH_ORG_PASSWORDLESS_REFUSED_MESSAGE } from '@jetstream/api-types';
import { connectScratchOrg, deleteOrg, getOrgs } from '@jetstream/shared/data';
import type { SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteScratchOrg } from '../scratch-org-data.utils';
import { deployScratchOrgSettings } from '../scratch-org-settings.utils';
import type { PendingScratchOrg } from '../scratch-org.types';
import { isPasswordlessRefused, useScratchOrgActions } from '../useScratchOrgActions';

vi.mock('@jetstream/shared/data', () => ({ connectScratchOrg: vi.fn(), deleteOrg: vi.fn(), getOrgs: vi.fn() }));
vi.mock('@jetstream/ui', () => ({ fireToast: vi.fn() }));
vi.mock('@jetstream/ui-core', () => ({ deleteAllHistoryRecords: vi.fn() }));
vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ defaultApiVersion: 'v62.0' }),
    salesforceOrgsState: atom<SalesforceOrgUi[]>([]),
  };
});
vi.mock('../scratch-org-data.utils', () => ({ deleteScratchOrg: vi.fn() }));
vi.mock('../scratch-org-settings.utils', () => ({
  deployScratchOrgSettings: vi.fn(),
  hasScratchOrgSettings: (settings: unknown, objectSettings: unknown) => !!settings || !!objectSettings,
}));

const SCRATCH_ORG_INFO_ID = '2SR000000000001AAA';
const devHubOrg = { uniqueId: 'dev-hub' } as SalesforceOrgUi;
const otherDevHubOrg = { uniqueId: 'other-dev-hub' } as SalesforceOrgUi;
const scratchOrg = { uniqueId: 'scratch-org', username: 'test-abc@example.com' } as SalesforceOrgUi;

function buildPending(overrides: Partial<PendingScratchOrg> = {}): PendingScratchOrg {
  return {
    scratchOrgInfoId: SCRATCH_ORG_INFO_ID,
    orgName: 'Feature Spike',
    connect: true,
    settings: null,
    objectSettings: null,
    ...overrides,
  };
}

function buildRecord(Status: ScratchOrgInfoRecord['Status'], ErrorCode?: string): ScratchOrgInfoRecord {
  return { Id: SCRATCH_ORG_INFO_ID, Status, ErrorCode };
}

function renderActions(initialRecords: ScratchOrgInfoRecord[] = []) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ org, records }) => useScratchOrgActions(org, records, refresh), {
    initialProps: { org: devHubOrg, records: initialRecords },
  });
  return { ...hook, refresh };
}

function getToasts() {
  return vi.mocked(fireToast).mock.calls.map(([{ type, message }]) => ({ type, message }));
}

describe('useScratchOrgActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrgs).mockResolvedValue([devHubOrg, scratchOrg]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects a requested scratch org and deploys its settings once Salesforce has created it', async () => {
    vi.mocked(connectScratchOrg).mockResolvedValue(scratchOrg);
    const settings = { mobileSettings: { enabled: true } };
    const { result, rerender } = renderActions([buildRecord('Creating')]);

    act(() => result.current.trackPendingScratchOrg(buildPending({ settings })));
    expect(result.current.pendingSteps).toEqual({ [SCRATCH_ORG_INFO_ID]: 'creating' });
    expect(connectScratchOrg).not.toHaveBeenCalled();

    rerender({ org: devHubOrg, records: [buildRecord('Active')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(connectScratchOrg).toHaveBeenCalledTimes(1);
    expect(connectScratchOrg).toHaveBeenCalledWith(devHubOrg, SCRATCH_ORG_INFO_ID);
    expect(deployScratchOrgSettings).toHaveBeenCalledWith(scratchOrg, { settings, objectSettings: null, apiVersion: '62.0' });
    expect(getToasts()).toEqual([{ type: 'success', message: 'Scratch org "Feature Spike" is ready and connected to Jetstream.' }]);
  });

  it('does the post-create work once, however often the list is polled', async () => {
    vi.mocked(connectScratchOrg).mockResolvedValue(scratchOrg);
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending()));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });
    rerender({ org: { ...devHubOrg }, records: [buildRecord('Active')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(connectScratchOrg).toHaveBeenCalledTimes(1);
  });

  it('does not connect a scratch org that was requested without a connection', async () => {
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending({ connect: false })));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(connectScratchOrg).not.toHaveBeenCalled();
    expect(getToasts()).toEqual([{ type: 'success', message: 'Scratch org "Feature Spike" is ready.' }]);
  });

  it('explains why a scratch org could not be created', async () => {
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending()));
    rerender({ org: devHubOrg, records: [buildRecord('Error', 'C-1007')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(connectScratchOrg).not.toHaveBeenCalled();
    expect(getToasts()).toEqual([
      { type: 'error', message: 'Scratch org "Feature Spike" could not be created. The username is already in use. (C-1007)' },
    ]);
  });

  it('keeps trying to connect while a new scratch org cannot be reached', async () => {
    vi.useFakeTimers();
    vi.mocked(connectScratchOrg)
      .mockRejectedValueOnce(
        new Error(`${SCRATCH_ORG_NOT_REACHABLE_MESSAGE}, new scratch orgs can take a few minutes to become available.`),
      )
      .mockResolvedValue(scratchOrg);
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending()));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(connectScratchOrg).toHaveBeenCalledTimes(1);
    expect(result.current.pendingSteps).toEqual({ [SCRATCH_ORG_INFO_ID]: 'connecting' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(connectScratchOrg).toHaveBeenCalledTimes(2);
    expect(result.current.pendingSteps).toEqual({});
  });

  it('does not retry a connection that Salesforce refused', async () => {
    vi.mocked(connectScratchOrg).mockRejectedValue(new Error('expired authorization code'));
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending({ settings: { mobileSettings: {} } })));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(connectScratchOrg).toHaveBeenCalledTimes(1);
    expect(deployScratchOrgSettings).not.toHaveBeenCalled();
    expect(getToasts()).toEqual([
      {
        type: 'warning',
        message: 'Scratch org "Feature Spike" was created, but it could not be connected to Jetstream. expired authorization code',
      },
    ]);
  });

  it('reports settings that could not be deployed without hiding that the scratch org is connected', async () => {
    vi.mocked(connectScratchOrg).mockResolvedValue(scratchOrg);
    vi.mocked(deployScratchOrgSettings).mockRejectedValue(new Error('Mobile: unknown setting'));
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending({ settings: { mobileSettings: {} } })));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(getToasts()).toEqual([
      {
        type: 'warning',
        message: 'Scratch org "Feature Spike" was created and connected, but its settings could not be deployed. Mobile: unknown setting',
      },
    ]);
  });

  it('tells the user when switching Dev Hubs ends the wait for a scratch org', async () => {
    const { result, rerender } = renderActions([buildRecord('Creating')]);

    act(() => result.current.trackPendingScratchOrg(buildPending()));
    rerender({ org: otherDevHubOrg, records: [] });

    await waitFor(() => expect(result.current.pendingSteps).toEqual({}));
    expect(getToasts()).toEqual([{ type: 'warning', message: expect.stringContaining('Jetstream stopped waiting for "Feature Spike"') }]);

    // The scratch org becoming active later, on a Dev Hub that is no longer shown, starts nothing
    rerender({ org: otherDevHubOrg, records: [buildRecord('Active')] });
    expect(connectScratchOrg).not.toHaveBeenCalled();
  });

  it('starts and reports nothing more for a scratch org that was being connected when the Dev Hub was switched', async () => {
    let finishConnecting: (org: SalesforceOrgUi) => void = () => undefined;
    vi.mocked(connectScratchOrg).mockReturnValue(new Promise((resolve) => (finishConnecting = resolve)));
    const { result, rerender } = renderActions();

    act(() => result.current.trackPendingScratchOrg(buildPending({ settings: { mobileSettings: {} } })));
    rerender({ org: devHubOrg, records: [buildRecord('Active')] });
    await waitFor(() => expect(result.current.pendingSteps).toEqual({ [SCRATCH_ORG_INFO_ID]: 'connecting' }));

    rerender({ org: otherDevHubOrg, records: [] });
    await act(async () => finishConnecting(scratchOrg));

    expect(deployScratchOrgSettings).not.toHaveBeenCalled();
    expect(getToasts()).toEqual([
      {
        type: 'warning',
        message:
          'Jetstream stopped waiting for "Feature Spike". Salesforce created it, connect it from the Scratch Orgs page if it is not in your list of orgs. Its settings were not deployed.',
      },
    ]);
  });

  it('keeps pending work when the Dev Hub object is replaced by a refetch of the orgs', async () => {
    const { result, rerender } = renderActions([buildRecord('Creating')]);

    act(() => result.current.trackPendingScratchOrg(buildPending()));
    rerender({ org: { ...devHubOrg }, records: [buildRecord('Creating')] });

    expect(result.current.pendingSteps).toEqual({ [SCRATCH_ORG_INFO_ID]: 'creating' });
    expect(fireToast).not.toHaveBeenCalled();
  });

  it('removes every Jetstream connection of a deleted scratch org', async () => {
    const secondUser = { uniqueId: 'scratch-org-second-user' } as SalesforceOrgUi;
    const { result, refresh } = renderActions();

    await act(async () => {
      await result.current.remove({ Id: SCRATCH_ORG_INFO_ID, Status: 'Active' }, [scratchOrg, secondUser]);
    });

    expect(deleteScratchOrg).toHaveBeenCalledWith(devHubOrg, { Id: SCRATCH_ORG_INFO_ID, Status: 'Active' });
    expect(vi.mocked(deleteOrg).mock.calls).toEqual([[scratchOrg], [secondUser]]);
    expect(getOrgs).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('leaves the connections alone when Salesforce refuses to delete the scratch org', async () => {
    vi.mocked(deleteScratchOrg).mockRejectedValue(new Error('insufficient access'));
    const { result } = renderActions();

    await expect(result.current.remove({ Id: SCRATCH_ORG_INFO_ID, Status: 'Active' }, [scratchOrg])).rejects.toThrow('insufficient access');
    expect(deleteOrg).not.toHaveBeenCalled();
  });
});

describe('isPasswordlessRefused', () => {
  it('is true only for refusals that asking again cannot change', () => {
    expect(
      isPasswordlessRefused(new Error(`${SCRATCH_ORG_PASSWORDLESS_REFUSED_MESSAGE}, Salesforce did not accept its authorization code.`)),
    ).toBe(true);
    expect(isPasswordlessRefused(new Error(`${SCRATCH_ORG_NOT_REACHABLE_MESSAGE}, new scratch orgs can take a few minutes.`))).toBe(false);
    expect(isPasswordlessRefused(new Error('Failed to fetch'))).toBe(false);
    expect(isPasswordlessRefused(new Error('Request failed with status code 503'))).toBe(false);
  });
});

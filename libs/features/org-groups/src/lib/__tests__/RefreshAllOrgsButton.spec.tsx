import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { atom } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshAllOrgsButton } from '../RefreshAllOrgsButton';

const checkOrgHealth = vi.fn();
const getOrgs = vi.fn();
const fireToast = vi.fn();
const trackEvent = vi.fn();

vi.mock('@jetstream/shared/data', () => ({
  checkOrgHealth: (org: SalesforceOrgUi) => checkOrgHealth(org),
  getOrgs: () => getOrgs(),
}));

vi.mock('@jetstream/ui-core', () => ({
  useAmplitude: () => ({ trackEvent }),
}));

vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: { salesforceOrgsAsyncState: atom<SalesforceOrgUi[]>([]) },
}));

vi.mock('@jetstream/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/ui')>()),
  fireToast: (payload: unknown) => fireToast(payload),
}));

const orgs = ['org-1', 'org-2', 'org-3'].map((uniqueId) => ({ uniqueId }) as SalesforceOrgUi);

function setup() {
  render(<RefreshAllOrgsButton orgs={orgs} />);
  const button = screen.getByRole('button');
  // The refresh queue keeps updating progress state after the click settles, so let act() flush it
  return {
    button,
    clickRefresh: () =>
      act(async () => {
        fireEvent.click(button);
      }),
  };
}

describe('RefreshAllOrgsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgs.mockResolvedValue(orgs);
  });

  it('should refresh every org and report success', async () => {
    checkOrgHealth.mockResolvedValue(undefined);
    const { clickRefresh } = setup();

    await clickRefresh();

    await waitFor(() => expect(getOrgs).toHaveBeenCalledTimes(1));
    expect(checkOrgHealth).toHaveBeenCalledTimes(3);
    expect(fireToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_KEYS.sfdc_org_refresh_all, { orgCount: 3, successCount: 3, errorCount: 0 });
  });

  it('should keep refreshing the remaining orgs when one fails and report the partial result', async () => {
    checkOrgHealth.mockImplementation((org: SalesforceOrgUi) =>
      org.uniqueId === 'org-2' ? Promise.reject(new Error('expired')) : Promise.resolve(),
    );
    const { clickRefresh } = setup();

    await clickRefresh();

    await waitFor(() => expect(getOrgs).toHaveBeenCalledTimes(1));
    expect(checkOrgHealth).toHaveBeenCalledTimes(3);
    expect(fireToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_KEYS.sfdc_org_refresh_all, { orgCount: 3, successCount: 2, errorCount: 1 });
  });

  it('should report an error and still re-fetch orgs when every org fails', async () => {
    checkOrgHealth.mockRejectedValue(new Error('expired'));
    const { clickRefresh } = setup();

    await clickRefresh();

    await waitFor(() => expect(getOrgs).toHaveBeenCalledTimes(1));
    expect(fireToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_KEYS.sfdc_org_refresh_all, { orgCount: 3, successCount: 0, errorCount: 3 });
  });

  it('should show progress and prevent a second refresh while one is in flight', async () => {
    const pendingHealthChecks: Array<() => void> = [];
    checkOrgHealth.mockImplementation(() => new Promise<void>((resolve) => pendingHealthChecks.push(resolve)));
    const { button, clickRefresh } = setup();

    await clickRefresh();

    // aria-disabled (not native disabled) so the button keeps keyboard focus while the refresh runs
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('Refreshing 0 of 3');
    // The queue caps in-flight checks, so the remaining orgs stay queued until an earlier one settles
    expect(checkOrgHealth).toHaveBeenCalledTimes(2);

    // Resolve in waves - each wave lets the queue start the orgs that were still waiting behind it
    await act(async () => {
      while (pendingHealthChecks.length > 0) {
        pendingHealthChecks.splice(0).forEach((resolve) => resolve());
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(checkOrgHealth).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBeNull());
  });

  it('should explain the inactivity expiration in a tooltip', async () => {
    const { button } = setup();

    await userEvent.hover(button);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('has not been used for 30 days');
    expect(tooltip.textContent).toContain('resets the 30-day clock');
  });
});

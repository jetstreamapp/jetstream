import { SalesforceOrgUi } from '@jetstream/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { OrgSelectionRequired } from '../OrgSelectionRequired';

const { checkOrgHealth, fireToast, selectedOrg } = vi.hoisted(() => ({
  checkOrgHealth: vi.fn(),
  fireToast: vi.fn(),
  selectedOrg: {
    uniqueId: '00D000000000001-005000000000001',
    label: 'john.smith@acme.com',
    username: 'john.smith@acme.com',
    instanceUrl: 'https://acme.my.salesforce.com',
    connectionError: 'expired access/refresh token',
  } as SalesforceOrgUi,
}));

vi.mock('@jetstream/shared/data', () => ({
  checkOrgHealth,
  getOrgs: vi.fn(() => []),
}));

vi.mock('@jetstream/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/ui')>()),
  fireToast,
}));

// `@jetstream/ui/app-state` fetches app info and the user profile at module load - only the org atoms are needed here
vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    fromAppState: {
      salesforceOrgsState: atom([selectedOrg]),
      selectedOrgStateWithoutPlaceholder: atom(selectedOrg),
      hasConfiguredOrgState: atom(true),
      orgGroupsState: atom([]),
      orgGroupExistsSelector: atom(false),
      ActiveOrgGroupState: atom(null),
      jetstreamActiveGroupSelector: atom(null),
      selectedOrgIdState: atom(selectedOrg.uniqueId),
    },
    useCanPerformOperation: () => true,
  };
});

// The full ui-core barrel and the org pickers are not part of the retry flow
vi.mock('../..', () => ({
  fromJetstreamEvents: { emit: vi.fn() },
  OrgsDropdown: () => null,
}));
vi.mock('../AddOrg', () => ({ AddOrg: () => null }));
vi.mock('../OrgWelcomeInstructions', () => ({ OrgWelcomeInstructions: () => null }));
vi.mock('../OrganizationGroupSelector', () => ({ OrganizationGroupSelector: () => null }));

describe('OrgSelectionRequired', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('Retry Connection keeps focus while it runs and ignores repeat activation', async () => {
    let resolveHealthCheck: () => void = () => undefined;
    checkOrgHealth.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveHealthCheck = resolve;
      }),
    );
    render(
      <MemoryRouter>
        <OrgSelectionRequired />
      </MemoryRouter>,
    );
    const retryButton = screen.getByRole('button', { name: 'Retry Connection' });
    retryButton.focus();

    fireEvent.click(retryButton);

    expect(retryButton.getAttribute('aria-disabled')).toBe('true');
    expect(retryButton.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(retryButton);

    fireEvent.click(retryButton);
    expect(checkOrgHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveHealthCheck();
    });

    expect(retryButton.hasAttribute('aria-disabled')).toBe(false);
    expect(document.activeElement).toBe(retryButton);
    expect(fireToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });
});

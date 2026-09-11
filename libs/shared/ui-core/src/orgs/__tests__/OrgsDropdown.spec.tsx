import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { atom, getDefaultStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';

const org = {
  uniqueId: '00D000000000001-005000000000001',
  label: 'Acme',
  username: 'john.smith@acme.com',
  orgName: 'ACME Corporation',
  organizationId: '00D000000000001',
  instanceUrl: 'https://acme.my.salesforce.com',
  userId: '005000000000001',
  email: 'john.smith@acme.com',
} as SalesforceOrgUi;

// Real jotai atoms stand in for the app state so the removal can update them the way the app does
const salesforceOrgsState = atom<SalesforceOrgUi[]>([org]);
const selectedOrgIdState = atom<string | null>(org.uniqueId);
const selectedOrgStateWithoutPlaceholder = atom(
  (get) => get(salesforceOrgsState).find(({ uniqueId }) => uniqueId === get(selectedOrgIdState)) ?? null,
);

vi.doMock('@jetstream/ui/app-state', () => ({
  applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app' }),
  selectSkipFrontdoorAuth: atom(false),
  getRecentlySelectedOrgForGroup: () => null,
  setRecentlySelectedOrgsToStorage: vi.fn(),
  fromAppState: {
    salesforceOrgsState,
    salesforceOrgsForGroupSelector: salesforceOrgsState,
    selectedOrgStateWithoutPlaceholder,
    selectedOrgIdState,
    selectedOrgType: atom((get) => (get(selectedOrgStateWithoutPlaceholder) ? 'Sandbox' : null)),
    orgGroupsState: atom([]),
    orgGroupExistsSelector: atom(false),
    ActiveOrgGroupState: atom(undefined),
    jetstreamActiveGroupSelector: atom(undefined),
  },
}));

vi.doMock('../..', async () => ({
  ...(await vi.importActual<typeof import('../OrgsCombobox')>('../OrgsCombobox')),
  useAmplitude: () => ({ trackEvent: vi.fn() }),
  useOrgPermissions: () => ({ hasMetadataAccess: true }),
}));

vi.doMock('../../state-management/query.state', () => ({ hasOrderByConfigured: false }));
vi.doMock('../OrgPersistence', () => ({ OrgPersistence: () => null }));
vi.doMock('@jetstream/shared/data', () => ({ clearCacheForOrg: vi.fn() }));

const handleRemoveOrg = vi.fn(async () => {
  getDefaultStore().set(salesforceOrgsState, []);
  getDefaultStore().set(selectedOrgIdState, null);
  return true;
});

vi.doMock('../useUpdateOrgs', () => ({
  useUpdateOrgs: () => ({
    actionInProgress: false,
    orgLoading: false,
    handleAddOrg: vi.fn(),
    handleRemoveOrg,
    handleUpdateOrg: vi.fn(),
  }),
}));

const { OrgsDropdown } = await import('../OrgsDropdown');

describe('OrgsDropdown', () => {
  // Removing the selected org unmounts the info popover and its trigger, so the popover cannot
  // return focus anywhere; the org switcher is the control the user needs next
  it('moves focus to the org switcher after the selected org is removed', async () => {
    render(<OrgsDropdown omitAddOrgsButton omitOrganizationSelector />);

    fireEvent.click(screen.getByRole('button', { name: 'Salesforce org details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Org' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Org' }));

    await waitFor(() => expect(handleRemoveOrg).toHaveBeenCalledWith(org));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salesforce org details' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox')));
  });
});

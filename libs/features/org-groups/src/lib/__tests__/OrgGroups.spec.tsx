import { OrgGroup, OrgGroupWithOrgs, SalesforceOrgUi } from '@jetstream/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { atom, createStore, Provider } from 'jotai';
import { unwrap } from 'jotai/utils';
import ModalContainer from 'react-modal-promise';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOrgGroup = vi.fn();
const updateOrgGroup = vi.fn();
const deleteOrgGroup = vi.fn();
const deleteOrg = vi.fn();
const getOrgGroups = vi.fn();
const getOrgs = vi.fn();
const trackEvent = vi.fn();

// The real app-state module fetches app info, the profile and org groups at module load. These stubs mirror
// just the atoms the page touches, keeping the same unwrap() shape so the page's async updater writes resolve.
const orgGroupsAsyncState = atom<Promise<OrgGroup[]> | OrgGroup[]>([]);
const salesforceOrgsAsyncState = atom<Promise<SalesforceOrgUi[]> | SalesforceOrgUi[]>([]);

vi.doMock('@jetstream/ui/app-state', () => {
  const orgGroupsState = unwrap(orgGroupsAsyncState, (prev) => prev ?? []);
  const salesforceOrgsState = unwrap(salesforceOrgsAsyncState, (prev) => prev ?? []);
  const selectedOrgIdState = atom<string | null>(null);
  const ActiveOrgGroupState = atom<string | null>(null);
  const orgGroupsWithOrgsSelector = atom(
    (get) => {
      const orgs = get(salesforceOrgsState);
      return get(orgGroupsState).map((group) => ({
        ...group,
        orgs: group.orgs.map(({ uniqueId }) => orgs.find((org) => org.uniqueId === uniqueId)).filter(Boolean),
      }));
    },
    (_get, set, newValue: OrgGroupWithOrgs[]) =>
      set(
        orgGroupsState,
        newValue.map((group) => ({ ...group, orgs: group.orgs.map(({ uniqueId }) => ({ uniqueId })) })),
      ),
  );
  return {
    fromAppState: {
      orgGroupsState,
      orgGroupsWithOrgsSelector,
      ActiveOrgGroupState,
      salesforceOrgsState,
      salesforceOrgsAsyncState,
      selectedOrgIdState,
      salesforceOrgsWithoutGroupSelector: atom((get) => get(salesforceOrgsState).filter((org) => !org.jetstreamOrganizationId)),
      selectedOrgStateWithoutPlaceholder: atom((get) => {
        const selectedOrgId = get(selectedOrgIdState);
        return get(salesforceOrgsState).find((org) => org.uniqueId === selectedOrgId);
      }),
    },
    getRecentlySelectedOrgForGroup: () => null,
  };
});

vi.doMock('@jetstream/ui-core', () => ({
  AddOrg: ({ label }: { label: string }) => <button type="button">{label}</button>,
  ConfirmPageChange: () => null,
  OrgInfoPopover: () => null,
  useAmplitude: () => ({ trackEvent }),
  useOrgExpiration: () => ({ isExpiring: false, isExpired: false }),
  useUpdateOrgs: () => ({
    actionInProgress: false,
    orgLoading: false,
    handleAddOrg: vi.fn(),
    handleRemoveOrg: vi.fn(),
    handleUpdateOrg: vi.fn(),
  }),
}));

vi.doMock('@jetstream/shared/data', () => ({
  addOrgToGroup: vi.fn(),
  checkOrgHealth: vi.fn(),
  createOrgGroup: (...args: unknown[]) => createOrgGroup(...args),
  deleteOrg: (...args: unknown[]) => deleteOrg(...args),
  deleteOrgGroup: (...args: unknown[]) => deleteOrgGroup(...args),
  deleteOrgGroupAndAllOrgs: vi.fn(),
  getOrgGroups: () => getOrgGroups(),
  getOrgs: () => getOrgs(),
  updateOrgGroup: (...args: unknown[]) => updateOrgGroup(...args),
}));

const { OrgGroups } = await import('../OrgGroups');

function buildGroup(overrides: Partial<OrgGroup> = {}): OrgGroup {
  return { id: 'group-1', name: 'Production', description: '', orgs: [], ...overrides } as OrgGroup;
}

function buildOrg(overrides: Partial<SalesforceOrgUi> = {}): SalesforceOrgUi {
  return {
    uniqueId: 'org-1',
    label: 'Acme Sandbox',
    username: 'admin@acme.com',
    organizationId: '00D000000000001',
    instanceUrl: 'https://acme.my.salesforce.com',
    jetstreamOrganizationId: null,
    ...overrides,
  } as SalesforceOrgUi;
}

function setup({ groups = [], orgs = [] }: { groups?: OrgGroup[]; orgs?: SalesforceOrgUi[] } = {}) {
  const store = createStore();
  store.set(orgGroupsAsyncState, groups);
  store.set(salesforceOrgsAsyncState, orgs);
  render(
    <Provider store={store}>
      <ModalContainer />
      <OrgGroups />
    </Provider>,
  );
}

function getCreateButton() {
  return screen.getByRole('button', { name: 'Create New Group' });
}

async function submitGroupName(name: string) {
  const nameInput = await screen.findByLabelText(/Group Name/);
  await waitFor(() => expect(document.activeElement).toBe(nameInput));
  userEvent.clear(nameInput);
  await userEvent.type(nameInput, name);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('OrgGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgGroups.mockResolvedValue([]);
    getOrgs.mockResolvedValue([]);
  });

  describe('focus management', () => {
    it('returns focus to "Create New Group" after a group is created through the modal', async () => {
      createOrgGroup.mockResolvedValue(buildGroup({ id: 'group-2', name: 'Sandboxes' }));
      setup();
      const createButton = getCreateButton();

      userEvent.click(createButton);
      await submitGroupName('Sandboxes');

      expect(createOrgGroup).toHaveBeenCalledWith({ name: 'Sandboxes', description: '' });
      await screen.findByTestId('org-group-card-Sandboxes');
      await waitFor(() => expect(document.activeElement).toBe(createButton));
    });

    it("returns focus to the group's Edit button after the group is updated", async () => {
      const group = buildGroup();
      updateOrgGroup.mockResolvedValue({ ...group, name: 'Prod' });
      setup({ groups: [group] });
      const editButton = screen.getByRole('button', { name: 'Edit - Production' });

      userEvent.click(editButton);
      await submitGroupName('Prod');

      expect(updateOrgGroup).toHaveBeenCalledWith('group-1', { name: 'Prod', description: '' });
      await screen.findByTestId('org-group-card-Prod');
      await waitFor(() => expect(document.activeElement).toBe(editButton));
    });

    it('moves focus to "Create New Group" after a group is deleted, since the group\'s own menu is gone', async () => {
      deleteOrgGroup.mockResolvedValue(undefined);
      setup({ groups: [buildGroup()] });

      userEvent.click(screen.getByRole('button', { name: 'More Actions - Production' }));
      userEvent.click(screen.getByRole('menuitem', { name: 'Delete Group' }));
      userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(deleteOrgGroup).toHaveBeenCalledWith('group-1'));
      await waitFor(() => expect(screen.queryByTestId('org-group-card-Production')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(getCreateButton()));
    });

    it('moves focus to "Create New Group" after the last org is deleted, since the org actions menu unmounts with it', async () => {
      deleteOrg.mockResolvedValue(undefined);
      setup({ orgs: [buildOrg()] });

      userEvent.click(screen.getByRole('button', { name: 'Salesforce org actions' }));
      userEvent.click(screen.getByRole('menuitem', { name: 'Delete Salesforce Orgs' }));
      userEvent.click(await screen.findByLabelText('Select All'));
      // Two presses: the first swaps the label to "Are you sure?", the second deletes
      userEvent.click(screen.getByRole('button', { name: 'Delete 1 Org' }));
      userEvent.click(screen.getByRole('button', { name: 'Are you sure?' }));

      await waitFor(() => expect(deleteOrg).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Salesforce org actions' })).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(getCreateButton()));
    });
  });
});

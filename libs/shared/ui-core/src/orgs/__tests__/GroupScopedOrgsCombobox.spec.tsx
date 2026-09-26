import { Maybe, OrgGroup, SalesforceOrgUi } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { GroupScopedOrgsCombobox, GroupScopedOrgsComboboxProps } from '../GroupScopedOrgsCombobox';

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  getOrgs: vi.fn().mockResolvedValue([]),
  getOrgGroups: vi.fn().mockResolvedValue([]),
}));

function buildOrg(uniqueId: string, jetstreamOrganizationId: string | null = null): SalesforceOrgUi {
  return {
    uniqueId,
    label: uniqueId,
    username: `${uniqueId}@example.com`,
    orgName: 'Example Corp',
    organizationId: '00D000000000001',
    instanceUrl: 'https://example.my.salesforce.com',
    filterText: '',
    accessToken: '',
    loginUrl: '',
    userId: '005000000000001',
    email: `${uniqueId}@example.com`,
    displayName: uniqueId,
    jetstreamOrganizationId,
  } as SalesforceOrgUi;
}

function buildGroup(id: string, name: string, orgs: SalesforceOrgUi[]): OrgGroup {
  return {
    id,
    name,
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    orgs: orgs.map(({ uniqueId }) => ({ uniqueId })),
  };
}

const acmeProd = buildOrg('acme-prod', 'acme');
const acmeUat = buildOrg('acme-uat', 'acme');
const globexProd = buildOrg('globex-prod', 'globex');
const scratch = buildOrg('scratch');

const allOrgs = [acmeProd, acmeUat, globexProd, scratch];
const allGroups = [buildGroup('acme', 'Acme', [acmeProd, acmeUat]), buildGroup('globex', 'Globex', [globexProd])];

function renderPicker({
  activeGroupId = null,
  groups = allGroups,
  ...props
}: Partial<GroupScopedOrgsComboboxProps> & { activeGroupId?: Maybe<string>; groups?: OrgGroup[] } = {}) {
  const store = createStore();
  store.set(fromAppState.salesforceOrgsState, allOrgs);
  store.set(fromAppState.orgGroupsState, groups);
  store.set(fromAppState.ActiveOrgGroupState, activeGroupId);
  const result = render(
    <Provider store={store}>
      <GroupScopedOrgsCombobox orgs={allOrgs} selectedOrg={null} onSelected={vi.fn()} {...props} />
    </Provider>,
  );
  const input = result.container.querySelector('input') as HTMLInputElement;
  return {
    ...result,
    input,
    listedOrgs: () => {
      fireEvent.click(input);
      const listbox = result.container.querySelector('[role="listbox"]') as HTMLElement;
      return allOrgs.filter(({ label }) => within(listbox).queryByText(label)).map(({ uniqueId }) => uniqueId);
    },
  };
}

describe('GroupScopedOrgsCombobox', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('lists only the orgs in the active group and says how many are hidden', () => {
    const { listedOrgs } = renderPicker({ activeGroupId: 'acme' });
    expect(listedOrgs()).toEqual(['acme-prod', 'acme-uat']);
    expect(screen.getByText(/Showing orgs in "Acme"/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show all orgs (2 more in 2 other groups)' })).toBeTruthy();
  });

  it('switches between all orgs and the active group', () => {
    const { listedOrgs } = renderPicker({ activeGroupId: 'acme' });

    fireEvent.click(screen.getByRole('button', { name: /Show all orgs/ }));
    expect(listedOrgs()).toEqual(['acme-prod', 'acme-uat', 'globex-prod', 'scratch']);
    expect(screen.getByText(/Showing all orgs/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Only show orgs in "Acme"' }));
    expect(listedOrgs()).toEqual(['acme-prod', 'acme-uat']);
  });

  it('lists only ungrouped orgs when no group is active', () => {
    const { listedOrgs } = renderPicker({ activeGroupId: null });
    expect(listedOrgs()).toEqual(['scratch']);
    expect(screen.getByText(/Showing orgs without a group/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show all orgs (3 more in 2 groups)' })).toBeTruthy();
  });

  it('treats a group id that no longer exists as no group rather than listing nothing', () => {
    const { listedOrgs } = renderPicker({ activeGroupId: 'deleted-group' });
    expect(listedOrgs()).toEqual(['scratch']);
  });

  it('keeps the selected org visible when it is outside the active group', () => {
    const { input, listedOrgs } = renderPicker({ activeGroupId: 'acme', selectedOrg: globexProd });
    expect(input.value).toContain('globex-prod');
    expect(listedOrgs()).toEqual(['acme-prod', 'acme-uat', 'globex-prod']);
  });

  it('behaves like a plain org picker when no groups are configured', () => {
    const { listedOrgs } = renderPicker({ groups: [], activeGroupId: null });
    expect(listedOrgs()).toEqual(['acme-prod', 'acme-uat', 'globex-prod', 'scratch']);
    expect(screen.queryByText(/Show all orgs/)).toBeNull();
  });

  it('omits the help text when the picker is disabled', () => {
    renderPicker({ activeGroupId: 'acme', disabled: true });
    expect(screen.queryByText(/Show all orgs/)).toBeNull();
  });
});

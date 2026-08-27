import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { OrgsCombobox } from '../OrgsCombobox';

function buildOrg(overrides: Partial<SalesforceOrgUi>): SalesforceOrgUi {
  return {
    uniqueId: '00D000000000001-005000000000001',
    label: 'john.smith@acme.com',
    username: 'john.smith@acme.com',
    orgName: 'ACME Corporation',
    organizationId: '00D000000000001',
    instanceUrl: 'https://acme.my.salesforce.com',
    filterText: '',
    accessToken: '',
    loginUrl: '',
    userId: '005000000000001',
    email: 'john.smith@acme.com',
    displayName: 'John Smith',
    ...overrides,
  } as SalesforceOrgUi;
}

const production = buildOrg({ uniqueId: 'prod', orgOrganizationType: 'Enterprise Edition' });
const uatSandbox = buildOrg({
  uniqueId: 'uat',
  label: 'UAT Sandbox',
  username: 'john.smith@acme.com.uat',
  organizationId: '00D000000000002',
  instanceUrl: 'https://acme--uat.sandbox.my.salesforce.com',
  orgIsSandbox: true,
});
const fullCopySandbox = buildOrg({
  uniqueId: 'fullcopy',
  label: 'Full Copy',
  username: 'john.smith@acme.com.fullcopy',
  orgIsSandbox: true,
});

const orgs = [production, uatSandbox, fullCopySandbox];

function renderOpen(selectedOrg: SalesforceOrgUi | null = null) {
  const onSelected = vi.fn();
  const result = render(<OrgsCombobox orgs={orgs} selectedOrg={selectedOrg} onSelected={onSelected} />);
  const input = result.container.querySelector('input') as HTMLInputElement;
  fireEvent.click(input);
  return { ...result, input, onSelected, listbox: result.container.querySelector('[role="listbox"]') as HTMLElement };
}

describe('OrgsCombobox', () => {
  it('shows the full username for every org rather than truncating it', () => {
    const { listbox } = renderOpen();
    // The suffix is the only thing distinguishing these orgs, so it must survive
    expect(within(listbox).getByText('john.smith@acme.com.uat')).toBeTruthy();
    expect(within(listbox).getByText('john.smith@acme.com.fullcopy')).toBeTruthy();
  });

  it('does not truncate usernames', () => {
    const { listbox } = renderOpen();
    expect(within(listbox).getByText('john.smith@acme.com.uat').className).not.toContain('slds-truncate');
  });

  it('tags each org with its type so sandboxes are distinguishable at a glance', () => {
    const { listbox } = renderOpen();
    expect(within(listbox).getAllByText('Sandbox')).toHaveLength(2);
    expect(within(listbox).getAllByText('Production')).toHaveLength(1);
  });

  it('lets the panel size itself independently of the input', () => {
    const { listbox } = renderOpen();
    const styles = getComputedStyle(listbox);
    expect(listbox.className).not.toContain('slds-dropdown_fluid');
    expect(styles.maxWidth).toBe('32rem');
  });

  describe('search', () => {
    // The combobox debounces filter input, so assertions wait for the filtered list to settle
    async function search(term: string) {
      const { input, container } = renderOpen();
      // The combobox reads the filter off keyUp, not change
      fireEvent.change(input, { target: { value: term } });
      fireEvent.keyUp(input, { key: term.slice(-1) });
      const listbox = () => container.querySelector('[role="listbox"]') as HTMLElement;
      await waitFor(() => expect(within(listbox()).queryAllByRole('option').length).toBeLessThan(orgs.length));
      return listbox();
    }

    it('matches on username even when the org has a custom label', async () => {
      const listbox = await search('fullcopy');
      expect(within(listbox).getByText('john.smith@acme.com.fullcopy')).toBeTruthy();
      expect(within(listbox).queryByText('john.smith@acme.com.uat')).toBeNull();
    });

    it('matches on label', async () => {
      const listbox = await search('UAT');
      expect(within(listbox).getByText('UAT Sandbox')).toBeTruthy();
      expect(within(listbox).queryByText('Full Copy')).toBeNull();
    });

    it('matches on instance url', async () => {
      const listbox = await search('--uat.sandbox');
      expect(within(listbox).getByText('UAT Sandbox')).toBeTruthy();
      expect(within(listbox).queryByText('Full Copy')).toBeNull();
    });

    it('matches on organization id', async () => {
      const listbox = await search('00D000000000002');
      expect(within(listbox).getByText('UAT Sandbox')).toBeTruthy();
      expect(within(listbox).queryByText('Full Copy')).toBeNull();
    });

    it('shows the empty state when nothing matches', async () => {
      const listbox = await search('nomatch.my.salesforce.com');
      expect(within(listbox).queryAllByRole('option')).toHaveLength(1);
      expect(within(listbox).getByText('There are no items for selection')).toBeTruthy();
    });
  });
});

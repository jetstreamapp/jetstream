import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteOrgsModal } from '../DeleteOrgsModal';

vi.mock('@jetstream/shared/data', () => ({ deleteOrg: vi.fn() }));

const org = {
  uniqueId: 'org-1',
  label: 'Sandbox',
  username: 'admin@example.com',
  orgName: 'Acme',
  organizationId: '00D000000000001',
  instanceUrl: 'https://acme.my.salesforce.com',
} as SalesforceOrgUi;

function setup() {
  render(<DeleteOrgsModal orgs={[org]} onClose={vi.fn()} onDeleted={vi.fn()} />);
  // The name is matched exactly, so a second <label> folding the details into it would not be found
  return screen.getByRole('checkbox', { name: 'admin@example.com' }) as HTMLInputElement;
}

function getDescription(checkbox: HTMLElement) {
  const describedBy = checkbox.getAttribute('aria-describedby') ?? '';
  return describedBy
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('DeleteOrgsModal', () => {
  it('names the checkbox by the username only and describes it with the org details', () => {
    const checkbox = setup();

    const description = getDescription(checkbox);
    expect(description).toContain('Org Id: 00D000000000001');
    expect(description).toContain('https://acme.my.salesforce.com');
  });

  it('toggles the org when its details are clicked', () => {
    const checkbox = setup();
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByText('Org Id: 00D000000000001'));

    expect(checkbox.checked).toBe(true);
  });
});

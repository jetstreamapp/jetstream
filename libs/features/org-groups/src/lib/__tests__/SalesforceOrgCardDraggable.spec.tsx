import { DragDropProvider } from '@dnd-kit/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { render, screen, waitFor } from '@testing-library/react';
import { atom } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { ORG_GROUP_DRAG_INSTRUCTIONS, ORG_GROUP_DRAG_PLUGINS } from '../org-group-drag-announcements';

// The org info popover lives in ui-core; the card's own controls are what this spec inspects
vi.doMock('@jetstream/ui-core', () => ({
  AddOrg: ({ label }: { label: string }) => <button type="button">{label}</button>,
  OrgInfoPopover: () => null,
  useAmplitude: () => ({ trackEvent: vi.fn() }),
  useOrgExpiration: () => ({ isExpiring: false, isExpired: false }),
  useUpdateOrgs: () => ({
    actionInProgress: false,
    orgLoading: false,
    handleAddOrg: vi.fn(),
    handleRemoveOrg: vi.fn(),
    handleUpdateOrg: vi.fn(),
  }),
}));

vi.doMock('@jetstream/ui/app-state', () => ({
  fromAppState: { salesforceOrgsAsyncState: atom<SalesforceOrgUi[]>([]) },
}));

vi.doMock('@jetstream/shared/data', () => ({
  checkOrgHealth: vi.fn(),
  getOrgs: vi.fn(),
}));

const { SalesforceOrgCardDraggable } = await import('../SalesforceOrgCardDraggable');

const org = {
  uniqueId: '00D000000000001-005000000000001',
  label: 'Acme Sandbox',
  username: 'admin@acme.com',
  organizationId: '00D000000000001',
  instanceUrl: 'https://acme.my.salesforce.com',
  jetstreamOrganizationId: null,
} as SalesforceOrgUi;

function renderCard() {
  return render(
    <DragDropProvider plugins={ORG_GROUP_DRAG_PLUGINS}>
      <SalesforceOrgCardDraggable org={org} isActive={false} />
    </DragDropProvider>,
  );
}

function getAccessibleName(element: Element) {
  return element.getAttribute('aria-label') ?? element.textContent ?? '';
}

describe('SalesforceOrgCardDraggable', () => {
  it('names the drag handle after the action and the org, and describes it with the move instructions', async () => {
    renderCard();
    const handle = screen.getByRole('button', { name: 'Move Acme Sandbox' });

    // dnd-kit applies its attributes in a scheduled effect after mount
    await waitFor(() => expect(handle.getAttribute('aria-describedby')).toBeTruthy());
    expect(handle.getAttribute('aria-roledescription')).toBe('draggable');
    const description = document.getElementById(handle.getAttribute('aria-describedby') as string);
    expect(description?.textContent).toBe(ORG_GROUP_DRAG_INSTRUCTIONS.draggable);
  });

  it('keeps the org id and instance url as plain content, outside every control name', async () => {
    renderCard();
    const handle = screen.getByRole('button', { name: 'Move Acme Sandbox' });
    await waitFor(() => expect(handle.getAttribute('aria-describedby')).toBeTruthy());

    const controls = Array.from(document.querySelectorAll('button, a[href], input, [tabindex]'));
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const name = getAccessibleName(control);
      const description = document.getElementById(control.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
      expect(`${name} ${description}`).not.toContain(org.organizationId);
      expect(`${name} ${description}`).not.toContain(org.instanceUrl);
    }

    // The details remain readable in browse mode
    expect(screen.getByText(org.organizationId)).toBeTruthy();
    expect(screen.getByText(org.instanceUrl)).toBeTruthy();
    // The heading is a programmatic focus target only (tabindex -1), named by the org label alone
    expect(screen.getByRole('heading', { name: 'Acme Sandbox' }).getAttribute('tabindex')).toBe('-1');
  });
});

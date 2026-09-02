import { axeScan } from '@jetstream/test-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { atom } from 'jotai';
import { describe, expect, it, vi } from 'vitest';

// `@jetstream/ui/app-state` fetches app info at module load and `..` is the full ui-core barrel;
// neither is needed for the focus behaviour under test. `doMock` + dynamic import as in AddOrg.spec.
vi.doMock('@jetstream/ui/app-state', () => ({
  applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app' }),
  selectSkipFrontdoorAuth: atom(false),
}));

vi.doMock('../..', () => ({
  useAmplitude: () => ({ trackEvent: vi.fn() }),
}));

vi.doMock('@jetstream/shared/data', () => ({
  clearCacheForOrg: vi.fn(),
}));

const { OrgInfoPopover } = await import('../OrgInfoPopover');

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

function renderOpen() {
  const onRemoveOrg = vi.fn();
  const result = render(<OrgInfoPopover org={org} onRemoveOrg={onRemoveOrg} />);
  fireEvent.click(screen.getByRole('button', { name: 'Salesforce org details' }));
  return { ...result, onRemoveOrg };
}

describe('OrgInfoPopover', () => {
  describe('remove org confirmation', () => {
    // The button that was activated unmounts as the confirmation mounts, so without explicit
    // handling focus falls to <body> both on the way in and on the way back out
    it('moves focus to "Keep Org" when the confirmation opens and back to "Remove Org" when it is dismissed', async () => {
      renderOpen();
      const removeOrgButton = screen.getByRole('button', { name: 'Remove Org' });
      removeOrgButton.focus();
      fireEvent.click(removeOrgButton);

      const keepOrgButton = screen.getByRole('button', { name: 'Keep Org' });
      await waitFor(() => expect(document.activeElement).toBe(keepOrgButton));

      fireEvent.click(keepOrgButton);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Org' })));
    });

    it('describes both confirmation buttons with the warning text, since focus lands on them directly', () => {
      renderOpen();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Org' }));

      for (const buttonName of ['Keep Org', 'Remove Org']) {
        const describedById = screen.getByRole('button', { name: buttonName }).getAttribute('aria-describedby') as string;
        expect(document.getElementById(describedById)?.textContent).toMatch(/remove this org from jetstream/i);
      }
    });

    it('removes the org from the confirmation and passes the axe scan while it is open', async () => {
      const { baseElement, onRemoveOrg } = renderOpen();
      fireEvent.click(screen.getByRole('button', { name: 'Remove Org' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Org' }));

      expect(onRemoveOrg).toHaveBeenCalledWith(org);
      await axeScan(baseElement);
    });
  });
});

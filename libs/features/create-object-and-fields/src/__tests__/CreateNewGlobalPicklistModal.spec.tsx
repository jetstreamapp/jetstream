/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
const { createGlobalPicklistMock } = vi.hoisted(() => ({ createGlobalPicklistMock: vi.fn() }));

vi.mock('@jetstream/ui-core', () => ({
  createGlobalPicklist: createGlobalPicklistMock,
  generateApiNameFromLabel: (label: string) => label.replace(/\W/g, '_'),
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return { applicationCookieState: atom({ defaultApiVersion: 'v66.0' }) };
});

import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateNewGlobalPicklistModal } from '../CreateNewGlobalPicklistModal';

describe('CreateNewGlobalPicklistModal', () => {
  // Save is aria-disabled (it keeps focus), which unlike native disabled does not block the browser's implicit
  // submission when Enter is pressed in a field — the submit handler must refuse an incomplete form itself
  it('ignores Enter in a field while the value set is incomplete', () => {
    render(<CreateNewGlobalPicklistModal selectedOrg={{ uniqueId: 'org-1' } as SalesforceOrgUi} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /global picklist/i }));

    const labelInput = document.getElementById('global-label') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Regions' } });
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe('true');

    fireEvent.submit(labelInput.closest('form') as HTMLFormElement);

    expect(createGlobalPicklistMock).not.toHaveBeenCalled();
  });
});

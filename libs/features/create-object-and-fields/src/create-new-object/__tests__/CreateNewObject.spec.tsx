/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
vi.mock('@jetstream/ui/app-state', () => ({
  useOperationAccess: () => ({ allowed: false, deniedReason: 'Your access does not include deploying metadata' }),
}));

vi.mock('../CreateNewObjectModal', () => ({ CreateNewObjectModal: () => <div role="dialog">Create New Object</div> }));

import { SalesforceOrgUi } from '@jetstream/types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateNewObject } from '../CreateNewObject';

describe('CreateNewObject', () => {
  it('stays focusable and says why it is unavailable when the access profile does not allow deploying', () => {
    render(<CreateNewObject selectedOrg={{ uniqueId: 'org-1' } as SalesforceOrgUi} onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Create New Object' });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('title')).toBe(false);
    const descriptionIds = (button.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(descriptionIds.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Your access does not include deploying metadata',
    ]);

    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

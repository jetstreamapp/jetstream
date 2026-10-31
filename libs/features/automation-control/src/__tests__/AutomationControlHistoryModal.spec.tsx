/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// The `@jetstream/ui` barrel pulls in a drag-and-drop dependency that reads `ResizeObserver` at module evaluation
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    } as unknown as typeof ResizeObserver;
  }
});

const mockState = vi.hoisted(() => ({ entries: [] as AutomationControlHistoryEntry[] }));

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => mockState.entries }));

vi.mock('@jetstream/ui/db', () => ({
  AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG: 50,
  automationControlHistoryDb: { getEntries: () => undefined },
}));

vi.mock('@jetstream/ui-core', () => ({
  fromJetstreamEvents: { emit: () => undefined },
  useAnalytics: () => ({ trackEvent: () => undefined }),
}));

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ defaultApiVersion: 'v60.0' }),
    googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
  };
});

import { AutomationControlHistoryEntry, AutomationControlHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationControlHistoryModal } from '../AutomationControlHistoryModal';

function buildItem(status: AutomationControlHistoryItem['status']): AutomationControlHistoryItem {
  return {
    key: `ValidationRule_${status}`,
    type: 'ValidationRule',
    fullName: `Account.Rule_${status}`,
    sobject: 'Account',
    label: `Rule_${status}`,
    previous: { isActive: true, activeVersionNumber: null },
    deployed: { isActive: false, activeVersionNumber: null },
    status,
    errorMessage: status === 'error' ? 'Something failed' : null,
  };
}

function buildEntry(key: string, items: AutomationControlHistoryItem[]): AutomationControlHistoryEntry {
  return {
    key,
    org: 'org-1',
    action: 'deploy',
    source: null,
    createdAt: new Date(2026, 9, 20, 15, 15),
    sobjects: ['Account'],
    types: ['ValidationRule'],
    successCount: items.filter(({ status }) => status === 'success').length,
    errorCount: items.filter(({ status }) => status === 'error').length,
    incompleteCount: items.filter(({ status }) => status === 'incomplete').length,
    items,
  };
}

function renderModal() {
  return render(
    <AutomationControlHistoryModal selectedOrg={{ uniqueId: 'org-1' } as SalesforceOrgUi} onRestore={vi.fn()} onClose={vi.fn()} />,
  );
}

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('AutomationControlHistoryModal', () => {
  beforeEach(() => {
    mockState.entries = [buildEntry('ach_1', [buildItem('success')]), buildEntry('ach_2', [buildItem('error')])];
  });

  it('names the filter and the list, and hands ArrowDown from the filter to the selected deployment', async () => {
    const user = userEvent.setup();
    renderModal();

    const filter = screen.getByRole('searchbox', { name: 'Filter deployments' });
    const list = screen.getByRole('listbox', { name: 'Deployment history' });
    // Visible and announced (once the count settles)
    expect(screen.getAllByText('Showing 2 of 2 deployments')).toHaveLength(2);

    // Let the modal finish placing its initial focus, which would otherwise land after ours
    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
    act(() => filter.focus());
    await user.keyboard('{ArrowDown}');

    const [firstRow] = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(firstRow.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(firstRow);
  });

  it('keeps Roll Back focusable and says why when nothing was deployed successfully', async () => {
    mockState.entries = [buildEntry('ach_1', [buildItem('error')])];
    const user = userEvent.setup();
    renderModal();

    const rollBackButton = screen.getByRole('button', { name: 'Roll Back' });
    expect(rollBackButton.hasAttribute('disabled')).toBe(false);
    expect(rollBackButton.getAttribute('aria-disabled')).toBe('true');
    expect(getDescription(rollBackButton)).toBe('Nothing was deployed successfully, so there is nothing to roll back.');

    await user.click(rollBackButton);
    act(() => rollBackButton.focus());
    expect(document.activeElement).toBe(rollBackButton);
  });
});

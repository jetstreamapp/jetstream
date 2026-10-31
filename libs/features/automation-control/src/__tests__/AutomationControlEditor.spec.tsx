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

const mockState = vi.hoisted(() => ({
  stagedRestore: null as StagedHistoryRestore | null,
  pendingHistoryRestore: null as { entry: { createdAt: Date }; action: 'rollback' | 'redeploy' } | null,
  dirtyCount: 0,
  operationAccess: { allowed: true } as { allowed: boolean; deniedReason?: string },
}));

vi.mock('@jetstream/ui-core', async () => {
  const { atom } = await import('jotai');
  return {
    RequireMetadataApiBanner: () => null,
    fromAutomationControlState: {
      selectedSObjectsState: atom(['Account']),
      selectedAutomationTypes: atom(['ValidationRule']),
      pendingHistoryRestore: atom(null),
    },
    fromJetstreamEvents: { emit: () => undefined },
    useAnalytics: () => ({ trackEvent: () => undefined }),
  };
});

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ serverUrl: '', defaultApiVersion: 'v60.0' }),
    googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
    selectSkipFrontdoorAuth: atom(false),
    selectedOrgState: atom({ uniqueId: 'org-1' }),
    useOperationAccess: () => mockState.operationAccess,
  };
});

// Deploying refreshes the data, which clears a staged restore
vi.mock('../useAutomationControlData', async () => {
  const { useState } = await import('react');
  return {
    useAutomationControlData: () => {
      const [stagedRestore, setStagedRestore] = useState(mockState.stagedRestore);
      const noop = () => undefined;
      return {
        rows: [],
        treeRows: [],
        getSubRows: noop,
        hasError: false,
        loading: false,
        fetchData: () => setStagedRestore(null),
        refreshProcessBuilders: noop,
        updateIsActiveFlag: noop,
        toggleAll: noop,
        resetChanges: noop,
        tableRowsChange: noop,
        stageHistoryRestore: noop,
        stagedRestore,
        fetchStartedAt: 1,
        dirtyCount: mockState.dirtyCount,
      };
    },
  };
});

vi.mock('../useHistoryRestoreStaging', () => ({
  useHistoryRestoreStaging: () => ({ pendingHistoryRestore: mockState.pendingHistoryRestore, historyRestore: null }),
}));

vi.mock('../AutomationControlEditorTable', () => ({ default: () => null }));

vi.mock('../AutomationControlEditorReviewModal', () => ({
  default: ({ onClose }: { onClose: (refreshData?: boolean) => void }) => (
    <div role="dialog" aria-label="Review Changes">
      <button onClick={() => onClose(true)}>Deploy and close</button>
    </div>
  ),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationControlEditor } from '../AutomationControlEditor';
import { StagedHistoryRestore } from '../automation-control-types';

const STAGED_RESTORE: StagedHistoryRestore = {
  action: 'rollback',
  source: { key: 'history-1', createdAt: new Date(2026, 9, 20, 15, 15) },
  result: { stagedCount: 2, stagedKeys: ['a', 'b'], unchangedCount: 1, missingItems: [] },
};

function renderEditor() {
  return render(
    <MemoryRouter>
      <AutomationControlEditor />
    </MemoryRouter>,
  );
}

/** The editor's announcer and loaded-count regions (the banners are role=status too, but visible) */
function getAssistiveAnnouncements() {
  return screen
    .getAllByRole('status')
    .filter((element) => element.classList.contains('slds-assistive-text'))
    .map(({ textContent }) => textContent);
}

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('AutomationControlEditor', () => {
  beforeEach(() => {
    mockState.stagedRestore = null;
    mockState.pendingHistoryRestore = null;
    mockState.dirtyCount = 0;
    mockState.operationAccess = { allowed: true };
  });

  it('moves focus to History when a deploy started from the restore banner removes the banner', async () => {
    mockState.stagedRestore = STAGED_RESTORE;
    mockState.dirtyCount = 2;
    const user = userEvent.setup();
    renderEditor();

    // The toolbar has its own Review Changes, the banner's comes second
    const bannerReviewButton = screen.getAllByRole('button', { name: 'Review Changes' })[1];
    await user.click(bannerReviewButton);
    await user.click(screen.getByRole('button', { name: 'Deploy and close' }));

    expect(bannerReviewButton.isConnected).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'History' })));
  });

  it('announces what a restore from history staged', async () => {
    mockState.stagedRestore = STAGED_RESTORE;
    mockState.dirtyCount = 2;
    renderEditor();

    await waitFor(() =>
      expect(getAssistiveAnnouncements()).toContainEqual(
        expect.stringMatching(/^2 changes staged to roll back the changes deployed .+ 1 item already matches\.$/),
      ),
    );
  });

  it('announces that the current state is loading for a restore from history', async () => {
    mockState.pendingHistoryRestore = { entry: { createdAt: new Date(2026, 9, 20, 15, 15) }, action: 'redeploy' };
    renderEditor();

    await waitFor(() =>
      expect(getAssistiveAnnouncements()).toContainEqual(
        expect.stringMatching(/^Loading the current state from Salesforce to re-deploy the changes deployed /),
      ),
    );
  });

  it('keeps Review Changes focusable and says why it is unavailable without deploy access', () => {
    mockState.dirtyCount = 2;
    mockState.operationAccess = { allowed: false, deniedReason: 'Your access does not include deploying metadata' };
    renderEditor();

    const reviewButton = screen.getByRole('button', { name: 'Review Changes' });
    expect(reviewButton.hasAttribute('disabled')).toBe(false);
    expect(reviewButton.getAttribute('aria-disabled')).toBe('true');
    expect(reviewButton.getAttribute('aria-keyshortcuts')).toBeTruthy();
    expect(getDescription(reviewButton)).toBe('Your access does not include deploying metadata');

    act(() => reviewButton.focus());
    expect(document.activeElement).toBe(reviewButton);
  });
});

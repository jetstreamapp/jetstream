/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
const PROFILES_AND_PERM_SETS = {
  fetchMetadata: vi.fn(),
  loading: false,
  profiles: null,
  permissionSets: null,
  managedPermissionSets: null,
  hiddenProfileCount: 0,
  lastRefreshed: '',
};

vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  useProfilesAndPermSets: () => PROFILES_AND_PERM_SETS,
}));

// The real atoms load the user profile from the server
vi.mock('@jetstream/ui/app-state', async (importOriginal) => {
  const { atom } = await import('jotai');
  return {
    ...(await importOriginal<typeof import('@jetstream/ui/app-state')>()),
    applicationCookieState: atom({ serverUrl: 'http://localhost' }),
    selectSkipFrontdoorAuth: atom(false),
    selectedOrgState: atom({ uniqueId: 'org-1', label: 'org-1' }),
    useCanPerformOperation: () => true,
    useCanAccessTool: () => true,
    useFeatureFlag: () => false,
  };
});

vi.mock('@jetstream/ui-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/ui-core')>()),
  useAnalytics: () => ({ trackEvent: vi.fn() }),
  RequireMetadataApiBanner: () => null,
}));

vi.mock('@jetstream/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/ui')>()),
  ConnectedSobjectListMultiSelect: () => null,
}));

vi.mock('@jetstream/ui/db', () => ({ recentHistoryItemsDb: {} }));

vi.mock('../usePermissionableSobjects', () => ({
  usePermissionableSobjects: () => ({ permissionableSobjects: null, loading: false, refresh: vi.fn() }),
}));

import { ListItem, PermissionSetNoProfileRecord } from '@jetstream/types';
import { fromPermissionsState } from '@jetstream/ui-core';
import { STORAGE_KEYS } from '@jetstream/ui/app-state';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagePermissionsSelection } from '../ManagePermissionsSelection';

const CUSTOM_PERMISSION_SET_ID = '0PS000000000001';
const MANAGED_PERMISSION_SET_ID = '0PS000000000002';

function getPermissionSetItem(id: string, label: string, namespacePrefix: string | null): ListItem<string, PermissionSetNoProfileRecord> {
  return {
    id,
    label,
    value: id,
    meta: { Id: id, Name: label, Label: label, NamespacePrefix: namespacePrefix, IsOwnedByProfile: false } as PermissionSetNoProfileRecord,
  };
}

function renderSelection({ listsLoaded }: { listsLoaded: boolean }) {
  const store = createStore();
  if (listsLoaded) {
    store.set(fromPermissionsState.profilesState, []);
    store.set(fromPermissionsState.permissionSetsState, [getPermissionSetItem(CUSTOM_PERMISSION_SET_ID, 'Sales Ops', null)]);
    store.set(fromPermissionsState.managedPermissionSetsState, [getPermissionSetItem(MANAGED_PERMISSION_SET_ID, 'CPQ User', 'SBQQ')]);
    store.set(fromPermissionsState.selectedPermissionSetsState, [CUSTOM_PERMISSION_SET_ID, MANAGED_PERMISSION_SET_ID]);
  }
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ManagePermissionsSelection />
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

describe('ManagePermissionsSelection', () => {
  afterEach(() => {
    localStorage.clear();
  });

  // The lists reload after a permission set is created, just as the modal hands focus back to its trigger
  it('keeps New Permission Set and Clone focusable while the permission set lists load', () => {
    renderSelection({ listsLoaded: false });

    for (const name of ['New Permission Set', 'Clone permission set']) {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);

      act(() => button.focus());
      expect(document.activeElement).toBe(button);
      fireEvent.click(button);
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it("reaches a managed permission set's read-only explanation with ArrowRight from its row", async () => {
    localStorage.setItem(STORAGE_KEYS.PERMISSION_MANAGER_SHOW_MANAGED_PERM_SETS, 'true');
    renderSelection({ listsLoaded: true });
    const managedRow = screen.getByRole('option', { name: /CPQ User/ });

    act(() => managedRow.focus());
    fireEvent.keyDown(managedRow, { key: 'ArrowRight' });

    const lockTrigger = document.activeElement as HTMLElement;
    expect(managedRow.contains(lockTrigger)).toBe(true);
    expect(lockTrigger.tabIndex).toBe(-1);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Salesforce does not allow these permissions to be changed');
  });

  it('announces the managed permission sets dropped from the selection when they are hidden', async () => {
    localStorage.setItem(STORAGE_KEYS.PERMISSION_MANAGER_SHOW_MANAGED_PERM_SETS, 'true');
    const store = renderSelection({ listsLoaded: true });

    fireEvent.click(screen.getByLabelText(/Show managed permission sets/));

    expect(store.get(fromPermissionsState.selectedPermissionSetsState)).toEqual([CUSTOM_PERMISSION_SET_ID]);
    await waitFor(() =>
      expect(screen.getAllByRole('status').map(({ textContent }) => textContent)).toContain(
        '1 managed permission set removed from selection',
      ),
    );
  });
});

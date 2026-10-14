import { SalesforceOrgUi } from '@jetstream/types';
import { fromPermissionsState } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ManagePermissions } from '../ManagePermissions';

const MANAGED_PERMISSION_SET_ID = '0PS000000000001';

/**
 * Renders the editor route directly, the way browser back/forward reaches it, with a managed permission set and an
 * object already selected.
 */
function renderEditorRoute({ permissionListsLoaded }: { permissionListsLoaded: boolean }) {
  const store = createStore();
  store.set(fromAppState.salesforceOrgsState, [{ uniqueId: 'org-1', label: 'org-1' } as SalesforceOrgUi]);
  store.set(fromAppState.selectedOrgIdState, 'org-1');
  store.set(fromPermissionsState.selectedPermissionSetsState, [MANAGED_PERMISSION_SET_ID]);
  store.set(fromPermissionsState.selectedSObjectsState, ['Account']);
  if (permissionListsLoaded) {
    store.set(fromPermissionsState.profilesState, []);
    store.set(fromPermissionsState.permissionSetsState, []);
    store.set(fromPermissionsState.managedPermissionSetsState, [
      { id: MANAGED_PERMISSION_SET_ID, label: 'CPQ User', value: MANAGED_PERMISSION_SET_ID },
    ]);
  }

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/permissions-manager/editor']}>
        <Routes>
          <Route path="/permissions-manager" element={<ManagePermissions />}>
            <Route index element={<div>Selection page</div>} />
            <Route path="editor" element={<div>Editor page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('ManagePermissions editor route', () => {
  it('opens the editor once the permission set lists are loaded', () => {
    renderEditorRoute({ permissionListsLoaded: true });
    expect(screen.queryByText('Editor page')).not.toBeNull();
  });

  /**
   * Refreshing the lists clears them until Salesforce responds, and a failed refresh leaves them cleared. The editor
   * reads which permission sets are read-only from the managed list, so opening it then would make them editable.
   */
  it('returns to the selection page while the permission set lists are not loaded', () => {
    renderEditorRoute({ permissionListsLoaded: false });
    expect(screen.queryByText('Editor page')).toBeNull();
    expect(screen.queryByText('Selection page')).not.toBeNull();
  });
});

/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
// The component tree transitively imports @jetstream/ui/app-state, which calls fetchUserProfile() at init
// time — that fails in the test environment and causes an unhandled rejection. See Popover.spec.tsx.
vi.mock('@jetstream/ui/app-state', () => ({
  fromAppState: {},
}));

vi.mock('@jetstream/shared/data', () => ({
  queryAll: vi.fn(),
  sobjectOperation: vi.fn(),
}));

import { queryAll, sobjectOperation } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagePermissionSetAssignmentsModal } from '../ManagePermissionSetAssignmentsModal';

const PERM_SET_ID = '0PS1t000000AbCdEfG';
const ORG = { uniqueId: 'org-1', userId: '0051t000000Current' } as SalesforceOrgUi;

const mockQueryAll = vi.mocked(queryAll);
const mockSobjectOperation = vi.mocked(sobjectOperation);

function buildAssignment(index: number) {
  return {
    attributes: { type: 'PermissionSetAssignment', url: '' },
    Id: `0Pa1t00000000${String(index).padStart(3, '0')}`,
    PermissionSetId: PERM_SET_ID,
    AssigneeId: `0051t0000000${String(index).padStart(3, '0')}`,
    Assignee: {
      Id: `0051t0000000${String(index).padStart(3, '0')}`,
      Name: `User ${index}`,
      Username: `user${index}@example.com`,
      IsActive: true,
    },
  };
}

function mockAssignments(records: ReturnType<typeof buildAssignment>[]) {
  mockQueryAll.mockResolvedValue({
    queryResults: { records, totalSize: records.length, done: true },
  } as any);
}

function renderModal(props: Partial<React.ComponentProps<typeof ManagePermissionSetAssignmentsModal>> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <ManagePermissionSetAssignmentsModal
      org={ORG}
      permissionSetId={PERM_SET_ID}
      permissionSetLabel="Sales User"
      permissionSetName="Sales_User"
      onSaved={onSaved}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSaved, onClose };
}

describe('ManagePermissionSetAssignmentsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignments([buildAssignment(1), buildAssignment(2)]);
    mockSobjectOperation.mockResolvedValue([] as any);
  });

  test('Save is disabled until something is staged', async () => {
    renderModal();
    await screen.findByText('User 1');

    expect(screen.getByRole('button', { name: 'Save Changes' }).getAttribute('aria-disabled')).toBe('true');
  });

  test('refuses to render the editor for a profile-owned permission set', async () => {
    renderModal({ isOwnedByProfile: true });

    expect(await screen.findByText(/owned by a profile/i)).toBeTruthy();
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  test('deletes the assignment record — not the user — when a removal is staged', async () => {
    const { onSaved, onClose } = renderModal();
    await screen.findByText('User 1');

    await act(async () => {
      await userEvent.click(screen.getByRole('checkbox', { name: /User 1/ }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    await waitFor(() => expect(mockSobjectOperation).toHaveBeenCalledTimes(1));
    expect(mockSobjectOperation).toHaveBeenCalledWith(
      ORG,
      'PermissionSetAssignment',
      'delete',
      { ids: ['0Pa1t00000000001'] },
      { allOrNone: false },
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  test('keeps the modal open and surfaces the Salesforce message on a partial failure', async () => {
    const { onSaved, onClose } = renderModal();
    await screen.findByText('User 1');
    mockSobjectOperation.mockResolvedValue([
      { success: false, errors: [{ fields: [], message: 'Permission set license required', statusCode: 'REQUIRED_FEATURE_MISSING' }] },
    ] as any);

    await act(async () => {
      await userEvent.click(screen.getByRole('checkbox', { name: /User 1/ }));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    expect(await screen.findByText(/Permission set license required/)).toBeTruthy();
    // The change still hit the server, so the caller must refresh — but the modal stays put.
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('loads a default set of users so the dropdown is populated before any typing', async () => {
    renderModal();
    await screen.findByText('User 1');

    await waitFor(() => expect(mockQueryAll).toHaveBeenCalledTimes(2));
    const [, userSearchSoql] = mockQueryAll.mock.calls[1];
    expect(userSearchSoql).toContain('FROM User');
    expect(userSearchSoql).not.toContain('LIKE');
  });

  test('flags the current user and inactive assignees', async () => {
    mockAssignments([
      { ...buildAssignment(1), AssigneeId: ORG.userId, Assignee: { ...buildAssignment(1).Assignee, Id: ORG.userId } },
      { ...buildAssignment(2), Assignee: { ...buildAssignment(2).Assignee, IsActive: false } },
    ]);
    renderModal();
    await screen.findByText('User 1');

    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
  });

  // Rendering the 2,000 capped rows is genuinely slow, and under a fully parallel test run
  // this can exceed 30s on a loaded machine, so give it generous headroom.
  test('warns when more assignments exist than can be shown', { timeout: 90_000 }, async () => {
    mockAssignments(Array.from({ length: 2001 }, (_, index) => buildAssignment(index)));
    renderModal();

    expect(await screen.findByText(/Showing the first 2,000 assignments/)).toBeTruthy();
  });
});

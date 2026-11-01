/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
vi.mock('../utils/permission-set-create-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/permission-set-create-utils')>()),
  createPermissionSet: vi.fn(),
  fetchPermissionSetLicenses: vi.fn(),
  fetchCloneSourceDetails: vi.fn(),
}));

// The real atoms load the user profile from the server
vi.mock('@jetstream/ui/app-state', async (importOriginal) => {
  const { atom } = await import('jotai');
  return {
    ...(await importOriginal<typeof import('@jetstream/ui/app-state')>()),
    applicationCookieState: atom({ serverUrl: 'http://localhost' }),
    selectSkipFrontdoorAuth: atom(false),
  };
});

vi.mock('@jetstream/ui-core', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
  ConfirmPageChange: () => null,
}));

import { SalesforceOrgUi } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePermissionSetModal } from '../CreatePermissionSetModal';
import { PermissionSetCreateResult, createPermissionSet, fetchPermissionSetLicenses } from '../utils/permission-set-create-utils';

const ORG = { uniqueId: 'org-1', label: 'org-1' } as SalesforceOrgUi;

/** Starts a create that stays in flight until the returned `resolve` is called */
function mockPendingCreate() {
  let resolveCreate: (result: PermissionSetCreateResult) => void = () => undefined;
  vi.mocked(createPermissionSet).mockImplementation((_org, _input, _cloneFromId, onProgress) => {
    onProgress?.('Creating permission set');
    return new Promise((resolve) => {
      resolveCreate = resolve;
    });
  });
  return (result: PermissionSetCreateResult) => act(() => resolveCreate(result));
}

function getLabelInput() {
  return screen.getByRole('textbox', { name: /Label/ }) as HTMLInputElement;
}

/** Renders the modal with a label entered, once the modal has placed its initial focus (a frame after mounting) */
async function renderModal() {
  render(<CreatePermissionSetModal selectedOrg={ORG} profiles={[]} permissionSets={[]} managedPermissionSets={[]} onClose={vi.fn()} />);
  fireEvent.change(getLabelInput(), { target: { value: 'Sales Ops' } });
  await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
}

function getStatusTexts() {
  return screen.getAllByRole('status').map(({ textContent }) => textContent);
}

describe('CreatePermissionSetModal', () => {
  beforeEach(() => {
    vi.mocked(createPermissionSet).mockReset();
    vi.mocked(fetchPermissionSetLicenses).mockReset().mockResolvedValue([]);
  });

  it('keeps focus on Create while saving, then moves it to Close and announces the outcome', async () => {
    const resolveCreate = mockPendingCreate();
    await renderModal();
    const createButton = screen.getByRole('button', { name: 'Create' });

    act(() => createButton.focus());
    fireEvent.click(createButton);

    await waitFor(() => expect(createButton.getAttribute('aria-disabled')).toBe('true'));
    expect(createButton.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(createButton);
    expect(getLabelInput().readOnly).toBe(true);
    expect(getStatusTexts()).toContain('Creating permission set…');

    await resolveCreate({ id: '0PS000000000001', cloneSteps: [] });

    // The footer button, not the modal's header X
    const closeButton = screen.getByText('Close', { selector: 'button.slds-button_neutral' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    expect(getStatusTexts()).toContain('Sales Ops was created and selected.');
  });

  it('keeps focus in a text field submitted with Enter, since it only becomes read-only', async () => {
    mockPendingCreate();
    await renderModal();
    const labelInput = getLabelInput();

    act(() => labelInput.focus());
    fireEvent.submit(labelInput.form as HTMLFormElement);

    await waitFor(() => expect(labelInput.readOnly).toBe(true));
    expect(document.activeElement).toBe(labelInput);
  });

  it('moves focus to Create when the focused control is disabled while saving', async () => {
    mockPendingCreate();
    await renderModal();
    const sessionActivationCheckbox = screen.getByLabelText(/Session Activation Required/) as HTMLInputElement;

    act(() => sessionActivationCheckbox.focus());
    fireEvent.submit(sessionActivationCheckbox.form as HTMLFormElement);

    await waitFor(() => expect(sessionActivationCheckbox.disabled).toBe(true));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));
  });
});

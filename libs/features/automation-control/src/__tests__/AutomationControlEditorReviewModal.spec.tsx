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
  operationAccess: { allowed: true } as { allowed: boolean; deniedReason?: string },
  preparePayloads: (() => undefined) as unknown as (...args: unknown[]) => unknown,
  deployMetadata: (() => undefined) as unknown as (...args: unknown[]) => unknown,
  buildActivationPackage: (() => undefined) as unknown as (...args: unknown[]) => unknown,
}));

vi.mock('@jetstream/ui-core', () => ({
  ConfirmPageChange: () => null,
  fromJetstreamEvents: { emit: () => undefined },
  useAnalytics: () => ({ trackEvent: () => undefined }),
}));

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  return {
    applicationCookieState: atom({ defaultApiVersion: 'v60.0' }),
    googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
    useOperationAccess: () => mockState.operationAccess,
  };
});

vi.mock('../automation-control-data-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../automation-control-data-utils')>()),
  preparePayloads: (...args: unknown[]) => mockState.preparePayloads(...args),
  deployMetadata: (...args: unknown[]) => mockState.deployMetadata(...args),
}));

vi.mock('../automation-control-history-utils', () => ({
  createHistoryRecorder: () => ({ key: 'history-1', createdAt: new Date(), save: async () => undefined }),
}));

vi.mock('../automation-control-package-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../automation-control-package-utils')>()),
  buildActivationPackage: (...args: unknown[]) => mockState.buildActivationPackage(...args),
}));

vi.mock('../AutomationControlPackageDownload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../AutomationControlPackageDownload')>()),
  AutomationPackageDownloadModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Download Package">
      <button onClick={onClose}>Close download</button>
    </div>
  ),
}));

import { SalesforceOrgUi } from '@jetstream/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableRowItem } from '../automation-control-types';
import { AutomationControlEditorReviewModal } from '../AutomationControlEditorReviewModal';

const ROW: TableRowItem = {
  path: ['Validation Rule', 'Require_Phone'],
  key: 'ValidationRule_03d000000000001',
  parentKey: 'ValidationRule',
  type: 'ValidationRule',
  sobject: 'Account',
  record: { Id: '03d000000000001', FullName: 'Account.Require_Phone' } as TableRowItem['record'],
  link: '',
  readOnly: false,
  isActive: false,
  isActiveInitialState: true,
  label: 'Require_Phone',
  lastModifiedBy: '',
  description: null,
  additionalData: [],
};

let prepareSubject: Subject<unknown>;
let deploySubject: Subject<unknown>;

function renderModal() {
  return render(
    <AutomationControlEditorReviewModal
      defaultApiVersion="v60.0"
      selectedOrg={{ uniqueId: 'org-1' } as SalesforceOrgUi}
      rows={[ROW]}
      onClose={vi.fn()}
    />,
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

describe('AutomationControlEditorReviewModal', () => {
  beforeEach(() => {
    prepareSubject = new Subject();
    deploySubject = new Subject();
    mockState.operationAccess = { allowed: true };
    mockState.preparePayloads = () => prepareSubject;
    mockState.deployMetadata = () => deploySubject;
  });

  it('keeps Deploy Changes focusable and says why it is unavailable without deploy access', async () => {
    mockState.operationAccess = { allowed: false, deniedReason: 'Your access does not include deploying metadata' };
    const user = userEvent.setup();
    renderModal();
    act(() => prepareSubject.complete());

    const deployButton = screen.getByRole('button', { name: 'Deploy Changes' });
    expect(deployButton.hasAttribute('disabled')).toBe(false);
    expect(deployButton.getAttribute('aria-disabled')).toBe('true');
    expect(getDescription(deployButton)).toBe('Your access does not include deploying metadata');

    const deployMetadata = vi.fn(() => deploySubject);
    mockState.deployMetadata = deployMetadata;
    await user.click(deployButton);

    expect(deployMetadata).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Deploy Changes' })).toBe(deployButton);
    act(() => deployButton.focus());
    expect(document.activeElement).toBe(deployButton);
  });

  it('moves focus from Cancel to the primary button when Cancel unmounts at the end of a deploy', async () => {
    const user = userEvent.setup();
    renderModal();
    act(() => prepareSubject.complete());

    const primaryButton = screen.getByRole('button', { name: 'Deploy Changes' });
    await user.click(primaryButton);
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton.getAttribute('aria-disabled')).toBe('true');
    act(() => cancelButton.focus());

    act(() => deploySubject.complete());

    await waitFor(() => expect(cancelButton.isConnected).toBe(false));
    expect(primaryButton.textContent).toBe('Close');
    expect(document.activeElement).toBe(primaryButton);
  });

  it('focuses the package menu, not the close button, when the download modal closes', async () => {
    mockState.buildActivationPackage = async () => ({ data: new ArrayBuffer(0), includedCount: 1, missingItems: [] });
    const user = userEvent.setup();
    renderModal();
    act(() => prepareSubject.complete());

    await user.click(screen.getByRole('button', { name: /Download Package/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Before these changes' }));
    await user.click(await screen.findByRole('button', { name: 'Close download' }));

    const packageTrigger = await screen.findByRole('button', { name: /Download Package/ });
    await waitFor(() => expect(document.activeElement).toBe(packageTrigger));
  });
});

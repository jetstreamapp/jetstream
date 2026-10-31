import { axeScan } from '@jetstream/test-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { atom } from 'jotai';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DeployResults } from '../mass-update-records.types';

// The real app-state module fetches app info at module load; only the atoms the row reads are needed
vi.doMock('@jetstream/ui/app-state', () => ({
  actionInProgressState: atom(false),
  applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app' }),
  googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
  selectSkipFrontdoorAuth: atom(false),
}));

vi.doMock('../../analytics', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

const { MassUpdateRecordsDeploymentRow } = await import('../MassUpdateRecordsDeploymentRow');

const org = { uniqueId: 'org-1', label: 'Org 1' } as SalesforceOrgUi;

const failedStatusCheck: DeployResults = {
  status: 'Error',
  done: false,
  records: [],
  batchIdToIndex: {},
  processingErrors: [],
  processingStartTime: '2026-10-31T00:00:00.000Z',
  fatalErrorMessage: 'Could not check the job status',
  statusCheckFailed: true,
};

/** Resumes polling the way useDeployRecords does: the failure flag clears, which unmounts the button */
function DeploymentRowHarness() {
  const [deployResults, setDeployResults] = useState(failedStatusCheck);
  return (
    <MassUpdateRecordsDeploymentRow
      selectedOrg={org}
      sobject="Account"
      deployResults={deployResults}
      configuration={[]}
      batchSize={1000}
      omitTransformationText
      onCheckStatusAgain={() => setDeployResults({ ...deployResults, status: 'In Progress', statusCheckFailed: false })}
    />
  );
}

describe('MassUpdateRecordsDeploymentRow', () => {
  it('keeps focus in the row and announces the check when "Check status again" unmounts on its own click', async () => {
    const { baseElement } = render(<DeploymentRowHarness />);
    await axeScan(baseElement);
    const checkStatusButton = screen.getByRole('button', { name: 'Check status again' });
    act(() => checkStatusButton.focus());

    fireEvent.click(checkStatusButton);

    expect(screen.queryByRole('button', { name: 'Check status again' })).toBeNull();
    // Focus lands on the status line the check updates, not <body>
    expect(document.activeElement?.textContent).toBe('In Progress');
    await waitFor(() =>
      expect(screen.getAllByRole('status').map(({ textContent }) => textContent)).toContain('Checking status for Account'),
    );
  });
});

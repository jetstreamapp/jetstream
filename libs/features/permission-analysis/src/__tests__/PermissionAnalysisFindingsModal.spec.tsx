import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionAnalysisFinding } from '../permission-export-result-view';

vi.mock('@jetstream/ui-core', () => ({
  GridDownloadModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Download Issues">
      <button type="button" onClick={onClose}>
        Close download
      </button>
    </div>
  ),
}));

const { PermissionAnalysisFindingsModal } = await import('../PermissionAnalysisFindingsModal');

const findings = [{ severity: 'error', code: 'SOME_CODE', message: 'Something is wrong' } as PermissionAnalysisFinding];

describe('PermissionAnalysisFindingsModal', () => {
  it('returns focus to the Download button after the download dialog closes', async () => {
    render(
      <PermissionAnalysisFindingsModal
        open
        title="Issues"
        tagline="Found issues"
        summaryLine="1 issue"
        findings={findings}
        onClose={vi.fn()}
      />,
    );

    // The findings modal hides (unmounts its content) while the download dialog is open
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close download' }));
    });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Download' })));
  });
});

/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
vi.mock('@jetstream/shared/data', () => ({
  getApiErrorCode: vi.fn(() => null),
  previewTeamSeats: vi.fn(),
  updateTeamSeats: vi.fn(),
}));

vi.mock('@jetstream/ui-core', () => ({
  useAmplitude: () => ({ trackEvent: vi.fn() }),
}));

import { previewTeamSeats, updateTeamSeats } from '@jetstream/shared/data';
import { TeamSeatChangePreview, TeamSeatSummary } from '@jetstream/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSeatsManageModal } from '../TeamSeatsManageModal';

const SEATS: TeamSeatSummary = {
  purchased: 5,
  pending: null,
  pendingEffectiveAt: null,
  effective: 5,
  used: 2,
  reserved: 0,
  available: 3,
  isUnlimited: false,
  isOverAllocated: false,
  includedSeats: 0,
};

const PREVIEW: TeamSeatChangePreview = {
  changeType: 'INCREASE',
  currentSeats: 5,
  requestedSeats: 6,
  minimumSeats: 2,
  amountDueNow: 12.5,
  prorationDate: 1_790_000_000,
  nextInvoice: { amount: 150, date: '2026-11-01T00:00:00.000Z' },
  interval: 'MONTH',
  effectiveAt: '2026-10-06T00:00:00.000Z',
  replacesPendingDecrease: null,
  hasDiscount: false,
};

async function previewOneMoreSeat(user: ReturnType<typeof userEvent.setup>) {
  render(<TeamSeatsManageModal teamId="team-1" seats={SEATS} onClose={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Add a seat' }));
  await user.click(screen.getByTestId('team-seats-preview-button'));
  return screen.findByTestId('team-seats-confirm-button');
}

describe('TeamSeatsManageModal', () => {
  beforeEach(() => {
    vi.mocked(previewTeamSeats).mockReset().mockResolvedValue(PREVIEW);
    vi.mocked(updateTeamSeats).mockReset();
  });

  it('moves focus to Confirm and announces the charge when the preview replaces the seat picker', async () => {
    const user = userEvent.setup();
    const confirmButton = await previewOneMoreSeat(user);

    await waitFor(() => expect(document.activeElement).toBe(confirmButton));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Due today: $12.50.'));
  });

  it('returns focus to the seat count when Back leaves the preview', async () => {
    const user = userEvent.setup();
    await previewOneMoreSeat(user);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('team-seats-count')));
  });

  it('keeps focus on Confirm while the change runs and after it fails', async () => {
    let rejectUpdate: (error: Error) => void = () => undefined;
    vi.mocked(updateTeamSeats).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectUpdate = reject;
        }),
    );
    const user = userEvent.setup();
    const confirmButton = await previewOneMoreSeat(user);

    await user.click(confirmButton);
    expect(confirmButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(confirmButton);

    rejectUpdate(new Error('Your card was declined.'));
    expect(await screen.findByText('Your card was declined.')).toBeTruthy();
    expect(document.activeElement).toBe(confirmButton);
    expect(updateTeamSeats).toHaveBeenCalledTimes(1);
  });
});

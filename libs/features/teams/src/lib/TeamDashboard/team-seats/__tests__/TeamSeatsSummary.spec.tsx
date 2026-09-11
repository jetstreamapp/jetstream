import { TeamSeatSummary } from '@jetstream/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PAST_DUE_SEATS_HINT, TeamSeatsSummary } from '../TeamSeatsSummary';

function buildSeats(overrides: Partial<TeamSeatSummary> = {}): TeamSeatSummary {
  const purchased = overrides.purchased === undefined ? 5 : overrides.purchased;
  const pending = overrides.pending ?? null;
  const used = overrides.used ?? 2;
  const reserved = overrides.reserved ?? 0;
  let effective = purchased;
  if (purchased !== null && pending !== null) {
    effective = Math.min(purchased, pending);
  }
  const available = effective === null ? null : effective - used - reserved;
  return {
    purchased,
    pending,
    pendingEffectiveAt: overrides.pendingEffectiveAt ?? (pending !== null ? '2026-10-01T12:00:00.000Z' : null),
    effective,
    used,
    reserved,
    available,
    isUnlimited: purchased === null,
    isOverAllocated: available !== null && available < 0,
    includedSeats: 0,
    ...overrides,
  };
}

function renderSummary(seats: TeamSeatSummary, { hasManualBilling = false, manageSeatsDisabledReason = null as string | null } = {}) {
  return render(
    <TeamSeatsSummary seats={seats} hasManualBilling={hasManualBilling} manageSeatsDisabledReason={manageSeatsDisabledReason} />,
  );
}

describe('TeamSeatsSummary', () => {
  it('shows usage on one line and nothing else when seats are available', () => {
    renderSummary(buildSeats({ purchased: 5, used: 2 }));

    expect(screen.getByTestId('team-seats-card').textContent).toBe('Seats 5 purchased · 2 in use · 3 available');
    expect(screen.queryByTestId('team-seats-banner')).toBeNull();
    expect(screen.queryByTestId('team-seats-pending')).toBeNull();
  });

  it('lists reserved seats only when invitations hold some', () => {
    renderSummary(buildSeats({ purchased: 5, used: 2, reserved: 1 }));

    expect(screen.getByTestId('team-seats-card').textContent).toContain('2 in use · 1 reserved for pending invitation · 2 available');
  });

  it('flags an over-allocated team in red with a warning', () => {
    renderSummary(buildSeats({ purchased: 2, used: 3 }));

    expect(screen.getByTestId('team-seats-available').className).toContain('slds-text-color_error');
    expect(screen.getByTestId('team-seats-banner').textContent).toContain('Buy 1 more seat');
  });

  it('explains a scheduled decrease next to the available count', () => {
    renderSummary(buildSeats({ purchased: 5, pending: 3, used: 1 }));

    expect(screen.getByTestId('team-seats-available-caption').textContent).toBe(' (of 3 after the scheduled decrease)');
    expect(screen.getByTestId('team-seats-pending').textContent).toContain('Set your seats back to 5 or more to cancel it.');
  });

  it('describes an uncapped team without seat counts it does not have', () => {
    renderSummary(buildSeats({ purchased: null, used: 4 }));

    expect(screen.getByTestId('team-seats-unlimited').textContent).toBe('No seat limit is configured');
    expect(screen.queryByTestId('team-seats-purchased')).toBeNull();
  });

  it('shows the agreement note for manual billing and why Manage Seats is disabled', () => {
    renderSummary(buildSeats(), { hasManualBilling: true, manageSeatsDisabledReason: PAST_DUE_SEATS_HINT });

    expect(screen.getByTestId('team-seats-card').textContent).toContain('Your seat limit is set by your billing agreement.');
    expect(screen.getByText(PAST_DUE_SEATS_HINT)).toBeTruthy();
  });
});

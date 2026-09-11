import { TeamSeatSummary } from '@jetstream/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { evaluateSeatGate, SeatGate } from '../seat-gate';
import { SeatChangeNotice } from '../SeatChangeNotice';

function buildSeats(overrides: Partial<TeamSeatSummary> = {}): TeamSeatSummary {
  const purchased = overrides.purchased === undefined ? 5 : overrides.purchased;
  const used = overrides.used ?? 2;
  const reserved = overrides.reserved ?? 0;
  const available = purchased === null ? null : purchased - used - reserved;
  return {
    purchased,
    pending: null,
    pendingEffectiveAt: null,
    effective: purchased,
    used,
    reserved,
    available,
    isUnlimited: purchased === null,
    isOverAllocated: available !== null && available < 0,
    includedSeats: 0,
    ...overrides,
  };
}

function buildGate(overrides: Partial<SeatGate> = {}): SeatGate {
  return {
    seats: buildSeats(),
    hasManualBilling: false,
    canManageSeats: true,
    isPastDue: false,
    onBuySeats: vi.fn(),
    ...overrides,
  };
}

describe('evaluateSeatGate', () => {
  it('blocks a billable change when no seat is available', () => {
    expect(evaluateSeatGate(buildSeats({ used: 5 }), { requiresSeat: true })).toEqual({ availableSeats: 0, seatBlocked: true });
  });

  it('allows a billable change while seats remain', () => {
    expect(evaluateSeatGate(buildSeats({ used: 2 }), { requiresSeat: true })).toEqual({ availableSeats: 3, seatBlocked: false });
  });

  it('never blocks a change that does not need a seat', () => {
    expect(evaluateSeatGate(buildSeats({ used: 5 }), { requiresSeat: false })).toEqual({ availableSeats: 0, seatBlocked: false });
  });

  it('never blocks a change that does not take a seat right now', () => {
    expect(evaluateSeatGate(buildSeats({ used: 5 }), { requiresSeat: true, takesSeatNow: false }).seatBlocked).toBe(false);
  });

  it('treats unknown or unlimited seats as unbounded', () => {
    expect(evaluateSeatGate(null, { requiresSeat: true })).toEqual({ availableSeats: Infinity, seatBlocked: false });
    expect(evaluateSeatGate(buildSeats({ purchased: null }), { requiresSeat: true })).toEqual({
      availableSeats: Infinity,
      seatBlocked: false,
    });
  });
});

describe('SeatChangeNotice', () => {
  it('renders the unavailable notice with a buy button when the change is blocked', () => {
    const seatGate = buildGate({ seats: buildSeats({ used: 5 }) });
    render(<SeatChangeNotice seatGate={seatGate} evaluation={{ availableSeats: 0, seatBlocked: true }} requiresSeat consumption="uses" />);

    expect(screen.getByTestId('seats-unavailable-notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy more seats' })).toBeTruthy();
  });

  it('disables the buy button while past due', () => {
    const seatGate = buildGate({ seats: buildSeats({ used: 5 }), isPastDue: true });
    render(<SeatChangeNotice seatGate={seatGate} evaluation={{ availableSeats: 0, seatBlocked: true }} requiresSeat consumption="uses" />);

    expect((screen.getByRole('button', { name: 'Buy more seats' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('explains that an invitation reserves a seat', () => {
    render(
      <SeatChangeNotice
        seatGate={buildGate()}
        evaluation={{ availableSeats: 3, seatBlocked: false }}
        requiresSeat
        consumption="reserves"
      />,
    );

    expect(
      screen.getByText(
        'This invitation reserves 1 of your 3 available seats until it is accepted or cancelled. Your billing does not change.',
      ),
    ).toBeTruthy();
  });

  it('explains that a reactivation or promotion uses a seat', () => {
    render(
      <SeatChangeNotice seatGate={buildGate()} evaluation={{ availableSeats: 3, seatBlocked: false }} requiresSeat consumption="uses" />,
    );

    expect(screen.getByText('This change uses 1 of your 3 available seats. Your billing does not change.')).toBeTruthy();
  });

  it('says nothing about seat usage when the team has no cap', () => {
    const { container } = render(
      <SeatChangeNotice
        seatGate={buildGate({ seats: null })}
        evaluation={{ availableSeats: Infinity, seatBlocked: false }}
        requiresSeat
        consumption="uses"
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('notes that billing-only users do not use a seat, unless suppressed', () => {
    const evaluation = { availableSeats: 3, seatBlocked: false };
    const { unmount } = render(<SeatChangeNotice seatGate={buildGate()} evaluation={evaluation} requiresSeat={false} consumption="uses" />);
    expect(screen.getByText('Billing-only users do not use a seat.')).toBeTruthy();
    unmount();

    const { container } = render(
      <SeatChangeNotice seatGate={buildGate()} evaluation={evaluation} requiresSeat={false} consumption="uses" billingOnlyNote={false} />,
    );
    expect(container.textContent).toBe('');
  });
});

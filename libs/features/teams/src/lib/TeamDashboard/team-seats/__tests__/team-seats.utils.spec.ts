import { TeamSeatSummary } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  formatSeatDate,
  getAvailableSeats,
  getOverAllocationMessage,
  getSeatBannerState,
  getSeatChangeType,
  getSeatFooterMessage,
  getSeatsUnavailableMessage,
  hasPendingSeatDecrease,
  needsSeat,
} from '../team-seats.utils';

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
    pendingEffectiveAt: overrides.pendingEffectiveAt ?? (pending !== null ? '2026-10-01T00:00:00.000Z' : null),
    effective,
    used,
    reserved,
    available,
    isUnlimited: purchased === null,
    isOverAllocated: available !== null && available < 0,
    ...overrides,
  };
}

describe('getAvailableSeats', () => {
  it('returns the remaining seats for a capped team', () => {
    expect(getAvailableSeats(buildSeats({ purchased: 5, used: 3, reserved: 1 }))).toBe(1);
  });

  it('treats a missing summary or an unlimited team as having no cap', () => {
    expect(getAvailableSeats(null)).toBe(Infinity);
    expect(getAvailableSeats(buildSeats({ purchased: null }))).toBe(Infinity);
  });

  it('passes negative values through so callers can detect over-allocation', () => {
    expect(getAvailableSeats(buildSeats({ purchased: 2, used: 3 }))).toBe(-1);
  });
});

describe('formatSeatDate', () => {
  it('formats an ISO date as a readable long date', () => {
    expect(formatSeatDate('2026-10-01T12:00:00.000Z')).toMatch(/October 1, 2026|September 30, 2026/);
  });

  it('returns an empty string for a missing date and the raw value when unparseable', () => {
    expect(formatSeatDate(null)).toBe('');
    expect(formatSeatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('needsSeat', () => {
  it('is true for billable roles only', () => {
    expect(needsSeat('ADMIN')).toBe(true);
    expect(needsSeat('MEMBER')).toBe(true);
    expect(needsSeat('BILLING')).toBe(false);
  });
});

describe('hasPendingSeatDecrease', () => {
  it('is true only when a lower pending count is scheduled', () => {
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: 3 }))).toBe(true);
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: null }))).toBe(false);
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: 5 }))).toBe(false);
    expect(hasPendingSeatDecrease(null)).toBe(false);
  });
});

describe('getSeatChangeType', () => {
  it('classifies relative to the purchased count', () => {
    const seats = buildSeats({ purchased: 5 });
    expect(getSeatChangeType(7, seats)).toBe('INCREASE');
    expect(getSeatChangeType(3, seats)).toBe('DECREASE');
    expect(getSeatChangeType(5, seats)).toBe('NONE');
  });

  it('returning to the purchased count cancels a pending decrease', () => {
    expect(getSeatChangeType(5, buildSeats({ purchased: 5, pending: 3 }))).toBe('CANCEL_PENDING_DECREASE');
  });

  it('treats the pending count as the current target, matching the server', () => {
    const seats = buildSeats({ purchased: 5, pending: 3 });
    // Requesting the count that is already scheduled is not a change
    expect(getSeatChangeType(3, seats)).toBe('NONE');
    // A different count still replaces the scheduled decrease
    expect(getSeatChangeType(4, seats)).toBe('DECREASE');
    expect(getSeatChangeType(8, seats)).toBe('INCREASE');
  });
});

describe('getOverAllocationMessage', () => {
  it('is null when usage fits', () => {
    expect(getOverAllocationMessage(buildSeats({ purchased: 5, used: 5 }), false)).toBeNull();
    expect(getOverAllocationMessage(buildSeats({ purchased: null, used: 50 }), true)).toBeNull();
  });

  it('tells self-serve admins how many seats to buy', () => {
    expect(getOverAllocationMessage(buildSeats({ purchased: 4, used: 6 }), false)).toBe(
      'Your team is using 6 seats but has purchased 4. Buy 2 more seats or deactivate members to avoid interruption.',
    );
  });

  it('mentions reservations and points manual-billing teams to support', () => {
    expect(getOverAllocationMessage(buildSeats({ purchased: 4, used: 3, reserved: 2 }), true)).toBe(
      'Your team is using 3 seats and has 2 reserved for pending invitations but has purchased 4. Deactivate members or contact support to raise your seat limit to avoid interruption.',
    );
  });

  it('explains over-allocation caused by a pending decrease', () => {
    const message = getOverAllocationMessage(buildSeats({ purchased: 5, pending: 2, used: 3 }), false);
    expect(message).toContain('Your seat count decreases to 2 on');
    expect(message).toContain('but your team is using 3 seats');
  });
});

describe('getSeatBannerState', () => {
  it('is null when seats remain or the team is unlimited', () => {
    expect(getSeatBannerState(buildSeats({ purchased: 5, used: 2 }), false)).toBeNull();
    expect(getSeatBannerState(buildSeats({ purchased: null }), true)).toBeNull();
    expect(getSeatBannerState(null, false)).toBeNull();
  });

  it('warns when over-allocated', () => {
    const banner = getSeatBannerState(buildSeats({ purchased: 2, used: 3 }), false);
    expect(banner?.theme).toBe('warning');
    expect(banner?.message).toContain('Buy 1 more seat');
  });

  it('shows a light notice when every seat is taken', () => {
    const banner = getSeatBannerState(buildSeats({ purchased: 3, used: 2, reserved: 1 }), false);
    expect(banner).toEqual({
      theme: 'light',
      message:
        'All 3 seats are in use or reserved for pending invitations. Buy more seats or deactivate a member to add more team members.',
    });
  });

  it('points manual-billing teams to support when full', () => {
    const banner = getSeatBannerState(buildSeats({ purchased: 3, used: 3 }), true);
    expect(banner?.message).toContain('set by your agreement');
  });
});

describe('getSeatFooterMessage', () => {
  it('reports available seats', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: 5, used: 2, reserved: 1 }), false)).toBe('2 of 5 seats available.');
  });

  it('reports a full team', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: 5, used: 5 }), false)).toBe('All 5 seats are in use.');
    expect(getSeatFooterMessage(buildSeats({ purchased: 1, used: 1 }), false)).toBe('Your 1 seat is in use.');
  });

  it('reports over-allocation with reservations', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: 4, used: 4, reserved: 1 }), false)).toBe(
      'Using 5 of 4 seats, including 1 reserved for pending invitations (1 over).',
    );
  });

  it('uses the effective cap while a decrease is pending', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: 5, pending: 3, used: 1 }), false)).toBe('2 of 3 seats available.');
  });

  it('marks manual-billing limits as set by agreement', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: 10, used: 4 }), true)).toBe('6 of 10 seats available (set by your agreement).');
    expect(getSeatFooterMessage(buildSeats({ purchased: null }), true)).toBe('Unlimited seats (set by your agreement).');
  });

  it('is silent for an uncapped self-serve team or a missing summary', () => {
    expect(getSeatFooterMessage(buildSeats({ purchased: null }), false)).toBeNull();
    expect(getSeatFooterMessage(null, false)).toBeNull();
  });
});

describe('getSeatsUnavailableMessage', () => {
  it('describes the self-serve remedy', () => {
    expect(getSeatsUnavailableMessage(buildSeats({ purchased: 3, used: 3 }), false)).toBe(
      'No seats available. All 3 purchased seats are in use or reserved for pending invitations. Buy more seats, deactivate a member, or cancel a pending invitation. Billing-only users do not need a seat.',
    );
  });

  it('describes the manual-billing remedy', () => {
    expect(getSeatsUnavailableMessage(buildSeats({ purchased: 3, used: 3 }), true)).toBe(
      'No seats available. All 3 purchased seats are in use or reserved for pending invitations. Your seat limit of 3 is set by your agreement. Contact support to increase it, deactivate a member, or cancel a pending invitation. Billing-only users do not need a seat.',
    );
  });

  it('explains a cap lowered by a pending decrease', () => {
    const message = getSeatsUnavailableMessage(buildSeats({ purchased: 5, pending: 2, used: 2 }), false);
    expect(message).toContain('Your seat count decreases to 2 on');
    expect(message).toContain('all 2 of those seats are in use');
  });
});

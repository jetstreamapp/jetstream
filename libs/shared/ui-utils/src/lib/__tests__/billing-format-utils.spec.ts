import { TeamSeatSummary } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  formatSeatDate,
  formatUsd,
  getIntervalLabel,
  getOverAllocationMessage,
  getPendingSeatDecreaseMessage,
  hasPendingSeatDecrease,
} from '../billing-format-utils';

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
    includedSeats: 0,
    ...overrides,
  };
}

describe('formatUsd', () => {
  it('adds thousands separators and drops zero cents', () => {
    expect(formatUsd(1100)).toBe('$1,100');
    expect(formatUsd(25)).toBe('$25');
  });

  it('keeps non-zero cents', () => {
    expect(formatUsd(20.83)).toBe('$20.83');
  });
});

describe('getIntervalLabel', () => {
  it('maps both the subscription-item and price-list interval names', () => {
    expect(getIntervalLabel('MONTH')).toBe('month');
    expect(getIntervalLabel('MONTHLY')).toBe('month');
    expect(getIntervalLabel('YEAR')).toBe('year');
    expect(getIntervalLabel('ANNUAL')).toBe('year');
    expect(getIntervalLabel(null)).toBe('period');
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

describe('hasPendingSeatDecrease', () => {
  it('is true only when a lower pending count is scheduled', () => {
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: 3 }))).toBe(true);
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: null }))).toBe(false);
    expect(hasPendingSeatDecrease(buildSeats({ purchased: 5, pending: 5 }))).toBe(false);
    expect(hasPendingSeatDecrease(null)).toBe(false);
  });
});

describe('getPendingSeatDecreaseMessage', () => {
  it('announces the new count and the date it takes effect', () => {
    expect(getPendingSeatDecreaseMessage(buildSeats({ purchased: 5, pending: 3, pendingEffectiveAt: '2026-10-15T12:00:00.000Z' }))).toBe(
      'Your seat count will decrease from 5 to 3 on October 15, 2026. Seats are not refunded for the current period.',
    );
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

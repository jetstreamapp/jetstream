import { MAX_TEAM_SEATS } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  evaluateSeatCheck,
  isSeatConsumingMember,
  SeatInputs,
  isSeatReservingInvitation,
  summarizeSeats,
  summarizeSeatsFromTeam,
  validateRequestedSeatCount,
} from '../seat-math';

const NOW = new Date('2026-09-10T12:00:00Z');
const FUTURE = new Date('2026-09-20T12:00:00Z');
const PAST = new Date('2026-09-01T12:00:00Z');

function summary(overrides: Partial<SeatInputs> = {}) {
  return summarizeSeats({ purchasedSeats: 5, pendingSeats: null, pendingEffectiveAt: null, usedSeats: 3, reservedSeats: 1, ...overrides });
}

describe('summarizeSeats', () => {
  it('treats a null purchased count as unlimited', () => {
    const result = summarizeSeats({ purchasedSeats: null, pendingSeats: null, pendingEffectiveAt: null, usedSeats: 4, reservedSeats: 2 });
    expect(result).toEqual(
      expect.objectContaining({ purchased: null, effective: null, available: null, isUnlimited: true, isOverAllocated: false }),
    );
  });

  it('uses the pending count as the effective cap when it is lower', () => {
    const result = summarizeSeats({ purchasedSeats: 10, pendingSeats: 7, pendingEffectiveAt: FUTURE, usedSeats: 5, reservedSeats: 1 });
    expect(result.effective).toBe(7);
    expect(result.available).toBe(1);
    expect(result.pendingEffectiveAt).toBe(FUTURE.toISOString());
  });

  it('keeps the purchased count when a pending count is higher', () => {
    const result = summarizeSeats({ purchasedSeats: 5, pendingSeats: 8, pendingEffectiveAt: FUTURE, usedSeats: 2, reservedSeats: 0 });
    expect(result.effective).toBe(5);
  });

  it('reports over-allocation as a negative availability', () => {
    const result = summarizeSeats({ purchasedSeats: 2, pendingSeats: null, pendingEffectiveAt: null, usedSeats: 3, reservedSeats: 1 });
    expect(result.available).toBe(-2);
    expect(result.isOverAllocated).toBe(true);
  });
});

describe('summarizeSeatsFromTeam', () => {
  it('counts active billable members and unexpired billable invitations only', () => {
    const result = summarizeSeatsFromTeam(
      {
        billingAccount: { licenseCountLimit: 10, pendingSeatQuantity: null, pendingSeatEffectiveAt: null },
        members: [
          { role: 'ADMIN', status: 'ACTIVE' },
          { role: 'MEMBER', status: 'ACTIVE' },
          { role: 'MEMBER', status: 'INACTIVE' },
          { role: 'BILLING', status: 'ACTIVE' },
        ],
        invitations: [
          { role: 'MEMBER', expiresAt: FUTURE },
          { role: 'MEMBER', expiresAt: PAST },
          { role: 'BILLING', expiresAt: FUTURE },
        ],
      },
      NOW,
    );
    expect(result.used).toBe(2);
    expect(result.reserved).toBe(1);
    expect(result.available).toBe(7);
  });

  it('is unlimited for a team without a billing account', () => {
    expect(summarizeSeatsFromTeam({ billingAccount: null, members: [], invitations: [] }).isUnlimited).toBe(true);
  });
});

describe('role helpers', () => {
  it('never counts the billing role', () => {
    expect(isSeatConsumingMember({ role: 'BILLING', status: 'ACTIVE' })).toBe(false);
    expect(isSeatReservingInvitation({ role: 'BILLING', expiresAt: FUTURE }, NOW)).toBe(false);
  });

  it('ignores inactive members and expired invitations', () => {
    expect(isSeatConsumingMember({ role: 'MEMBER', status: 'INACTIVE' })).toBe(false);
    expect(isSeatReservingInvitation({ role: 'MEMBER', expiresAt: PAST }, NOW)).toBe(false);
    expect(isSeatReservingInvitation({ role: 'MEMBER', expiresAt: FUTURE }, NOW)).toBe(true);
  });
});

describe('evaluateSeatCheck', () => {
  it('always passes for unlimited teams', () => {
    expect(evaluateSeatCheck(summary({ purchasedSeats: null }), 'ADD')).toEqual({ ok: true });
  });

  it('blocks ADD at the cap but lets an invitation be accepted when only reservations fill it', () => {
    // 5 purchased, 3 used, 2 reserved: no room for a new person, but an invitee converts a reservation
    const atCap = summarizeSeats({ purchasedSeats: 5, pendingSeats: null, pendingEffectiveAt: null, usedSeats: 3, reservedSeats: 2 });
    expect(evaluateSeatCheck(atCap, 'ADD')).toEqual({ ok: false, code: 'NO_SEATS' });
    expect(evaluateSeatCheck(atCap, 'ACCEPT_INVITATION')).toEqual({ ok: true });
  });

  it('blocks both kinds once active members alone fill the cap', () => {
    const full = summarizeSeats({ purchasedSeats: 3, pendingSeats: null, pendingEffectiveAt: null, usedSeats: 3, reservedSeats: 1 });
    expect(evaluateSeatCheck(full, 'ADD').ok).toBe(false);
    expect(evaluateSeatCheck(full, 'ACCEPT_INVITATION').ok).toBe(false);
  });

  it('honors a pending decrease as the effective cap', () => {
    const pending = summarizeSeats({ purchasedSeats: 6, pendingSeats: 4, pendingEffectiveAt: FUTURE, usedSeats: 4, reservedSeats: 0 });
    expect(evaluateSeatCheck(pending, 'ADD').ok).toBe(false);
  });
});

describe('validateRequestedSeatCount', () => {
  const base = { seats: summary(), billingStatus: 'ACTIVE', manualBilling: false, includedSeats: 0 };

  it('rejects in priority order', () => {
    expect(validateRequestedSeatCount({ ...base, requested: 6, manualBilling: true })).toEqual({ ok: false, code: 'MANUAL_BILLING' });
    expect(validateRequestedSeatCount({ ...base, requested: 6, billingStatus: 'PAST_DUE' })).toEqual({ ok: false, code: 'PAST_DUE' });
    expect(validateRequestedSeatCount({ ...base, requested: 0 })).toEqual({ ok: false, code: 'MIN_SEATS', detail: { minimum: 1 } });
    expect(validateRequestedSeatCount({ ...base, requested: MAX_TEAM_SEATS + 1 })).toEqual({
      ok: false,
      code: 'MAX_SEATS',
      detail: { maximum: MAX_TEAM_SEATS },
    });
    expect(validateRequestedSeatCount({ ...base, requested: 3 })).toEqual({
      ok: false,
      code: 'BELOW_USAGE',
      detail: { used: 3, reserved: 1 },
    });
    expect(validateRequestedSeatCount({ ...base, requested: 4, includedSeats: 5 })).toEqual({
      ok: false,
      code: 'BELOW_INCLUDED',
      detail: { includedSeats: 5 },
    });
    expect(validateRequestedSeatCount({ ...base, requested: 5 })).toEqual({ ok: false, code: 'NO_CHANGE' });
  });

  it('accepts a count equal to current usage and any increase', () => {
    expect(validateRequestedSeatCount({ ...base, requested: 4 })).toEqual({ ok: true });
    expect(validateRequestedSeatCount({ ...base, requested: 12 })).toEqual({ ok: true });
  });

  it('treats returning to the purchased count as a change while a decrease is pending', () => {
    const pending = summary({ pendingSeats: 4, pendingEffectiveAt: FUTURE });
    expect(validateRequestedSeatCount({ ...base, seats: pending, requested: 5 })).toEqual({ ok: true });
    expect(validateRequestedSeatCount({ ...base, seats: pending, requested: 4 })).toEqual({ ok: false, code: 'NO_CHANGE' });
  });
});
